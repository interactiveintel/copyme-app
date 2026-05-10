// Discovery anti-stalking heuristics (S-214).
//
// On top of the spam scorer (S-174), discovery introduces a distinct risk:
// a user who repeatedly first-contacts strangers via interest search.
// We cap "first-contact-from-search" sends to 7 per day for free users,
// and to 70/day for paid tiers.

import { prisma } from "@/lib/db";

const FREE_DAILY = 7;
const PAID_DAILY = 70;

export async function canFirstContactViaSearch(
  senderId: string,
  receiverId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const me = await prisma.user.findUnique({
    where: { id: senderId },
    select: { accountTier: true },
  });
  const cap = me?.accountTier === "basic" ? FREE_DAILY : PAID_DAILY;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  // Count first-contacts (no prior message in either direction) in the last day.
  const recents = await prisma.message.findMany({
    where: { senderId, createdAt: { gte: since } },
    select: { receiverId: true, createdAt: true },
  });
  const distinct = new Set<string>();
  for (const r of recents) distinct.add(r.receiverId);
  // The recipient itself must be first-contact (no prior conversation with them).
  const prior = await prisma.message.count({
    where: {
      OR: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    },
  });
  if (prior > 0) return { allowed: true, remaining: cap - distinct.size };
  return { allowed: distinct.size < cap, remaining: Math.max(0, cap - distinct.size - 1) };
}
