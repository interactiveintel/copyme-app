// POST /api/calls/[id]/mute-all — caller-only mute every participant.
//
// v4.15.15 (Tier E Sprint 6 polish): server-driven mute for the
// host of a group call. Participants can immediately unmute
// themselves — this is "lower the room" not a persistent mute lock.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getCall } from "@/lib/calls";
import { muteAllInRoom } from "@/lib/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const call = await getCall(id);
  if (!call) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND" } },
      { status: 404 },
    );
  }

  // Caller-only. Other participants can mute their own mic via the
  // existing CallSheet button; only the host can mute the room.
  if (call.callerId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Only the caller can mute the room" } },
      { status: 403 },
    );
  }

  // Aggregate call must be live (ringing or accepted) — refuse to
  // touch ended/missed/declined rooms.
  if (call.status !== "ringing" && call.status !== "accepted") {
    return NextResponse.json(
      { success: false, error: { code: "CALL_ENDED" } },
      { status: 422 },
    );
  }

  try {
    const result = await muteAllInRoom(call.room);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
