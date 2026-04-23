import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";

// ---------------------------------------------------------------------------
// POST /api/admin/ads/:id
//
// Single endpoint for the moderation actions:
//   { action: "approve" }                              → status=approved + activatedAt
//   { action: "reject", reason?: string }              → status=rejected
//   { action: "pause" }                                → status=paused (active ads)
//   { action: "resume" }                               → status=approved (paused ads)
//
// Approved ads expire 30 days after activation.
// ---------------------------------------------------------------------------

const APPROVED_TTL_DAYS = 30;

interface ModerateBody {
  action?: "approve" | "reject" | "pause" | "resume";
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: adId } = await params;
  let body: ModerateBody;
  try {
    body = (await request.json()) as ModerateBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_BODY", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const ad = await prisma.businessAd.findUnique({ where: { id: adId } });
  if (!ad) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Ad not found" } },
      { status: 404 },
    );
  }

  const now = new Date();
  const reviewer = { reviewedById: auth.userId, reviewedAt: now };

  try {
    if (body.action === "approve") {
      if (ad.status !== "pending_review") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATE",
              message: `Can only approve ads in pending_review. Current: ${ad.status}.`,
            },
          },
          { status: 409 },
        );
      }
      const expiresAt = new Date(now.getTime() + APPROVED_TTL_DAYS * 24 * 60 * 60 * 1000);
      const updated = await prisma.businessAd.update({
        where: { id: ad.id },
        data: {
          status: "approved",
          activatedAt: now,
          expiresAt,
          rejectionReason: null,
          ...reviewer,
        },
      });
      return NextResponse.json({ success: true, data: { ad: updated } });
    }

    if (body.action === "reject") {
      if (ad.status !== "pending_review") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATE",
              message: `Can only reject ads in pending_review. Current: ${ad.status}.`,
            },
          },
          { status: 409 },
        );
      }
      const updated = await prisma.businessAd.update({
        where: { id: ad.id },
        data: {
          status: "rejected",
          rejectionReason: body.reason?.slice(0, 300) || null,
          ...reviewer,
        },
      });
      return NextResponse.json({ success: true, data: { ad: updated } });
    }

    if (body.action === "pause") {
      if (ad.status !== "approved") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATE",
              message: `Can only pause approved ads. Current: ${ad.status}.`,
            },
          },
          { status: 409 },
        );
      }
      const updated = await prisma.businessAd.update({
        where: { id: ad.id },
        data: { status: "paused", ...reviewer },
      });
      return NextResponse.json({ success: true, data: { ad: updated } });
    }

    if (body.action === "resume") {
      if (ad.status !== "paused") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "INVALID_STATE",
              message: `Can only resume paused ads. Current: ${ad.status}.`,
            },
          },
          { status: 409 },
        );
      }
      const updated = await prisma.businessAd.update({
        where: { id: ad.id },
        data: { status: "approved", ...reviewer },
      });
      return NextResponse.json({ success: true, data: { ad: updated } });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BAD_ACTION",
          message: "action must be one of: approve, reject, pause, resume",
        },
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("[admin/ads/:id POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update ad" } },
      { status: 500 },
    );
  }
}
