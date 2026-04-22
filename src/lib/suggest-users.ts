import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// suggestUsers — fast deterministic "who should I message first?" suggestions.
//
// Approach: SQL-based interest-overlap scoring. Given the caller's interests
// (up to 7), find every other user with at least one overlapping interest,
// rank by overlap count, fall back to popular users when overlap is thin.
//
// Why not the LLM agent? The LLM agent at /api/agents/smart-match runs
// Claude on every request — too slow and too expensive to fire on every
// home-screen render. This deterministic path is for the "suggested for
// you" strip; the agent stays available for when the user explicitly
// taps "Find me deep matches".
//
// Filters applied:
//   - Excludes self
//   - Excludes users blocked by OR blocking the caller
//   - Excludes users who are already in the caller's contacts
//   - Limits to MAX_SUGGESTIONS (default 12)
// ---------------------------------------------------------------------------

const MAX_SUGGESTIONS = 12;
const FALLBACK_RECENT_DAYS = 30;

export interface SuggestedUser {
  id: string;
  displayName: string;
  accountTier: string;
  matchScore: number;
  sharedInterests: string[];
  interests: Array<{ slotNumber: number; interestText: string }>;
  lastActivityAt: string | null;
}

interface ScoredCandidate {
  user_id: string;
  shared_count: number;
}

export async function suggestUsersFor(userId: string, limit = MAX_SUGGESTIONS): Promise<SuggestedUser[]> {
  // Caller's interests — we compute Jaccard / overlap purely against these.
  const myInterests = await prisma.userInterest.findMany({
    where: { userId },
    select: { interestText: true },
  });
  const myInterestTexts = Array.from(new Set(myInterests.map((i) => i.interestText.toLowerCase())));

  // Build the exclusion set: users I've blocked OR users who blocked me OR
  // existing contacts. This stays small for any one user, so a parallel
  // fetch + Set-merge is cheaper than a CTE.
  const [blocksMade, blockedBy, contacts] = await Promise.all([
    prisma.userBlock.findMany({ where: { blockerId: userId }, select: { blockedId: true } }),
    prisma.userBlock.findMany({ where: { blockedId: userId }, select: { blockerId: true } }),
    prisma.contact.findMany({ where: { userId }, select: { contactId: true } }),
  ]);
  const excluded = new Set<string>([
    userId,
    ...blocksMade.map((b) => b.blockedId),
    ...blockedBy.map((b) => b.blockerId),
    ...contacts.map((c) => c.contactId),
  ]);

  // ----------------------------------------------------------------------
  // Path A: I have at least one interest → score by interest overlap.
  // ----------------------------------------------------------------------
  if (myInterestTexts.length > 0) {
    // Postgres array of my lowercased interests for the IN clause.
    // Prisma's $queryRaw with parameterized array works via Prisma.sql.
    const candidates = (await prisma.$queryRawUnsafe<ScoredCandidate[]>(
      `
      SELECT ui.user_id, COUNT(*)::int AS shared_count
      FROM user_interests ui
      WHERE LOWER(ui.interest_text) = ANY($1::text[])
        AND ui.user_id <> $2
      GROUP BY ui.user_id
      ORDER BY shared_count DESC
      LIMIT $3
      `,
      myInterestTexts,
      userId,
      limit * 3, // fetch wider so we have headroom after exclusion filter
    )).filter((c) => !excluded.has(c.user_id));

    if (candidates.length >= limit) {
      return await hydrate(candidates.slice(0, limit), myInterestTexts);
    }

    // Backfill with popular-recent if interest overlap was thin.
    const haveIds = new Set(candidates.map((c) => c.user_id));
    haveIds.forEach((id) => excluded.add(id));
    const filler = await fallbackPopular(excluded, limit - candidates.length);
    return await hydrate([...candidates, ...filler], myInterestTexts);
  }

  // ----------------------------------------------------------------------
  // Path B: zero interests → return active users from the last N days.
  // ----------------------------------------------------------------------
  const filler = await fallbackPopular(excluded, limit);
  return await hydrate(filler, myInterestTexts);
}

async function fallbackPopular(excluded: Set<string>, take: number): Promise<ScoredCandidate[]> {
  if (take <= 0) return [];
  const cutoff = new Date(Date.now() - FALLBACK_RECENT_DAYS * 24 * 60 * 60 * 1000);
  const rows = await prisma.user.findMany({
    where: {
      id: { notIn: Array.from(excluded) },
      OR: [{ lastActivityAt: { gte: cutoff } }, { lastActivityAt: null }],
    },
    orderBy: { createdAt: "desc" },
    take: take * 2,
    select: { id: true },
  });
  return rows
    .filter((r) => !excluded.has(r.id))
    .slice(0, take)
    .map((r) => ({ user_id: r.id, shared_count: 0 }));
}

async function hydrate(
  candidates: ScoredCandidate[],
  myInterestTexts: string[],
): Promise<SuggestedUser[]> {
  if (candidates.length === 0) return [];
  const ids = candidates.map((c) => c.user_id);
  const rows = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      displayName: true,
      accountTier: true,
      lastActivityAt: true,
      interests: { orderBy: { slotNumber: "asc" } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const my = new Set(myInterestTexts);

  return candidates
    .map((c): SuggestedUser | null => {
      const r = byId.get(c.user_id);
      if (!r) return null;
      const shared = r.interests
        .filter((i) => my.has(i.interestText.toLowerCase()))
        .map((i) => i.interestText);
      // Score: overlap count, with a small floor for fallback users so
      // they don't all collide on score=0 in the UI.
      const matchScore = c.shared_count > 0 ? c.shared_count : 0;
      return {
        id: r.id,
        displayName: r.displayName,
        accountTier: r.accountTier,
        matchScore,
        sharedInterests: shared,
        interests: r.interests.map((i) => ({
          slotNumber: i.slotNumber,
          interestText: i.interestText,
        })),
        lastActivityAt: r.lastActivityAt ? r.lastActivityAt.toISOString() : null,
      };
    })
    .filter((s): s is SuggestedUser => s !== null);
}
