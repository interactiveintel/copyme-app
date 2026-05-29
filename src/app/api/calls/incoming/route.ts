// GET /api/calls/incoming — is anyone calling me right now?
//
// Returns the most recent ringing call where I'm the callee, or null.
// Polled by the chat UI on a short interval (~3s) so we can show the
// incoming-call sheet without SSE wiring. Sprint 4 (push) will fan
// this out as a real-time notification.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Calls older than this and still "ringing" are treated as missed.
// Keeps a hung-up caller's call from haunting the recipient's UI.
const RING_TTL_MS = 45_000;

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const cutoff = new Date(Date.now() - RING_TTL_MS);

  // Lazy-expire stale ringing participants. v4.15.12: now reads from
  // CallParticipant (unified for 1:1 + group). The Call.status flip
  // for 1:1 is handled by the caller-side end path, not here.
  await prisma.callParticipant.updateMany({
    where: {
      userId: auth.userId,
      status: "ringing",
      createdAt: { lt: cutoff },
    },
    data: { status: "missed", leftAt: new Date() },
  }).catch(() => undefined);

  // Most recent ringing participation for the auth user. Joined with
  // Call to get callType + isGroup + callerId.
  const incoming = await prisma.callParticipant.findFirst({
    where: {
      userId: auth.userId,
      status: "ringing",
    },
    orderBy: { createdAt: "desc" },
    select: {
      callId: true,
      createdAt: true,
      call: {
        select: {
          callerId: true,
          callType: true,
          isGroup: true,
        },
      },
    },
  });

  if (!incoming || !incoming.call) {
    return NextResponse.json({ success: true, data: null });
  }

  // Schema keeps user FKs as raw UUIDs for callerId; do the displayName
  // lookup separately.
  const caller = await prisma.user.findUnique({
    where: { id: incoming.call.callerId },
    select: { displayName: true, avatarUrl: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      callId: incoming.callId,
      callerId: incoming.call.callerId,
      callerName: caller?.displayName ?? "Unknown",
      callerAvatarUrl: caller?.avatarUrl ?? null,
      callType: incoming.call.callType,
      isGroup: incoming.call.isGroup,
      createdAt: incoming.createdAt,
    },
  });
}
