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

  // Lazy-expire stale ringing calls so the caller's UI gets a "missed"
  // signal without needing a separate sweeper. Cheap UPDATE that only
  // hits rows the partial-index makes fast to find.
  await prisma.call.updateMany({
    where: {
      calleeId: auth.userId,
      status: "ringing",
      createdAt: { lt: cutoff },
    },
    data: { status: "missed", endedAt: new Date() },
  }).catch(() => undefined);

  const incoming = await prisma.call.findFirst({
    where: {
      calleeId: auth.userId,
      status: "ringing",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      callerId: true,
      callType: true,
      createdAt: true,
    },
  });

  if (!incoming) {
    return NextResponse.json({ success: true, data: null });
  }

  // Schema keeps user FKs as raw UUIDs (no explicit Prisma relation,
  // matching the VapRequest pattern) so the caller's display name
  // takes a separate cheap lookup.
  const caller = await prisma.user.findUnique({
    where: { id: incoming.callerId },
    select: { displayName: true, avatarUrl: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      callId: incoming.id,
      callerId: incoming.callerId,
      callerName: caller?.displayName ?? "Unknown",
      callerAvatarUrl: caller?.avatarUrl ?? null,
      callType: incoming.callType,
      createdAt: incoming.createdAt,
    },
  });
}
