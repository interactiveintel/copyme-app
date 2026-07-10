// POST /api/auth/password-reset/verify-otp — v4.16.19.
//
// Completes a phone-path password reset: the user requested a reset
// with their phone number (/api/auth/password-reset/request sent a
// Twilio Verify SMS code), and now submits { phone, code, password }.
// On success we set the new password, burn any outstanding email
// reset tokens, and sign the user in with a DB-backed session.
//
// Anti-enumeration: a wrong code returns OTP-specific errors (the
// caller already proved they hold the phone by receiving the SMS),
// but a code-valid request for a nonexistent account returns the
// same INVALID_CODE shape — we never confirm account existence.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { issueSession } from "@/lib/sessions";
import { verifyOtp } from "@/lib/otp";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

const IP_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface Body {
  phone?: string;
  code?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body;

    if (!body.phone || !body.code || !body.password) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "phone, code, and password are required" } },
        { status: 400 },
      );
    }
    if (!/^\d{4,8}$/.test(body.code)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CODE", message: "Code must be the digits from the SMS" } },
        { status: 400 },
      );
    }
    if (body.password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } },
        { status: 400 },
      );
    }

    const ip = clientIpFromRequest(request);
    const rl = await rateLimit(`pwreset:otp:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." } },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }

    // Verify the SMS code first — this consumes it on success, so a
    // nonexistent-account probe still burns the attacker's own OTP.
    const otp = await verifyOtp(body.phone, body.code);
    if (!otp.ok) {
      const message =
        otp.reason === "EXPIRED" ? "Code expired — request a new one."
        : otp.reason === "MAX_ATTEMPTS" ? "Too many wrong attempts — request a new code."
        : otp.reason === "NO_OTP" ? "No code pending for this number — request a reset first."
        : "Wrong code. Check the SMS and try again.";
      return NextResponse.json(
        { success: false, error: { code: otp.reason ?? "WRONG_CODE", message } },
        { status: 401 },
      );
    }

    // Same normalization the login/register routes use: sha256 of the
    // raw phone string the client sends (E.164).
    const phoneHash = createHash("sha256").update(body.phone).digest("hex");
    const user = await prisma.user.findUnique({
      where: { phoneHash },
      select: { id: true, displayName: true, accountTier: true },
    });
    if (!user) {
      // Code was real (they own the phone) but no account exists.
      // Return the generic invalid shape rather than confirming.
      return NextResponse.json(
        { success: false, error: { code: "INVALID_CODE", message: "Couldn't reset with that code." } },
        { status: 401 },
      );
    }

    const newHash = await hashPassword(body.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, lastActivityAt: new Date() },
      }),
      // Burn any outstanding email reset links for this user — only
      // one credential-reset credential may be live at a time.
      prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);

    const tokens = await issueSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ip,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, displayName: user.displayName, accountTier: user.accountTier },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (error) {
    console.error("[password-reset/verify-otp] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
