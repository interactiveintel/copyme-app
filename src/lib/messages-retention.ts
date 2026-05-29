// ---------------------------------------------------------------------------
// Messages retention — v4.16.3 (Tier F6b, Joze's passive-history product spec)
// ---------------------------------------------------------------------------
//
// Until this file shipped, the "Rule of 7" meant exactly 7 messages per
// 1:1 conversation, enforced by /api/messages/send deleting the oldest
// row whenever the 8th was queued. That count-cap remains the brand
// promise for the free tier — but Joze's beta feedback called for a
// *bigger active window per paid tier* (NOT a read-only archive):
//
//   Basic    → 7 messages   (count-based; current behavior)
//   Pro      → 7 weeks      (time-based)
//   Business → 7 weeks      (time-based; collapses business_3/7/50)
//   Premium  → 70 weeks     (time-based; ecommerce DB tier)
//
// The DB `accountTier` enum is
//   basic | business_3 | business_7 | business_50 | ecommerce
// plus the older "pro" string used by src/lib/tiers.ts. We accept all
// of them; unknown tiers fall back to Basic so we never accidentally
// extend retention past the brand promise.
//
// Per-pair semantic: a Basic user chatting with a Premium user gets
// the Premium window. The MORE GENEROUS side wins. This is intentional
// — it makes "upgrade for unlimited history" a soft pitch that even
// free users benefit from when their peer pays, and avoids the
// implementation horror of presenting different message sets to the
// two sides of the same conversation (the underlying Message row is
// shared).
//
// Enforcement happens in two places:
//   1. /api/messages/send — per-send prune for the active conversation
//      (cheap, immediate; covers active conversations).
//   2. /api/cron/messages-retention — nightly sweep (covers idle
//      conversations whose owner hasn't sent in weeks).
// ---------------------------------------------------------------------------

import prisma from "@/lib/db";

export type RetentionMode = "count" | "time";

export interface RetentionPolicy {
  mode: RetentionMode;
  /** count: max messages kept. time: max age in days. */
  value: number;
  /** Short human label for analytics + UI surfacing. */
  label: string;
  /** Original tier name that resolved to this policy (for debug logging). */
  tier: string;
}

const BASIC_COUNT = 7;
const PAID_WEEKS = 7;
const PREMIUM_WEEKS = 70;

export function retentionPolicy(tier: string | null | undefined): RetentionPolicy {
  const t = (tier ?? "basic").toLowerCase();
  if (t === "ecommerce" || t === "premium") {
    return { mode: "time", value: PREMIUM_WEEKS * 7, label: "70 weeks", tier: t };
  }
  if (t === "pro" || t.startsWith("business")) {
    return { mode: "time", value: PAID_WEEKS * 7, label: "7 weeks", tier: t };
  }
  return { mode: "count", value: BASIC_COUNT, label: "7 messages", tier: t };
}

/**
 * Rank two policies and return the more generous. Any time-policy
 * beats any count-policy; among time-policies, larger window wins.
 */
export function maxRetention(a: RetentionPolicy, b: RetentionPolicy): RetentionPolicy {
  // Time always beats count.
  if (a.mode === "time" && b.mode === "count") return a;
  if (b.mode === "time" && a.mode === "count") return b;
  // Same mode → bigger value wins.
  return a.value >= b.value ? a : b;
}

/**
 * Resolve the effective retention policy for a 1:1 conversation.
 * Reads both users' tiers in one query.
 */
export async function policyForPair(
  userIdA: string,
  userIdB: string,
): Promise<RetentionPolicy> {
  const users = await prisma.user.findMany({
    where: { id: { in: [userIdA, userIdB] } },
    select: { id: true, accountTier: true },
  });
  const a = users.find((u) => u.id === userIdA);
  const b = users.find((u) => u.id === userIdB);
  return maxRetention(
    retentionPolicy(a?.accountTier),
    retentionPolicy(b?.accountTier),
  );
}

/** Convert a time-mode policy into a Date cutoff. Null for count-mode. */
export function cutoffFor(policy: RetentionPolicy): Date | null {
  if (policy.mode !== "time") return null;
  return new Date(Date.now() - policy.value * 24 * 60 * 60 * 1000);
}

/**
 * Safety cap for time-mode fetches. The active window for a Premium
 * user could in theory hold thousands of messages (70w × 7d × N/day).
 * Capping the query bounds DB cost; the cap is way above realistic
 * usage and well above what a single screen renders.
 */
export const TIME_FETCH_CAP = 1000;
