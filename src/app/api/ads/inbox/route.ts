import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/ads/inbox?category=for-you&limit=10
//
// Returns approved + unexpired ads for the consumer feed, ranked by:
//   1) interest overlap with the caller's interests (when targetInterests set)
//   2) recency of activation (newer first)
//
// Untargeted ads (targetInterests empty) are eligible for everyone but rank
// below targeted matches.
//
// The endpoint also bumps the `impressions` counter for each ad it returns,
// since rendering them on the home screen IS the impression. Sprint 10 will
// move this to a dedicated impression-event table for proper analytics.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 30;
const ALLOWED_CATEGORIES = new Set([
  "for-you",
  "trending",
  "learning",
  "lifestyle",
  "career",
  "entertainment",
]);

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  if (category && !ALLOWED_CATEGORIES.has(category) && category !== "all") {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_CATEGORY", message: "Unknown category" } },
      { status: 400 },
    );
  }

  try {
    // Caller's interests for matching.
    const myInterests = await prisma.userInterest.findMany({
      where: { userId: auth.userId },
      select: { interestText: true },
    });
    const myInterestSet = new Set(myInterests.map((i) => i.interestText.toLowerCase()));

    const now = new Date();
    const ads = await prisma.businessAd.findMany({
      where: {
        status: "approved",
        OR: [{ expiresAt: { gt: now } }, { expiresAt: null }],
        ...(category && category !== "all" && category !== "for-you"
          ? { category }
          : {}),
      },
      orderBy: { activatedAt: "desc" },
      take: limit * 3, // fetch wider so we have headroom after scoring
    });

    // Rank: targeted matches (more shared interests = higher) first, then
    // untargeted by recency.
    const scored = ads.map((ad) => {
      const targets = Array.isArray(ad.targetInterests)
        ? (ad.targetInterests as string[]).map((t) => t.toLowerCase())
        : [];
      const sharedCount = targets.filter((t) => myInterestSet.has(t)).length;
      // Targeted ads with no overlap rank below untargeted ads (we shouldn't
      // show "tech jobs" to a user whose only interests are cooking + music).
      const untargeted = targets.length === 0;
      const score = untargeted ? 0.5 : sharedCount;
      return { ad, score, untargeted, sharedCount };
    });

    // Drop targeted ads with zero overlap.
    const eligible = scored.filter((s) => s.untargeted || s.sharedCount > 0);
    eligible.sort((a, b) => b.score - a.score);

    const top = eligible.slice(0, limit);

    // Bump impressions, fire-and-forget.
    if (top.length > 0) {
      const ids = top.map((s) => s.ad.id);
      void prisma.businessAd
        .updateMany({
          where: { id: { in: ids } },
          data: { impressions: { increment: 1 } },
        })
        .catch(() => {});
    }

    return NextResponse.json({
      success: true,
      data: {
        ads: top.map((s) => ({
          id: s.ad.id,
          brand: s.ad.brand,
          title: s.ad.title,
          tagline: s.ad.tagline,
          body: s.ad.body,
          imageUrl: s.ad.imageUrl,
          ctaLabel: s.ad.ctaLabel,
          ctaUrl: s.ad.ctaUrl,
          category: s.ad.category,
          sharedInterests: Array.isArray(s.ad.targetInterests)
            ? (s.ad.targetInterests as string[]).filter((t) =>
                myInterestSet.has(t.toLowerCase()),
              )
            : [],
        })),
        count: top.length,
      },
    });
  } catch (error) {
    console.error("[ads/inbox] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load ads" } },
      { status: 500 },
    );
  }
}
