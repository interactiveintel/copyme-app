// ---------------------------------------------------------------------------
// Per-user-per-day cost cap for Yogi.
//
// Sprint goal: <$0.05 per user per day at 100 users. We default to a
// $0.10/user/day hard cap so a runaway user can't blow the budget for the
// whole cohort. Override via the YOGI_DAILY_COST_CAP_USD env var.
//
// Costs are tallied in micro-USD (1/1,000,000 USD) so we can store them as
// integers in Postgres without floating-point drift.
// ---------------------------------------------------------------------------

import prisma from "@/lib/db";

export const DEFAULT_DAILY_CAP_USD = 0.1;

export function dailyCapMicroUsd(): number {
  const raw = process.env.YOGI_DAILY_COST_CAP_USD;
  const parsed = raw ? Number(raw) : DEFAULT_DAILY_CAP_USD;
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.round(DEFAULT_DAILY_CAP_USD * 1_000_000);
  return Math.round(parsed * 1_000_000);
}

export function todayKey(now: Date = new Date()): string {
  // YYYY-MM-DD in UTC. Day boundaries align with our streak logic.
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface CostCapStatus {
  spentMicroUsd: number;
  capMicroUsd: number;
  remainingMicroUsd: number;
  exceeded: boolean;
}

/**
 * Pre-flight check before calling Claude. If today's spend has already
 * crossed the cap, return exceeded=true and the API route should respond
 * with 429.
 */
export async function checkCostCap(userId: string): Promise<CostCapStatus> {
  const cap = dailyCapMicroUsd();
  const day = todayKey();
  const row = await prisma.yogiCostLog.findUnique({
    where: { userId_day: { userId, day } },
    select: { costMicroUsd: true },
  });
  const spent = row?.costMicroUsd ?? 0;
  return {
    spentMicroUsd: spent,
    capMicroUsd: cap,
    remainingMicroUsd: Math.max(0, cap - spent),
    exceeded: spent >= cap,
  };
}

/**
 * Record one Yogi call's token usage + estimated cost. Upserts the day row.
 */
export async function recordYogiUsage(
  userId: string,
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costMicroUsd: number;
  },
): Promise<void> {
  const day = todayKey();
  try {
    await prisma.yogiCostLog.upsert({
      where: { userId_day: { userId, day } },
      create: {
        userId,
        day,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        cacheReadTokens: usage.cacheReadTokens,
        cacheWriteTokens: usage.cacheWriteTokens,
        costMicroUsd: usage.costMicroUsd,
        callCount: 1,
      },
      update: {
        inputTokens: { increment: usage.inputTokens },
        outputTokens: { increment: usage.outputTokens },
        cacheReadTokens: { increment: usage.cacheReadTokens },
        cacheWriteTokens: { increment: usage.cacheWriteTokens },
        costMicroUsd: { increment: usage.costMicroUsd },
        callCount: { increment: 1 },
      },
    });
  } catch (err) {
    // Cost logging must never break a successful chat.
    console.warn("[yogi-cost] log failed:", err instanceof Error ? err.message : err);
  }
}
