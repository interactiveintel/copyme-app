// ---------------------------------------------------------------------------
// Pitch (investor data room) password gate.
//
// Single shared password, supplied in `?key=` query param OR `x-pitch-password`
// header. Constant-time compare. We deliberately don't tie this to a user
// account — the investor doesn't have one, and rotation is one env-var change.
// ---------------------------------------------------------------------------

import { timingSafeEqual } from "crypto";

export function isPitchUnlocked(supplied: string | null | undefined): boolean {
  const pw = process.env.PITCH_PASSWORD;
  if (!pw || !supplied) return false;
  // Equal-length buffers required by timingSafeEqual; quick length check
  // bails early without revealing length via timing.
  if (supplied.length !== pw.length) return false;
  try {
    return timingSafeEqual(Buffer.from(supplied), Buffer.from(pw));
  } catch {
    return false;
  }
}

export function isPitchConfigured(): boolean {
  return !!process.env.PITCH_PASSWORD;
}
