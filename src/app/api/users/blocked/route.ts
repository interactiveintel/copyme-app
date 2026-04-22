import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/users/blocked
//
// Returns the list of users the caller has blocked, with a thin profile
// slice for the "Settings → Blocked users" management screen.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const rows = await prisma.userBlock.findMany({
      where: { blockerId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        reason: true,
        blocked: { select: { id: true, displayName: true, accountTier: true } },
      },
    });
    return NextResponse.json({
      success: true,
      data: {
        blocks: rows.map((r) => ({
          ...r.blocked,
          blockedAt: r.createdAt,
          reason: r.reason,
        })),
      },
    });
  } catch (error) {
    console.error("[users/blocked GET] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load blocks" } },
      { status: 500 },
    );
  }
}
