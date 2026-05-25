import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { suggestUsersFor } from "@/lib/suggest-users";

// Auth-bound, per-user suggestion list (ranked by their interest overlap).
// Defensive force-dynamic so a future cache hint can't cross-pollinate.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/users/suggested?limit=12
//
// Cheap, deterministic, "who should I message first?" suggestions for the
// home screen. Returns ranked users by interest overlap with the caller,
// with a popular-recent fallback when overlap is thin.
//
// This is the FAST path — sub-100ms typical. For the LLM-driven "deep
// match" experience, use POST /api/agents/smart-match.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const suggestions = await suggestUsersFor(auth.userId, limit);
    return NextResponse.json({
      success: true,
      data: { suggestions, count: suggestions.length, limit },
    });
  } catch (error) {
    console.error("[users/suggested] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load suggestions" } },
      { status: 500 },
    );
  }
}
