// Rule-of-7 referral promo (S-246).
//
// Refer 7 friends → 7 days Pro free, awarded once. Cap per account
// prevents abuse: a single referrer cannot earn more than the original
// 7-day grant per quarter, regardless of friend count.

import { prisma } from "@/lib/db";

const PROMO_DAYS = 7;
const PROMO_QUOTA = 7;
const PROMO_WINDOW_DAYS = 90;

export interface ReferralCheckResult {
  earned: boolean;
  qualifyingReferrals: number;
  /** When the next promo eligibility window opens. */
  nextEligibleAt: Date | null;
  freeDaysGranted: number;
}

export interface ReferralProgress {
  qualifyingReferrals: number;
  needed: number;
  freeDaysGranted: number;
  /** Timestamp of the active promo grant, if one exists in the current 90d window. */
  earnedAt: Date | null;
}

/**
 * Read-only snapshot of a user's referral progress for the share/banner UI.
 * Does NOT trigger a grant — call `maybeAwardReferralPromo` for that.
 */
export async function getReferralProgress(userId: string): Promise<ReferralProgress> {
  const windowStart = new Date(Date.now() - PROMO_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [referrals, existing] = await Promise.all([
    prisma.user.count({
      where: { referredById: userId, createdAt: { gte: windowStart } },
    }),
    prisma.subscription.findFirst({
      where: {
        userId,
        plan: "basic", // matches the promo grant in maybeAwardReferralPromo
        startsAt: { gte: windowStart },
      },
      select: { startsAt: true },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  return {
    qualifyingReferrals: referrals,
    needed: PROMO_QUOTA,
    freeDaysGranted: existing ? PROMO_DAYS : 0,
    earnedAt: existing ? existing.startsAt : null,
  };
}

export async function maybeAwardReferralPromo(userId: string): Promise<ReferralCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, createdAt: true },
  });
  if (!user) {
    return { earned: false, qualifyingReferrals: 0, nextEligibleAt: null, freeDaysGranted: 0 };
  }

  const windowStart = new Date(Date.now() - PROMO_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const referrals = await prisma.user.count({
    where: { referredById: userId, createdAt: { gte: windowStart } },
  });

  if (referrals < PROMO_QUOTA) {
    return {
      earned: false,
      qualifyingReferrals: referrals,
      nextEligibleAt: null,
      freeDaysGranted: 0,
    };
  }

  // Idempotent: only grant once per 90-day window.
  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      plan: "basic", // we'd extend this when "pro" enters PlanType
      startsAt: { gte: windowStart },
    },
  });
  if (existing) {
    return {
      earned: false,
      qualifyingReferrals: referrals,
      nextEligibleAt: new Date(existing.startsAt.getTime() + PROMO_WINDOW_DAYS * 86_400_000),
      freeDaysGranted: 0,
    };
  }

  const now = new Date();
  await prisma.subscription.create({
    data: {
      userId,
      plan: "basic",
      periodType: "monthly",
      autoRenew: false,
      startsAt: now,
      expiresAt: new Date(now.getTime() + PROMO_DAYS * 86_400_000),
    },
  });
  return {
    earned: true,
    qualifyingReferrals: referrals,
    nextEligibleAt: new Date(now.getTime() + PROMO_WINDOW_DAYS * 86_400_000),
    freeDaysGranted: PROMO_DAYS,
  };
}
