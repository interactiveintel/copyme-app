// ---------------------------------------------------------------------------
// Daily activity streak helper.
//
// Rules (matching the intent of the Rule-of-7 product):
//   - "A day" is a calendar day in the user's local tz. We compute via a UTC
//     date truncation — good enough for v1; tz-aware later.
//   - Activity on a new day that is exactly 1 day after the previous active
//     day → streak++.
//   - Activity on the same day → no-op (streakDays unchanged).
//   - Activity after a gap of >1 day → streak resets to 1.
//   - Activity when streak is 0 (or streakLastDayAt is null) → streak = 1.
//
// Intentional trade-off: we bump the streak lazily from API handlers that
// already touch the user row (login, message send, mark-read, users/me
// fetch), rather than running a cron. Cheaper and simpler.
// ---------------------------------------------------------------------------

import prisma from "@/lib/db";

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfUtcDay(b) - startOfUtcDay(a)) / (24 * 60 * 60 * 1000));
}

/**
 * Bump the authenticated user's streak based on "now". Fire-and-forget
 * from API handlers — does not throw.
 *
 * @returns the updated streakDays value, or null if the user was not found.
 */
export async function bumpStreak(userId: string, now: Date = new Date()): Promise<number | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { streakDays: true, streakLastDayAt: true },
    });
    if (!user) return null;

    let nextStreak: number;
    if (!user.streakLastDayAt || user.streakDays <= 0) {
      nextStreak = 1;
    } else {
      const gap = daysBetween(user.streakLastDayAt, now);
      if (gap <= 0) {
        // Same calendar day — no change needed. Just update lastActivityAt
        // (the caller may or may not do that separately).
        await prisma.user.update({
          where: { id: userId },
          data: { lastActivityAt: now },
        });
        return user.streakDays;
      }
      nextStreak = gap === 1 ? user.streakDays + 1 : 1;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        streakDays: nextStreak,
        streakLastDayAt: now,
        lastActivityAt: now,
      },
    });
    return nextStreak;
  } catch (err) {
    console.warn("[streak] bump failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
