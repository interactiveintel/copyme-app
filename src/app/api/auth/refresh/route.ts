// POST /api/auth/refresh — rotate access + refresh tokens (S-107).
//
// Single-use refresh: the previous refresh row is revoked and a new pair is
// issued. Replay (presenting an already-rotated token) is detected and the
// user is notified via a banner the next time the UI loads sessions.

import { NextRequest, NextResponse } from "next/server";
import { rotateRefresh } from "@/lib/sessions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface RefreshBody {
  refreshToken: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<RefreshBody>;
  if (!body.refreshToken || typeof body.refreshToken !== "string") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_REFRESH_TOKEN", message: "refreshToken is required" } },
      { status: 400 },
    );
  }

  const r = await rotateRefresh(body.refreshToken, {
    userAgent: request.headers.get("user-agent") ?? undefined,
    ip: request.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  if ("error" in r) {
    if (r.error === "REPLAY") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REFRESH_REPLAY",
            message: "This refresh token has already been used. All sessions have been alerted.",
          },
        },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token is invalid or expired" } },
      { status: 401 },
    );
  }

  // Bring back display name + tier so the client UI can stay in sync.
  const user = await prisma.user.findUnique({
    where: { id: (await prisma.session.findUnique({ where: { id: r.sessionId }, select: { userId: true } }))!.userId },
    select: { id: true, displayName: true, accountTier: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      user,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      sessionId: r.sessionId,
      deviceId: r.deviceId,
    },
  });
}
