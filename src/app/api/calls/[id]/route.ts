// PATCH /api/calls/[id] — update call status (accept/decline/end/etc).
// GET   /api/calls/[id] — fetch a single call (used by the caller's
//                         "is the callee picking up?" poll).
//
// Body for PATCH:
//   { action: "accept" | "decline" | "miss" | "end" | "fail" }
//
// Auth: only the caller or callee can touch the row.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getCall, updateCallStatus, type CallStatus } from "@/lib/calls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_TO_STATUS: Record<string, Exclude<CallStatus, "ringing">> = {
  accept: "accepted",
  decline: "declined",
  miss: "missed",
  end: "ended",
  fail: "failed",
};

interface PatchBody {
  action?: keyof typeof ACTION_TO_STATUS;
}

export async function PATCH(
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
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const next = body.action ? ACTION_TO_STATUS[body.action] : undefined;
  if (!next) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_ACTION" } },
      { status: 400 },
    );
  }

  const result = await updateCallStatus({
    callId: id,
    actorId: auth.userId,
    next,
  });

  if (!result.ok) {
    const status =
      result.reason === "NOT_FOUND" ? 404 :
      result.reason === "FORBIDDEN" ? 403 :
      result.reason === "ALREADY_TERMINAL" ? 422 :
      500;
    return NextResponse.json(
      { success: false, error: { code: result.reason } },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      callId: id,
      status: result.status,
      durationSeconds: result.durationSeconds,
    },
  });
}

export async function GET(
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
  if (call.callerId !== auth.userId && call.calleeId !== auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }
  return NextResponse.json({ success: true, data: call });
}
