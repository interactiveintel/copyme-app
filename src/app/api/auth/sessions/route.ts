// GET  /api/auth/sessions       — list active devices (S-106)
// DELETE /api/auth/sessions     — body: { sessionId } — revoke one (S-106)

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { listSessions, revokeSession, hasReplayBanner } from "@/lib/sessions";

export const runtime = "nodejs";
// Auth-bound, per-user device list. Defensive force-dynamic.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const sessions = await listSessions(auth.userId);
  const replayBanner = await hasReplayBanner(auth.userId);
  return NextResponse.json({ sessions, replayBanner });
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const sessionId: string | undefined = body?.sessionId;
  if (!sessionId) return NextResponse.json({ error: "MISSING_SESSION" }, { status: 400 });
  const ok = await revokeSession(sessionId, auth.userId);
  return NextResponse.json({ ok });
}
