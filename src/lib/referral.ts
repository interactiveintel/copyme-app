import { randomBytes } from "crypto";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// Referral codes.
//
// We use base32-style 8-char codes (URL-safe, easy to type / copy out of an
// SMS). Generated lazily on first read — most users will never have one.
// On collision we retry once with a fresh random; if that also collides
// (cosmically unlikely), the caller gets the existing code and moves on.
// ---------------------------------------------------------------------------

const CODE_LEN = 8;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion

function generateCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[buf[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * Get-or-create the user's referral code. Idempotent.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (!u) return null;
  if (u.referralCode) return u.referralCode;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    try {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      return updated.referralCode;
    } catch {
      // Unique-constraint collision; retry with a new code.
    }
  }
  return null;
}

/**
 * Resolve a referral code to a user ID. Returns null on miss or self-ref.
 */
export async function resolveReferralCode(
  code: string | null | undefined,
  ignoreUserId?: string,
): Promise<string | null> {
  if (!code) return null;
  const cleaned = code.trim().toUpperCase().slice(0, 16);
  if (!cleaned) return null;
  const u = await prisma.user.findUnique({
    where: { referralCode: cleaned },
    select: { id: true },
  });
  if (!u) return null;
  if (ignoreUserId && u.id === ignoreUserId) return null;
  return u.id;
}
