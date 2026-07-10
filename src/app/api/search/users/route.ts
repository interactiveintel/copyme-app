import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getSearchLimit } from "@/lib/ruleOf7";
import { dialCodesForQuery } from "@/lib/search-country";

// ---------------------------------------------------------------------------
// POST /api/search/users
// ---------------------------------------------------------------------------

interface SearchBody {
  query: string;
  filters?: {
    nearMe?: boolean;
    sameInterests?: boolean;
    category?: string;
    /** v4.15.14 (F4): time-window filter from Joze's feedback. When
     *  set, results are restricted to users with lastActivityAt within
     *  the given days. */
    withinDays?: number;
  };
  aiMode?: boolean;
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as SearchBody;

    if (!body.query || body.query.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_QUERY", message: "Search query is required" } },
        { status: 400 },
      );
    }

    // --- Get user tier for result limits ------------------------------------
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        accountTier: true,
        location: true,
        interests: true,
      },
    });

    const tier = currentUser?.accountTier ?? "basic";
    const limit = getSearchLimit(tier);

    // --- Exclude blocked users (both directions) ---------------------------
    const [blocksMade, blockedBy] = await Promise.all([
      prisma.userBlock.findMany({ where: { blockerId: auth.userId }, select: { blockedId: true } }),
      prisma.userBlock.findMany({ where: { blockedId: auth.userId }, select: { blockerId: true } }),
    ]);
    const excludedIds = Array.from(
      new Set([
        auth.userId,
        ...blocksMade.map((b) => b.blockedId),
        ...blockedBy.map((b) => b.blockerId),
      ]),
    );

    // --- Build where conditions ---------------------------------------------
    // Phase 1: simple ILIKE search across display name, interests, location,
    // and description fields. Elasticsearch integration planned for Phase 2.

    // v4.15.14 (F4): optional active-since cutoff. Filters out users
    // who haven't shown lastActivity within the window. Joze's ask was
    // "history of last day, last week, last month, last year" — this
    // is the same axis applied to user discovery.
    const activeSinceCutoff =
      typeof body.filters?.withinDays === "number" && body.filters.withinDays > 0
        ? new Date(Date.now() - body.filters.withinDays * 86_400_000)
        : null;

    // v4.16.23: does the query name a country? → dial codes to match
    // against location.countryPhoneCode ("+1", "+386", ...).
    const queryDialCodes = dialCodesForQuery(body.query);

    const users = await prisma.user.findMany({
      where: {
        id: { notIn: excludedIds }, // Exclude self + blocked
        ...(activeSinceCutoff
          ? { lastActivityAt: { gte: activeSinceCutoff } }
          : {}),
        OR: [
          { displayName: { contains: body.query.trim(), mode: "insensitive" } },
          {
            interests: {
              some: {
                interestText: { contains: body.query.trim(), mode: "insensitive" },
              },
            },
          },
          {
            location: {
              OR: [
                { globalArea: { contains: body.query.trim(), mode: "insensitive" } },
                { region: { contains: body.query.trim(), mode: "insensitive" } },
                { cityZip: { contains: body.query.trim(), mode: "insensitive" } },
                { localDescription: { contains: body.query.trim(), mode: "insensitive" } },
                // v4.16.23: country-name search. The DB stores the
                // country as a dial code ("+1"), so "United States"
                // can never string-match a column — resolve the query
                // to dial codes first (lib/search-country.ts).
                ...(queryDialCodes.length > 0
                  ? [{ countryPhoneCode: { in: queryDialCodes } }]
                  : []),
              ],
            },
          },
          {
            descriptions: {
              some: {
                OR: [
                  { institution: { contains: body.query.trim(), mode: "insensitive" } },
                  { typeDescription: { contains: body.query.trim(), mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      take: limit,
      select: {
        id: true,
        displayName: true,
        profileType: true,
        accountTier: true,
        location: {
          select: {
            globalArea: true,
            region: true,
            cityZip: true,
            locationVisible: true,
          },
        },
        interests: {
          select: { interestText: true },
          orderBy: { slotNumber: "asc" },
        },
      },
    });

    // --- Compute simple relevance score -------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results = users.map((user: any) => {
      let relevanceScore = 0;
      const queryLower = body.query.trim().toLowerCase();

      // Display name match
      if (user.displayName.toLowerCase().includes(queryLower)) {
        relevanceScore += 10;
      }

      // Interest match
      const interestMatch = user.interests.some((i: { interestText: string }) =>
        i.interestText.toLowerCase().includes(queryLower),
      );
      if (interestMatch) relevanceScore += 5;

      // Location match
      if (user.location?.locationVisible) {
        const locationFields = [
          user.location.globalArea,
          user.location.region,
          user.location.cityZip,
        ];
        if (locationFields.some((f: string | null | undefined) => f?.toLowerCase().includes(queryLower))) {
          relevanceScore += 3;
        }
      }

      // Filter out hidden location data
      const location =
        user.location?.locationVisible
          ? {
              globalArea: user.location.globalArea,
              region: user.location.region,
              cityZip: user.location.cityZip,
            }
          : null;

      return {
        id: user.id,
        displayName: user.displayName,
        profileType: user.profileType,
        location,
        interests: user.interests.map((i: { interestText: string }) => i.interestText),
        relevanceScore,
      };
    });

    // Sort by relevance score descending
    results.sort((a: { relevanceScore: number }, b: { relevanceScore: number }) => b.relevanceScore - a.relevanceScore);

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: results.length,
        limit,
        aiMode: body.aiMode ?? false,
      },
    });
  } catch (error) {
    console.error("[search/users] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
