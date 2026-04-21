import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import prisma from "@/lib/db";
import {
  sendMail,
  passwordResetTemplate,
  buildPasswordResetUrl,
} from "@/lib/mailer";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/auth/password-reset/request
//
// Request body: { phone: string } OR { email: string }
//
// Always returns 200 with a generic message — we never reveal whether an
// account exists (prevents user enumeration). When a match is found we
// invalidate previous unused reset tokens for that user, generate a fresh
// one, and email the reset link.
// ---------------------------------------------------------------------------

const TOKEN_TTL_MINUTES = 60;
const IP_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface RequestBody {
  phone?: string;
  email?: string;
}

function hashIdentifier(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function generateTokenPair(): { raw: string; hash: string } {
  // 32 bytes of URL-safe randomness — 256 bits of entropy.
  const raw = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

const GENERIC_RESPONSE = NextResponse.json({
  success: true,
  data: {
    message:
      "If an account exists for that phone or email, a reset link has been sent.",
  },
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;

    if (!body.phone && !body.email) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "phone or email is required" },
        },
        { status: 400 },
      );
    }

    // Rate limit per IP — generous enough not to block a legitimate user
    // retrying, tight enough to blunt enumeration attempts.
    const ip = clientIpFromRequest(request);
    const ipLimit = rateLimit(`pwreset:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
      );
    }

    // Look up the user by whichever identifier was supplied.
    const where = body.phone
      ? { phoneHash: hashIdentifier(body.phone) }
      : { emailHash: hashIdentifier(body.email!) };

    const user = await prisma.user.findUnique({
      where,
      select: { id: true, displayName: true, emailHash: true },
    });

    // Short-circuit silently when no match. Do NOT leak whether the account
    // exists. The generic 200 is still returned.
    if (!user) return GENERIC_RESPONSE;

    // Invalidate any outstanding reset tokens for this user so only the most
    // recent link works.
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    // Generate and persist the new token (store only the sha256 hash).
    const { raw, hash } = generateTokenPair();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });

    // We store only the email HASH, so we can't email the user unless they
    // supplied an email in this request. When they sent a phone, fall back
    // to the provided email if any — otherwise we've still queued the token
    // and return success (operator can see the console-logged link in dev).
    const recipient = body.email;
    if (recipient) {
      const url = buildPasswordResetUrl(raw);
      const { subject, html, text } = passwordResetTemplate(url);
      // Intentionally don't await the mailer result for UX — but we DO await
      // to surface errors in logs. The generic response is returned anyway.
      const result = await sendMail({ to: recipient, subject, html, text });
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.warn("[password-reset] mail send failed:", result.error);
      }
    } else {
      // Phone-only path: log the raw link for developer / operator use.
      // Once SMS is integrated (Sprint 1.x), we'll send the link via SMS.
      // eslint-disable-next-line no-console
      console.log(
        `[password-reset] phone-only request for user ${user.id}. ` +
        `Reset link (deliver via SMS in a later sprint):\n  ${buildPasswordResetUrl(raw)}`,
      );
    }

    return GENERIC_RESPONSE;
  } catch (error) {
    console.error("[password-reset/request] error:", error);
    // Still return the generic success shape — don't leak internal errors.
    return GENERIC_RESPONSE;
  }
}
