import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getOrCreateReferralCode } from "@/lib/referral";
import { getReferralProgress } from "@/lib/referrals/rule-of-7";

// ---------------------------------------------------------------------------
// GET /api/users/me/referral/share
//
// Read-only — returns the caller's referral code, a deep link, a pre-formatted
// share text, and current progress toward the rule-of-7 promo grant.
//
// Does NOT trigger the promo grant; use the cron / explicit endpoint that
// calls `maybeAwardReferralPromo` for that.
// ---------------------------------------------------------------------------

function appBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://copyme1.com";
}

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const code = await getOrCreateReferralCode(auth.userId);
    if (!code) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 },
      );
    }

    const progress = await getReferralProgress(auth.userId);
    const deepLink = `${appBase()}/signup?ref=${encodeURIComponent(code)}`;
    const shareText = `I'm on CopyMe — communication that matters. Join me with my code: ${deepLink}`;

    return NextResponse.json({
      code,
      deepLink,
      shareText,
      qualifyingReferrals: progress.qualifyingReferrals,
      needed: progress.needed,
      freeDaysGranted: progress.freeDaysGranted,
      earnedAt: progress.earnedAt ? progress.earnedAt.toISOString() : null,
    });
  } catch (error) {
    console.error("[users/me/referral/share] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load referral share data" } },
      { status: 500 },
    );
  }
}
