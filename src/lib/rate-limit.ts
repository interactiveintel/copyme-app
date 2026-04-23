// ---------------------------------------------------------------------------
// Sliding-window rate limiter — Upstash REST + in-memory fallback.
//
// Why this exists separately from src/lib/redis.ts::rateLimit:
//   - This one is for security-sensitive paths (login attempts, password
//     reset, email verify, abuse reports). The signature is generic
//     (key, limit, windowMs) and the algorithm is a proper sliding window
//     so 3 attempts spread across 60s can't slip past a fixed window.
//   - redis.ts::rateLimit is for tier-based throughput limiting on AI /
//     messaging endpoints — fixed window, INCR-based, simpler.
//
// Why Upstash REST and not the ioredis singleton:
//   - Vercel serverless functions can't reliably hold a long-lived TCP
//     connection to Upstash. ioredis times out at 3 retries on cold start
//     (verified empirically against this Upstash instance from prod). The
//     Upstash REST client is HTTP-based — no socket lifecycle, perfect for
//     serverless cold starts.
//   - We keep ioredis (src/lib/redis.ts) for inbox cache / presence which
//     run from contexts that can afford the warm-up cost; the rate-limit
//     path lives on the request-blocking path so it has to be fast.
//
// Implementation:
//   - Each key gets a Redis sorted set: score = unix-ms timestamp, member =
//     "${ts}:${nonce}" so duplicate timestamps don't collide.
//   - The check + increment runs as a Lua script (atomic on the Redis side
//     so concurrent requests can't all squeak past the limit).
//   - Set TTL = windowMs (in seconds, rounded up) so abandoned keys expire.
//
// Fallback:
//   - If neither KV_REST_API_URL+KV_REST_API_TOKEN nor UPSTASH_REDIS_REST_*
//     pair is set, OR the REST call throws, we fall back to an in-memory
//     bucket. Same API. Tradeoff: per-instance limits in fallback mode,
//     but the system still functions.
//   - The first REST failure per process gets reported to Sentry once so
//     degraded mode is visible without spamming.
// ---------------------------------------------------------------------------

import { Redis as UpstashRedis } from "@upstash/redis";
import { reportError } from "@/lib/observability";

export interface RateLimitResult {
  /** True if the caller is within the limit and may proceed. */
  allowed: boolean;
  /** Remaining attempts in this window (after this call). */
  remaining: number;
  /** Ms until the oldest recorded hit falls out of the window. */
  retryAfterMs: number;
  /** Where the decision was made — useful for log/observability. */
  source: "redis" | "memory";
}

// ---------------------------------------------------------------------------
// In-memory fallback (sliding window)
// ---------------------------------------------------------------------------

interface Bucket {
  hits: number[];
}

const memoryBuckets = new Map<string, Bucket>();

const MEM_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MEM_MAX_BUCKET_AGE_MS = 60 * 60 * 1000; // 1 hour

if (typeof setInterval === "function" && typeof process !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - MEM_MAX_BUCKET_AGE_MS;
    for (const [key, bucket] of memoryBuckets) {
      if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1]! < cutoff) {
        memoryBuckets.delete(key);
      }
    }
  }, MEM_CLEANUP_INTERVAL_MS).unref?.();
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = memoryBuckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0]!;
    memoryBuckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
      source: "memory",
    };
  }

  bucket.hits.push(now);
  memoryBuckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterMs: 0,
    source: "memory",
  };
}

// ---------------------------------------------------------------------------
// Redis sliding window (Lua script — atomic check-and-increment)
// ---------------------------------------------------------------------------

// KEYS[1] = bucket key
// ARGV[1] = now (ms)
// ARGV[2] = window (ms)
// ARGV[3] = limit
// ARGV[4] = unique member suffix (so concurrent same-ms calls don't collide)
//
// Returns { allowed, remaining, retryAfterMs }
const SLIDING_WINDOW_LUA = `
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local nonce = ARGV[4]
  local cutoff = now - window

  -- Drop hits outside the window
  redis.call('ZREMRANGEBYSCORE', key, 0, cutoff)

  local count = redis.call('ZCARD', key)
  if count >= limit then
    local oldestArr = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local oldest = tonumber(oldestArr[2]) or now
    local retryAfter = (oldest + window) - now
    if retryAfter < 0 then retryAfter = 0 end
    return { 0, 0, retryAfter }
  end

  redis.call('ZADD', key, now, now .. ':' .. nonce)
  -- Expire the whole key one window from now so abandoned buckets evaporate
  local ttlSeconds = math.ceil(window / 1000) + 1
  redis.call('EXPIRE', key, ttlSeconds)

  return { 1, limit - (count + 1), 0 }
`;

// Track whether we've already pinged Sentry about an Upstash-unavailable
// situation so we don't flood the queue with one event per request.
let upstashUnavailableReported = false;

// Pick up the REST credentials from any of the standard envs. Vercel's KV
// integration provisions KV_REST_API_*; @upstash/redis convention is
// UPSTASH_REDIS_REST_*; both work because we hand them to the client
// constructor explicitly.
function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

// Lazily-instantiated singleton. The Upstash client is essentially a fetch
// wrapper, so creating one is cheap, but we still cache it to keep config
// reads off the hot path.
let upstashClient: UpstashRedis | null = null;
function getUpstash(): UpstashRedis | null {
  if (upstashClient) return upstashClient;
  const creds = upstashCredentials();
  if (!creds) return null;
  upstashClient = new UpstashRedis({ url: creds.url, token: creds.token });
  return upstashClient;
}

async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  const client = getUpstash();
  if (!client) return null;

  try {
    const nonce = Math.random().toString(36).slice(2, 10);
    // @upstash/redis's eval signature is eval(script, keys[], args[]).
    const raw = (await client.eval(
      SLIDING_WINDOW_LUA,
      [`ratelimit:sw:${key}`],
      [String(Date.now()), String(windowMs), String(limit), nonce],
    )) as Array<number | string>;

    // Upstash returns RESP integers as JS numbers, but defensive parse just
    // in case any platform shim returns strings.
    const allowed = Number(raw[0]) === 1;
    const remaining = Number(raw[1]);
    const retryAfterMs = Number(raw[2]);

    return {
      allowed,
      remaining,
      retryAfterMs,
      source: "redis",
    };
  } catch (error) {
    if (!upstashUnavailableReported) {
      upstashUnavailableReported = true;
      reportError(error, {
        context: "rate-limit:upstash-eval-failed",
        key,
        limit,
        windowMs,
      });
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sliding-window rate limit check.
 *
 * @param key       A stable identifier (e.g. `"login:<ip>:<phone-hash>"`).
 * @param limit     Max attempts allowed in the window.
 * @param windowMs  Window size in milliseconds.
 *
 * Returns a result object with `allowed`, `remaining`, `retryAfterMs` and
 * `source` ("redis" or "memory"). The caller doesn't need to care which
 * source served the result — both honour the same window/limit semantics.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const fromRedis = await redisRateLimit(key, limit, windowMs);
  if (fromRedis) return fromRedis;
  return memoryRateLimit(key, limit, windowMs);
}

/**
 * Extract a best-effort client IP from a Next.js request. Falls back to
 * `"unknown"` so rate-limit keys are still stable.
 */
export function clientIpFromRequest(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
