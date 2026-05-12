import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db";
import {
  sendMail,
  emailVerificationTemplate,
  buildEmailVerificationUrl,
} from "@/lib/mailer";

const TOKEN_TTL_HOURS = 24;

/**
 * Create an email-verification token for the given user, invalidate any
 * previous unused tokens, and send the verification email to the supplied
 * address. Returns the raw token for dev-mode logging.
 *
 * Caller is responsible for providing a real email address (we only store
 * hashes, so it must come from the client at request time).
 */
export async function issueEmailVerification(
  userId: string,
  email: string,
): Promise<{ sent: boolean; error?: string }> {
  // Burn previous unused tokens so only the latest link works.
  await prisma.emailVerificationToken.updateMany({
    where: { userId, verifiedAt: null },
    data: { verifiedAt: null, expiresAt: new Date(0) }, // force-expire
  });

  const raw = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.emailVerificationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  const url = buildEmailVerificationUrl(raw);
  const { subject, html, text } = emailVerificationTemplate(url);
  const result = await sendMail({ to: email, subject, html, text });

  if (!result.ok) {
     
    console.warn("[email-verification] send failed:", result.error, " url:", url);
    return { sent: false, error: result.error };
  }
  return { sent: true };
}
