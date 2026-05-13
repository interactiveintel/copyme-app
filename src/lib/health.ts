// Service health checks for the public status page (/status) and the
// /api/status JSON endpoint.
//
// Each check is independent and timeboxed — a stalled service shouldn't
// block the page render. We measure latency in ms so the page can flag
// slow-but-not-down dependencies (yellow) separately from outages (red).

import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { list } from "@vercel/blob";

export type ServiceStatus = "ok" | "degraded" | "down";

export interface ServiceCheck {
  status: ServiceStatus;
  /** Round-trip latency in ms. */
  latencyMs: number;
  /** Short error message (only when status !== "ok"). */
  error?: string;
}

export interface HealthSnapshot {
  /** Worst service status across the board. */
  status: ServiceStatus;
  /** ISO 8601 timestamp at which the snapshot was generated. */
  timestamp: string;
  /** Short git SHA of the running build, when available. */
  version: string;
  /** Vercel environment ("production" | "preview" | "development"). */
  environment: string;
  services: {
    database: ServiceCheck;
    redis: ServiceCheck;
    blob: ServiceCheck;
  };
}

// A service is degraded (yellow) when it's healthy but slow. Tuned loosely
// — these aren't SLOs, just a "something looks off" signal.
const DEGRADED_THRESHOLD_MS = 1500;
// Per-check timeout. A check that doesn't return inside this window is
// reported as down — and we don't block the page on it.
const TIMEOUT_MS = 3000;

function now(): number {
  return Date.now();
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classify(latencyMs: number): ServiceStatus {
  return latencyMs > DEGRADED_THRESHOLD_MS ? "degraded" : "ok";
}

async function checkDatabase(): Promise<ServiceCheck> {
  const t0 = now();
  try {
    // Cheapest possible round-trip — no table lookup, just a server roundtrip.
    await withTimeout(prisma.$queryRaw`SELECT 1`, TIMEOUT_MS, "database");
    const latencyMs = now() - t0;
    return { status: classify(latencyMs), latencyMs };
  } catch (err) {
    return {
      status: "down",
      latencyMs: now() - t0,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
    };
  }
}

async function checkRedis(): Promise<ServiceCheck> {
  const t0 = now();
  try {
    // ioredis client is lazyConnect — first ping pays connection cost.
    // That's fine for a status check; we want to know if the path works.
    const reply = await withTimeout(redis.ping(), TIMEOUT_MS, "redis");
    const latencyMs = now() - t0;
    if (reply !== "PONG") {
      return { status: "down", latencyMs, error: `unexpected reply: ${reply}` };
    }
    return { status: classify(latencyMs), latencyMs };
  } catch (err) {
    return {
      status: "down",
      latencyMs: now() - t0,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
    };
  }
}

async function checkBlob(): Promise<ServiceCheck> {
  const t0 = now();
  try {
    // `list({ limit: 1 })` is the cheapest possible blob-store probe.
    // It doesn't require knowing any specific blob; Vercel's API returns
    // the first item from any prefix.
    await withTimeout(list({ limit: 1 }), TIMEOUT_MS, "blob");
    const latencyMs = now() - t0;
    return { status: classify(latencyMs), latencyMs };
  } catch (err) {
    return {
      status: "down",
      latencyMs: now() - t0,
      error: err instanceof Error ? err.message.slice(0, 200) : "unknown error",
    };
  }
}

function worstOf(...statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.includes("down")) return "down";
  if (statuses.includes("degraded")) return "degraded";
  return "ok";
}

export async function snapshot(): Promise<HealthSnapshot> {
  // Run all three checks in parallel — total page latency is bounded by
  // the slowest one (or TIMEOUT_MS, whichever is shorter).
  const [database, redisCheck, blob] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkBlob(),
  ]);

  return {
    status: worstOf(database.status, redisCheck.status, blob.status),
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
    services: {
      database,
      redis: redisCheck,
      blob,
    },
  };
}
