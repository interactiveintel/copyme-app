import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { rateLimit } from "@/lib/rate-limit";
import { Redis as UpstashRedis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// GET /api/debug/rate-limit
//
// Diagnostic — TEMPORARY. Reports:
//   - whether REDIS_URL is configured
//   - whether the Redis client can PING (ms latency or error)
//   - what rateLimit() decides for a fixed test key, and via which source
//
// Used to verify that the v4.2.0 Redis-backed rate limiter is actually
// hitting Redis in production rather than silently falling back to the
// per-instance in-memory bucket.
// ---------------------------------------------------------------------------

export async function GET() {
  const out: Record<string, unknown> = {
    redisConfigured: !!process.env.REDIS_URL,
    redisUrlHost: process.env.REDIS_URL
      ? new URL(
          process.env.REDIS_URL.replace("rediss://", "https://").replace("redis://", "http://"),
        ).hostname
      : null,
  };

  // Ping Redis directly
  const pingStart = Date.now();
  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("ping timeout 3000ms")), 3000),
      ),
    ]);
    out.ping = { ok: pong === "PONG", value: pong, latencyMs: Date.now() - pingStart };
  } catch (error) {
    out.ping = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - pingStart,
    };
  }

  // Inspect Upstash REST creds visibility from the function.
  // Expose the URL value (NOT the token) so we can see protocol + port.
  out.upstashRest = {
    KV_REST_API_URL_value: process.env.KV_REST_API_URL ?? null,
    KV_REST_API_TOKEN_set: !!process.env.KV_REST_API_TOKEN,
    KV_REST_API_TOKEN_len: process.env.KV_REST_API_TOKEN?.length ?? 0,
    UPSTASH_REDIS_REST_URL_value: process.env.UPSTASH_REDIS_REST_URL ?? null,
    UPSTASH_REDIS_REST_TOKEN_set: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  // Test Upstash REST directly (bypass rate-limit code path).
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    const restStart = Date.now();
    try {
      const r = new UpstashRedis({ url, token });
      const pong = await r.ping();
      out.upstashRestPing = { ok: pong === "PONG", value: pong, latencyMs: Date.now() - restStart };
    } catch (error) {
      out.upstashRestPing = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: Date.now() - restStart,
      };
    }
  } else {
    out.upstashRestPing = { skipped: true, reason: "no REST creds" };
  }

  // Probe the rate limiter once with a stable key — multiple requests in
  // quick succession should accumulate state if Redis is doing the work.
  try {
    const result = await rateLimit("debug-probe", 100, 60_000);
    out.rateLimitProbe = result;
  } catch (error) {
    out.rateLimitProbe = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return NextResponse.json(out);
}
