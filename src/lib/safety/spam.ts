// Anti-spam heuristics (S-174).
//
// Three signals scored independently:
//   1. send-rate          per-account messages/min beyond a threshold
//   2. novel-recipient    fraction of receivers the sender hasn't messaged before
//   3. link-density       fraction of words that are URLs
//
// Each returns a 0..1 score; the composite is the max of the three.
// Threshold for action lives in env (`COPYME_SPAM_THRESHOLD`, default 0.7).

import { prisma } from "@/lib/db";

const URL_RE = /https?:\/\/\S+|www\.\S+|\b\S+\.(com|net|org|io|app|me|co)(\/\S*)?\b/gi;

export interface SpamSignal {
  rateScore: number;
  noveltyScore: number;
  linkScore: number;
  composite: number;
  /** True when composite exceeds the action threshold. */
  isSpam: boolean;
}

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 12; // 12 msg/min before rateScore starts climbing
const RATE_HARDCAP = 30;

const NOVELTY_WINDOW_MS = 24 * 60 * 60 * 1000;
const NOVELTY_MIN_SAMPLE = 5;

const LINK_DENSITY_THRESHOLD = 0.4; // 40% of words are URLs

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export async function scoreSpam(
  senderId: string,
  receiverId: string,
  text: string,
): Promise<SpamSignal> {
  const now = new Date();
  const rateSince = new Date(now.getTime() - RATE_WINDOW_MS);
  const noveltySince = new Date(now.getTime() - NOVELTY_WINDOW_MS);

  const [recentSends, distinctReceivers, totalRecent] = await Promise.all([
    prisma.message.count({
      where: { senderId, createdAt: { gte: rateSince } },
    }),
    prisma.message
      .findMany({
        where: { senderId, createdAt: { gte: noveltySince } },
        select: { receiverId: true },
        distinct: ["receiverId"],
      })
      .then((rs) => rs.length),
    prisma.message.count({
      where: { senderId, createdAt: { gte: noveltySince } },
    }),
  ]);

  const rateScore =
    recentSends <= RATE_LIMIT
      ? 0
      : clamp01((recentSends - RATE_LIMIT) / (RATE_HARDCAP - RATE_LIMIT));

  const noveltyScore =
    totalRecent < NOVELTY_MIN_SAMPLE ? 0 : clamp01(distinctReceivers / totalRecent);

  const words = text.trim().split(/\s+/).filter(Boolean);
  const linkCount = (text.match(URL_RE) ?? []).length;
  const linkRatio = words.length === 0 ? 0 : linkCount / words.length;
  const linkScore = clamp01((linkRatio - LINK_DENSITY_THRESHOLD) / (1 - LINK_DENSITY_THRESHOLD));

  const composite = Math.max(rateScore, noveltyScore, linkScore);
  const threshold = Number(process.env.COPYME_SPAM_THRESHOLD ?? 0.7);

  // Touch-only of `receiverId` so future per-pair scoring can hang here.
  void receiverId;

  return {
    rateScore,
    noveltyScore,
    linkScore,
    composite,
    isSpam: composite >= threshold,
  };
}
