import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/business/upgrade
//
// Flips the authenticated user's profileType to "legal_entity" so the
// business surfaces (POST /api/business/ads, /admin/ads queue) accept
// them. Idempotent — calling on an already-business account just returns
// the current state.
//
// We deliberately don't add a separate auth flow for businesses; CopyMe
// is a single platform with an "advertiser hat" the user can put on.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: { profileType: "legal_entity" },
      select: { id: true, displayName: true, profileType: true, accountTier: true },
    });
    return NextResponse.json({ success: true, data: { user: updated } });
  } catch (error) {
    console.error("[business/upgrade] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to upgrade account" } },
      { status: 500 },
    );
  }
}
