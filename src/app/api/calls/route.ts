// POST /api/calls — start a new call (1:1 OR group).
// GET  /api/calls?status=all|ringing|missed&limit=N — list calls
//      involving the auth user, newest first.
//
// Body for POST (1:1):
//   { calleeId: string, callType: "voice" | "video" }
// Body for POST (group — v4.15.12):
//   { calleeIds: string[], callType: "voice" | "video" }
//   calleeIds must be 2..6 entries (Rule of 7: 1 caller + 6 callees max)
// Returns: { callId, room, messageId? }

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createCall, createGroupCall, MAX_CALL_PARTICIPANTS, type CallType } from "@/lib/calls";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateBody {
  calleeId?: string;
  /** v4.15.12 group call alternative. If both present, calleeIds wins. */
  calleeIds?: string[];
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
  if (body.callType !== "voice" && body.callType !== "video") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "callType ('voice'|'video') required" } },
      { status: 400 },
    );
  }

  // ---- Group path (v4.15.12) ----------------------------------------
  // Defensive: even if a client sneaks calleeIds.length === 1, route
  // through the 1:1 path. The createGroupCall lib rejects <2 anyway.
  if (Array.isArray(body.calleeIds) && body.calleeIds.length >= 2) {
    if (body.calleeIds.length > MAX_CALL_PARTICIPANTS - 1) {
      return NextResponse.json(
        { success: false, error: { code: "TOO_MANY_PARTICIPANTS", message: `Max ${MAX_CALL_PARTICIPANTS} participants total (Rule of 7)` } },
        { status: 400 },
      );
    }
    const result = await createGroupCall({
      callerId: auth.userId,
      calleeIds: body.calleeIds,
      callType: body.callType,
    });
    if (!result.ok) {
      const status =
        result.reason === "RECIPIENT_NOT_FOUND" ? 404 :
        result.reason === "INVALID_TARGET" ? 400 :
        500;
      return NextResponse.json(
        { success: false, error: { code: result.reason } },
        { status },
      );
    }
    return NextResponse.json({
      success: true,
      data: { callId: result.callId, room: result.room, isGroup: true },
    });
  }

  // ---- 1:1 path (unchanged) -----------------------------------------
  const calleeId = body.calleeId ?? body.calleeIds?.[0];
  if (!calleeId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "calleeId OR calleeIds required" } },
      { status: 400 },
    );
  }

  const result = await createCall({
    callerId: auth.userId,
    calleeId,
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

  // v4.15.7 (Sprint 5): enrich with the *other party's* identity so
  // CallHistorySheet can render names + avatars without an N+1 fan-out
  // on the client. Batch-lookup the unique user IDs that aren't us.
  const otherIds = Array.from(
    new Set(
      calls.flatMap((c) => [c.callerId, c.calleeId])
        .filter((id) => id !== auth.userId),
    ),
  );
  const others = otherIds.length
    ? await prisma.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, displayName: true, avatarUrl: true },
      })
    : [];
  const byId = new Map(others.map((u) => [u.id, u]));

  const enriched = calls.map((c) => {
    const isOutbound = c.callerId === auth.userId;
    const otherId = isOutbound ? c.calleeId : c.callerId;
    const other = byId.get(otherId);
    return {
      ...c,
      isOutbound,
      otherParty: {
        id: otherId,
        displayName: other?.displayName ?? "Unknown",
        avatarUrl: other?.avatarUrl ?? null,
      },
    };
  });

  return NextResponse.json({ success: true, data: enriched });
}
