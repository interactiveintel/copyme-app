import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getOrCreateReferralCode } from "@/lib/referral";

// ---------------------------------------------------------------------------
// GET /api/users/me/referral
//
// Returns the caller's referral code (lazily generated), how many users have
// signed up via it, and a ready-to-share invite URL.
// ---------------------------------------------------------------------------

function appBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://copyme-app.vercel.app";
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

    const invitedCount = await prisma.user.count({
      where: { referredById: auth.userId },
    });

    const inviteUrl = `${appBase()}/app?ref=${encodeURIComponent(code)}`;
    return NextResponse.json({
      success: true,
      data: { code, invitedCount, inviteUrl },
    });
  } catch (error) {
    console.error("[users/me/referral] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load referral status" } },
      { status: 500 },
    );
  }
}
