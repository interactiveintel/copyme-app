import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { recordClick } from "@/lib/ad-events";

// ---------------------------------------------------------------------------
// POST /api/ads/:id/click
//
// Records a click event for a real BusinessAd and returns the destination
// URL. The client uses the returned URL to navigate (we don't 302 because
// the click flow is initiated from a fetch — a redirect would land the
// JSON consumer somewhere unexpected).
//
// Idempotency: a single user can rage-click; we count every click. The
// advertiser's CTR is calibrated to total clicks against total
// impressions, both fired from the same client surface.
//
// Mock ad ids (e.g. "ad1", "ad2") that come from the InboxScreen mock
// array are silently ignored — they don't exist in the DB. The caller
// should still navigate to the URL the mock object provided.
// ---------------------------------------------------------------------------

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

  const { id: adId } = await params;
  if (!adId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "ad id required" } },
      { status: 400 },
    );
  }

  // UUID format check — anything else is a mock id.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adId);
  if (!isUuid) {
    return NextResponse.json({
      success: true,
      data: { mock: true, ctaUrl: null },
    });
  }

  try {
    const ad = await prisma.businessAd.findUnique({
      where: { id: adId },
      select: { id: true, status: true, ctaUrl: true, expiresAt: true },
    });
    if (!ad) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Ad not found" } },
        { status: 404 },
      );
    }

    // Only count clicks against ads that are actually being served.
    const isLive =
      ad.status === "approved" && (!ad.expiresAt || ad.expiresAt > new Date());
    if (isLive) {
      // Fire-and-forget — return fast so the user gets the redirect.
      void recordClick(adId).catch((err) => {
        console.warn("[ads/click] recordClick failed:", err instanceof Error ? err.message : err);
      });
    }

    return NextResponse.json({
      success: true,
      data: { ctaUrl: ad.ctaUrl, recorded: isLive },
    });
  } catch (error) {
    console.error("[ads/click] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to record click" } },
      { status: 500 },
    );
  }
}
