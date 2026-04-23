// ---------------------------------------------------------------------------
// Sliding-window rate limiter — Redis-backed with in-memory fallback.
//
// Why this exists separately from src/lib/redis.ts::rateLimit:
//   - This one is for security-sensitive paths (login attempts, password
//     reset, email verify, abuse reports). The signature is generic
//     (key, limit, windowMs) and the algorithm is a proper sliding window
//     so 3 attempts spread across 60s can't slip past a fixed window.
//   - redis.ts::rateLimit is for tier-based throughput limiting on AI /
//     messaging endpoints — fixed window, INCR-based, simpler.
//
// Implementation:
//   - Each key gets a Redis sorted set: score = unix-ms timestamp, member =
//     "${ts}:${nonce}" so duplicate timestamps don't collide.
//   - The check + increment runs as a Lua script (atomic on the Redis side
//     so concurrent requests can't all squeak past the limit).
//   - Set TTL = windowMs (in seconds, rounded up) so abandoned keys expire.
//
// Fallback:
//   - If REDIS_URL is unset, or the call to Redis throws / times out, we
//     fall back to the in-memory bucket. Same API. Tradeoff: per-instance
//     limits in fallback mode, but the system still functions.
//   - Fallback failures get reported to Sentry once per process so we
//     notice if Redis is degraded in prod (without spamming).
// ---------------------------------------------------------------------------

import { redis } from "@/lib/redis";
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

// Track whether we've already pinged Sentry about a Redis-unavailable
// situation so we don't flood the queue with one event per request.
let redisUnavailableReported = false;

function redisConfigured(): boolean {
  return !!process.env.REDIS_URL;
}

async function redisRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult | null> {
  if (!redisConfigured()) return null;

  try {
    const nonce = Math.random().toString(36).slice(2, 10);
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      `ratelimit:sw:${key}`,
      String(Date.now()),
      String(windowMs),
      String(limit),
      nonce,
    )) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      retryAfterMs: result[2],
      source: "redis",
    };
  } catch (error) {
    if (!redisUnavailableReported) {
      redisUnavailableReported = true;
      reportError(error, {
        context: "rate-limit:redis-eval-failed",
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
