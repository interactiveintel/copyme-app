// POST /api/calls/token — mint a LiveKit join token for a specific call.
//
// Body: { callId: string }
// Returns: { token, url, identity, room }
//
// Only the caller and callee can mint a token for the call they're
// party to. The token is short-lived (15min) so a leak doesn't grant
// indefinite room access.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCall } from "@/lib/calls";
import { mintCallToken, livekitWsUrl } from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  callId?: string;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.callId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS" } },
      { status: 400 },
    );
  }

  const call = await getCall(body.callId);
  if (!call) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  if (call.callerId !== auth.userId && call.calleeId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }
  // Terminal calls don't get fresh tokens — clients shouldn't be trying
  // to rejoin a hung-up room. If you want re-call, start a new Call.
  if (call.status !== "ringing" && call.status !== "accepted") {
    return NextResponse.json(
      { success: false, error: { code: "CALL_ENDED" } },
      { status: 422 },
    );
  }

  const url = livekitWsUrl();
  if (!url) {
    return NextResponse.json(
      { success: false, error: { code: "LIVEKIT_NOT_CONFIGURED", message: "Set NEXT_PUBLIC_LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET in Vercel env." } },
      { status: 503 },
    );
  }

  // Look up our own displayName so the in-call UI on the other side
  // shows a real name instead of a UUID.
  const me = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { displayName: true },
  });

  try {
    const token = await mintCallToken({
      userId: auth.userId,
      displayName: me?.displayName ?? "User",
      room: call.room,
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        url,
        identity: auth.userId,
        room: call.room,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "TOKEN_MINT_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
