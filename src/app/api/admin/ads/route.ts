import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// ---------------------------------------------------------------------------
// GET /api/admin/ads?status=pending_review
//
// Lists ads for the admin queue. Defaults to status=pending_review.
// Allowed status filters: any AdStatus value, or "all".
// ---------------------------------------------------------------------------

const ALLOWED_STATUSES = new Set([
  "draft",
  "pending_payment",
  "pending_review",
  "approved",
  "rejected",
  "paused",
  "expired",
  "all",
]);

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }
  if (!isAdmin(auth.userId)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Admin access required" } },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") || "pending_review";
  if (!ALLOWED_STATUSES.has(statusParam)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INVALID_STATUS",
          message: `status must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}`,
        },
      },
      { status: 400 },
    );
  }

  try {
    const where = statusParam === "all" ? {} : { status: statusParam as "pending_review" };
    const ads = await prisma.businessAd.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        owner: { select: { id: true, displayName: true } },
      },
    });
    return NextResponse.json({ success: true, data: { ads, status: statusParam } });
  } catch (error) {
    console.error("[admin/ads GET] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load ads" } },
      { status: 500 },
    );
  }
}
