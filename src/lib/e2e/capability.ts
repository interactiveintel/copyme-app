// ---------------------------------------------------------------------------
// E2E capability check — v4.16.9 (Sprint 8 skeleton)
// ---------------------------------------------------------------------------
//
// "Has this user published a Signal pre-key bundle?" → boolean.
//
// Used by:
//   - /api/messages/send (future Tier S wiring) to decide whether the
//     recipient can receive E2E ciphertext.
//   - ChatScreen header (future) to render a lock icon when the pair
//     is encryption-capable on both sides.
//
// Resolution is cheap (single column scan). Cache layer can be added
// later if it shows up on traces.
// ---------------------------------------------------------------------------

import prisma from "@/lib/db";

export interface E2ECapability {
  userId: string;
  enabled: boolean;
  /** Stable registration ID for the user's device install, or null. */
  registrationId: number | null;
}

export async function getE2ECapability(userId: string): Promise<E2ECapability> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, e2ePublicBundle: true, e2eRegistrationId: true },
  });
  if (!row) {
    return { userId, enabled: false, registrationId: null };
  }
  return {
    userId: row.id,
    enabled: !!row.e2ePublicBundle && row.e2eRegistrationId != null,
    registrationId: row.e2eRegistrationId,
  };
}

/**
 * Convenience: are BOTH sides of a 1:1 conversation E2E-capable?
 * Future Tier S work will gate send-time encryption on this returning
 * true for the (sender, receiver) pair.
 */
export async function pairE2EReady(
  userIdA: string,
  userIdB: string,
): Promise<boolean> {
  const [a, b] = await Promise.all([
    getE2ECapability(userIdA),
    getE2ECapability(userIdB),
  ]);
  return a.enabled && b.enabled;
}
