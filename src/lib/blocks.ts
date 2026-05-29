// Shared block-check helpers.
//
// UserBlock is directional (blocker → blocked) but every CopyMe read
// path treats blocks as mutually-invisible — if EITHER user has
// blocked the other, neither sees the other in contacts, messages,
// search results, or call routing. This module centralises the
// either-way check so feature paths can ask one question.

import { prisma } from "@/lib/db";

/**
 * True if either user has blocked the other.
 *
 * O(1) — one indexed query against user_blocks. The composite PK
 * (blocker_id, blocked_id) makes both directions fast.
 */
export async function isBlockedEitherWay(
  userA: string,
  userB: string,
): Promise<boolean> {
  if (userA === userB) return false;
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { blockerId: true },
  });
  return row !== null;
}

/**
 * Of the given candidate userIds, return only those who haven't been
 * blocked (either direction) relative to `me`. Used by group-call
 * creation to silently drop blocked invitees from the recipient list.
 *
 * One batched query — single round-trip regardless of candidate count.
 */
export async function filterUnblocked(
  me: string,
  candidates: string[],
): Promise<string[]> {
  const others = candidates.filter((id) => id && id !== me);
  if (others.length === 0) return [];
  const blocks = await prisma.userBlock.findMany({
    where: {
      OR: [
        { blockerId: me, blockedId: { in: others } },
        { blockerId: { in: others }, blockedId: me },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set<string>();
  for (const b of blocks) {
    blockedIds.add(b.blockerId === me ? b.blockedId : b.blockerId);
  }
  return others.filter((id) => !blockedIds.has(id));
}
