import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { dailySeries } from "@/lib/ad-events";

// ---------------------------------------------------------------------------
// GET /api/business/ads/:id/analytics?days=30
//
// Returns the per-day impression / click / CTR series for the caller's
// ad, plus top-line totals. Owner-only.
//
// Range: 1–90 days. Default 30. Series is oldest-first, includes empty
// days as zeros so the chart axis is regular.
// ---------------------------------------------------------------------------

const DEFAULT_DAYS = 30;
const MAX_DAYS = 90;

export async function GET(
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

  try {
    const ad = await prisma.businessAd.findUnique({
      where: { id: adId },
      select: {
        id: true,
        ownerId: true,
        title: true,
        status: true,
        impressions: true,
        clicks: true,
        priceMicroUsd: true,
        activatedAt: true,
        expiresAt: true,
        targetGlobalArea: true,
        targetRegion: true,
        targetInterests: true,
      },
    });
    if (!ad) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Ad not found" } },
        { status: 404 },
      );
    }
    if (ad.ownerId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not your ad" } },
        { status: 403 },
      );
    }

    const url = new URL(request.url);
    const daysRaw = Number(url.searchParams.get("days") ?? DEFAULT_DAYS);
    const days = Number.isFinite(daysRaw)
      ? Math.min(Math.max(1, Math.floor(daysRaw)), MAX_DAYS)
      : DEFAULT_DAYS;

    const series = await dailySeries(adId, days);

    const totalImpressions = ad.impressions;
    const totalClicks = ad.clicks;
    const ctr =
      totalImpressions > 0
        ? Math.round((totalClicks / totalImpressions) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        ad: {
          id: ad.id,
          title: ad.title,
          status: ad.status,
          activatedAt: ad.activatedAt,
          expiresAt: ad.expiresAt,
          targeting: {
            interests: Array.isArray(ad.targetInterests) ? ad.targetInterests : [],
            globalArea: ad.targetGlobalArea,
            region: ad.targetRegion,
          },
          spendMicroUsd: ad.priceMicroUsd,
        },
        totals: {
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr,
          spendMicroUsd: ad.priceMicroUsd,
        },
        series,
        rangeDays: days,
      },
    });
  } catch (error) {
    console.error("[business/ads/:id/analytics] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load analytics" } },
      { status: 500 },
    );
  }
}
