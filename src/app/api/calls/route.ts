// POST /api/calls — start a new call.
// GET  /api/calls?status=all|ringing|missed&limit=N — list calls
//      involving the auth user, newest first.
//
// Body for POST:
//   { calleeId: string, callType: "voice" | "video" }
// Returns: { callId, room, messageId }

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCall, type CallType } from "@/lib/calls";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  calleeId?: string;
  callType?: CallType;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  // 30 outbound calls/hour per user — anti-spam ceiling that still
  // accommodates the heaviest legitimate user (active sales day, etc).
  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`calls:create:${auth.userId}:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.calleeId || (body.callType !== "voice" && body.callType !== "video")) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "calleeId + callType ('voice'|'video') required" } },
      { status: 400 },
    );
  }

  const result = await createCall({
    callerId: auth.userId,
    calleeId: body.calleeId,
    callType: body.callType,
  });

  if (!result.ok) {
    const status =
      result.reason === "RECIPIENT_NOT_FOUND" ? 404 :
      result.reason === "SAME_USER" ? 400 :
      result.reason === "RATE_LIMITED" ? 429 :
      500;
    return NextResponse.json(
      { success: false, error: { code: result.reason } },
      { status },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      callId: result.callId,
      room: result.room,
      messageId: result.messageId,
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);

  const where = status === "all"
    ? { OR: [{ callerId: auth.userId }, { calleeId: auth.userId }] }
    : { status, OR: [{ callerId: auth.userId }, { calleeId: auth.userId }] };

  const calls = await prisma.call.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      callerId: true,
      calleeId: true,
      callType: true,
      status: true,
      acceptedAt: true,
      endedAt: true,
      durationSeconds: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ success: true, data: calls });
}
