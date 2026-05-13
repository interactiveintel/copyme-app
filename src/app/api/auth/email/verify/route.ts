import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { sendMail, welcomeTemplate } from "@/lib/mailer";

// ---------------------------------------------------------------------------
// POST /api/auth/email/verify
//
// Body: { token: string }
//
// Redeems a verification token. On success, sets users.email_verified_at
// and returns basic user info (caller is typically an authenticated client
// calling from the /verify page).
// ---------------------------------------------------------------------------

const IP_LIMIT = 30;
const IP_WINDOW_MS = 60 * 60 * 1000;

interface VerifyBody {
  token?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as VerifyBody;

    if (!body.token) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "token is required" },
        },
        { status: 400 },
      );
    }

    const ip = clientIpFromRequest(request);
    const limit = await rateLimit(`verify:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
      );
    }

    const tokenHash = createHash("sha256").update(body.token).digest("hex");

    const token = await prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        email: true,
        expiresAt: true,
        verifiedAt: true,
      },
    });

    if (!token || token.verifiedAt || token.expiresAt < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_TOKEN", message: "Verification link is invalid or expired" },
        },
        { status: 400 },
      );
    }

    // Capture the pre-update verifiedAt so we know whether this is the
    // user's FIRST email verification (welcome-email trigger) vs. a
    // re-verification after an email change.
    const userBefore = await prisma.user.findUnique({
      where: { id: token.userId },
      select: { emailVerifiedAt: true },
    });
    const isFirstVerification = !userBefore?.emailVerifiedAt;

    const now = new Date();
    const [, user] = await prisma.$transaction([
      prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { verifiedAt: now },
      }),
      prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: now },
        select: { id: true, displayName: true, emailVerifiedAt: true },
      }),
    ]);

    // Welcome-email trigger — only on first verification + only if we have
    // a deliverable address on the token row (older in-flight tokens may
    // pre-date the email column from migration 20260513050000).
    // Best-effort: never fail verification because the welcome failed.
    if (isFirstVerification && token.email) {
      const appHref =
        process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/app`
          : "https://copyme1.com/app";
      const { subject, text, html } = welcomeTemplate(user.displayName, appHref);
      sendMail({ to: token.email, subject, text, html }).catch((err) => {
        console.warn("[verify] welcome email failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          emailVerifiedAt: user.emailVerifiedAt,
        },
      },
    });
  } catch (error) {
    console.error("[verify] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 },
    );
  }
}
