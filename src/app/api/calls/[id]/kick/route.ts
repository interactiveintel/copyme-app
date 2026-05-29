// POST /api/calls/[id]/kick — caller-only kick a participant.
//
// Body: { userId: string }
//
// Two-step:
//   1. Remove from the LiveKit room (severs the media connection)
//   2. Mark their CallParticipant row as "left" so they can't rejoin
//      via /api/calls/token (which checks isCallParticipant)
//
// v4.15.15 (Tier E Sprint 6 polish).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCall } from "@/lib/calls";
import { kickFromRoom } from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  userId?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.userId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "userId required" } },
      { status: 400 },
    );
  }

  const call = await getCall(id);
  if (!call) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }
  if (call.callerId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only the caller can kick" } },
      { status: 403 },
    );
  }
  // Can't kick yourself, and can't kick the caller (you).
  if (body.userId === call.callerId || body.userId === auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_TARGET" } },
      { status: 400 },
    );
  }
  if (call.status !== "ringing" && call.status !== "accepted") {
    return NextResponse.json(
      { success: false, error: { code: "CALL_ENDED" } },
      { status: 422 },
    );
  }

  // Two-step: DB first (so they can't rejoin via the token route),
  // then LiveKit (so their current connection is severed). Order
  // matters — if LiveKit fails after DB success, the user is already
  // locked out of the call and the room boot is a best-effort cleanup.
  try {
    const result = await prisma.callParticipant.updateMany({
      where: {
        callId: call.id,
        userId: body.userId,
        status: { in: ["ringing", "accepted"] },
      },
      data: { status: "left", leftAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Not a current participant" } },
        { status: 404 },
      );
    }
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }

  // Best-effort LiveKit boot. Failure here doesn't undo the DB
  // status — the user is already locked out of token mint.
  try {
    await kickFromRoom(call.room, body.userId);
  } catch (err) {
    return NextResponse.json({
      success: true,
      data: { kicked: true, livekitBootError: err instanceof Error ? err.message : String(err) },
    });
  }

  return NextResponse.json({ success: true, data: { kicked: true } });
}
