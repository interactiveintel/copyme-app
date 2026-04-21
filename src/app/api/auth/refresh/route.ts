import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  verifyToken,
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
//
// Exchanges a valid refresh token for a new access + refresh token pair.
// Returns 401 if the refresh token is missing, expired, of the wrong type,
// or if the user no longer exists.
// ---------------------------------------------------------------------------

interface RefreshBody {
  refreshToken: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<RefreshBody>;

    if (!body.refreshToken || typeof body.refreshToken !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_REFRESH_TOKEN", message: "refreshToken is required" },
        },
        { status: 400 },
      );
    }

    // --- Verify token signature + expiry -----------------------------------
    let payload;
    try {
      payload = verifyToken(body.refreshToken);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token is invalid or expired" },
        },
        { status: 401 },
      );
    }

    // --- Require type:"refresh" (prevent access-as-refresh misuse) ---------
    if (payload.type !== "refresh") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "WRONG_TOKEN_TYPE", message: "Expected a refresh token" },
        },
        { status: 401 },
      );
    }

    // --- Ensure user still exists ------------------------------------------
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, displayName: true, accountTier: true },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "USER_NOT_FOUND", message: "Account no longer exists" },
        },
        { status: 401 },
      );
    }

    // --- Issue new token pair (rotation) -----------------------------------
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          accountTier: user.accountTier,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("[refresh] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 },
    );
  }
}
