import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import {
  hashPassword,
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/auth/password-reset/confirm
//
// Body: { token: string, password: string }
//
// Redeems a password-reset token (single use). On success:
//   - updates the user's password hash
//   - marks the token usedAt
//   - invalidates any OTHER unused tokens for this user
//   - returns a fresh access + refresh token pair so the user is logged in
// ---------------------------------------------------------------------------

const IP_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

interface ConfirmBody {
  token?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as ConfirmBody;

    if (!body.token || !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "token and password are required" },
        },
        { status: 400 },
      );
    }

    if (body.password.length < 8) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" },
        },
        { status: 400 },
      );
    }

    // Rate limit by IP — an attacker who stole a token would try many.
    const ip = clientIpFromRequest(request);
    const ipLimit = await rateLimit(`pwreset-confirm:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ipLimit.retryAfterMs / 1000)) } },
      );
    }

    const tokenHash = createHash("sha256").update(body.token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_TOKEN", message: "Reset link is invalid or expired" },
        },
        { status: 400 },
      );
    }

    // Apply the update in a transaction so we can't end up with a new password
    // but an un-used token (or vice versa).
    const newHash = await hashPassword(body.password);

    const [, user] = await prisma.$transaction([
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newHash, lastActivityAt: new Date() },
        select: { id: true, displayName: true, accountTier: true },
      }),
      // Burn any other outstanding reset tokens for this user.
      prisma.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          NOT: { id: resetToken.id },
        },
        data: { usedAt: new Date() },
      }),
    ]);

    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, displayName: user.displayName, accountTier: user.accountTier },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("[password-reset/confirm] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 },
    );
  }
}
