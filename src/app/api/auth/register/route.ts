import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { hashPassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { validateDisplayName } from "@/lib/ruleOf7";
import { issueEmailVerification } from "@/lib/email-verification";
// Welcome email is now sent by /api/auth/email/verify on first
// verification — see migration 20260513050000_email_verify_token_email
// and src/lib/email-verification.ts. Keeping the import slot here as a
// breadcrumb if a future flow needs to re-add a signup-time email.
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";
import { resolveReferralCode } from "@/lib/referral";
import {
  betaInviteRequired,
  validateInviteCode,
  redeemInviteCode,
} from "@/lib/invite-code";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
// v4.16.6 (F6a follow-up): auto-default VAP currency by phone country
// code so EU signups don't land in USD with no signal of why.
import { currencyForPhone } from "@/lib/phone-currency";

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

interface RegisterBody {
  displayName: string;
  phone: string;
  email?: string;
  password: string;
  /** Optional referral code from a friend's invite link. */
  ref?: string;
  /** Beta invite code (required when BETA_INVITE_REQUIRED). */
  inviteCode?: string;
}

export async function POST(request: NextRequest) {
  try {
    // --- Per-IP rate limit: 5 signups/minute --------------------------------
    // Stops automated account creation from a single source. Runs before
    // any parse/DB work so a flooded IP burns minimal CPU.
    const ip = clientIpFromRequest(request);
    const rl = await rateLimit(`register:ip:${ip}`, 5, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
        { status: 429 },
      );
    }

    const body = (await request.json()) as RegisterBody;

    // --- Validate required fields -------------------------------------------
    if (!body.displayName || !body.phone || !body.password) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "displayName, phone, and password are required" } },
        { status: 400 },
      );
    }

    // --- Validate display name (Rule of 7) ----------------------------------
    const nameCheck = validateDisplayName(body.displayName);
    if (!nameCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_DISPLAY_NAME", message: nameCheck.error! } },
        { status: 400 },
      );
    }

    // --- Validate password length -------------------------------------------
    if (body.password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } },
        { status: 400 },
      );
    }

    // --- Beta gate (v4.12.0) ------------------------------------------------
    // Check the invite code BEFORE any DB writes (duplicate scan, hash) so
    // a bad code returns fast.
    let inviteCodeId: string | null = null;
    if (betaInviteRequired()) {
      if (!body.inviteCode) {
        return NextResponse.json(
          { success: false, error: { code: "INVITE_CODE_REQUIRED", message: "An invite code is required during beta." } },
          { status: 403 },
        );
      }
      const v = await validateInviteCode(body.inviteCode);
      if (!v.valid) {
        return NextResponse.json(
          { success: false, error: { code: "INVITE_CODE_INVALID", message: `Invite code rejected (${v.reason}).` } },
          { status: 403 },
        );
      }
      inviteCodeId = v.codeId;
    }

    // --- Hash identifiers for uniqueness ------------------------------------
    const phoneHash = createHash("sha256").update(body.phone).digest("hex");
    const emailHash = body.email
      ? createHash("sha256").update(body.email).digest("hex")
      : null;

    // --- Check for duplicates -----------------------------------------------
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneHash },
          ...(emailHash ? [{ emailHash }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_USER", message: "A user with this phone or email already exists" } },
        { status: 409 },
      );
    }

    // --- Hash password ------------------------------------------------------
    const passwordHash = await hashPassword(body.password);

    // --- Resolve optional referral code -------------------------------------
    // We resolve before user creation so we can stamp `referredById` atomically.
    // Self-referral guard isn't needed here (no userId yet) — the resolver
    // handles it on subsequent /me calls.
    const referredById = await resolveReferralCode(body.ref);

    // --- Create user --------------------------------------------------------
    // v4.16.6 (F6a follow-up): seed preferredCurrency from the phone's
    // E.164 country code. Eurozone phones → EUR; everything else stays
    // USD. The user can still flip it later in Profile → Settings.
    const seededCurrency = currencyForPhone(body.phone);
    const user = await prisma.user.create({
      data: {
        displayName: body.displayName,
        phoneHash,
        emailHash,
        passwordHash,
        referredById,
        preferredCurrency: seededCurrency,
      },
      select: {
        id: true,
        displayName: true,
        accountTier: true,
        createdAt: true,
      },
    });

    // --- Redeem invite code -------------------------------------------------
    // Best-effort same as phone/complete: a race that loses on increment
    // doesn't undo the signup.
    if (inviteCodeId) {
      redeemInviteCode(inviteCodeId, user.id).catch((err) => {
        console.warn("[register] invite-code redeem race:", err instanceof Error ? err.message : err);
      });
    }

    // --- Fire verification email (non-blocking best-effort) ---------------
    // The welcome email is deferred to first verification (see
    // /api/auth/email/verify) so it only goes to a confirmed deliverable
    // address — same trigger fires for phone-first signups when they later
    // verify their email.
    if (body.email) {
      issueEmailVerification(user.id, body.email).catch((err) => {
        console.warn("[register] verification email failed:", err);
      });
    }

    // --- Analytics: signup ------------------------------------------------
    capture(user.id, ANALYTICS_EVENTS.Signup, {
      hasEmail: Boolean(body.email),
      accountTier: user.accountTier,
    });

    // --- Generate tokens ----------------------------------------------------
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            displayName: user.displayName,
          },
          accessToken,
          refreshToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[register] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
