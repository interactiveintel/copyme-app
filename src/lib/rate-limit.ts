// ---------------------------------------------------------------------------
// In-memory rate limiter (sliding window)
//
// Suitable for a single-instance deployment (Vercel Edge/Node, single region)
// as a first layer of defense against brute-force login attempts. For
// multi-instance deploys, swap to Redis/Upstash — the API surface here is
// narrow on purpose so the swap is one file.
// ---------------------------------------------------------------------------

interface Bucket {
  /** Unix-ms timestamps of attempts within the current window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Periodic cleanup so the map doesn't grow unbounded. We prune any bucket
// whose most recent hit is older than the longest window we enforce (1h).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BUCKET_AGE_MS = 60 * 60 * 1000; // 1 hour

// Only start the timer in runtime environments that support it. In Edge /
// serverless this may not be meaningful across invocations, but it's harmless.
if (typeof setInterval === "function" && typeof process !== "undefined") {
  setInterval(() => {
    const cutoff = Date.now() - MAX_BUCKET_AGE_MS;
    for (const [key, bucket] of buckets) {
      if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < cutoff) {
        buckets.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.();
}

export interface RateLimitResult {
  /** True if the caller is within the limit and may proceed. */
  allowed: boolean;
  /** Remaining attempts in this window (after this call). */
  remaining: number;
  /** Ms until the oldest recorded hit falls out of the window. */
  retryAfterMs: number;
}

/**
 * Sliding-window rate limit check.
 *
 * @param key       A stable identifier (e.g. `"login:<ip>:<phone-hash>"`).
 * @param limit     Max attempts allowed in the window.
 * @param windowMs  Window size in milliseconds.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop hits older than the window.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, oldest + windowMs - now),
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: limit - bucket.hits.length,
    retryAfterMs: 0,
  };
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
