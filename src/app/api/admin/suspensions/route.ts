// POST /api/admin/suspensions  — create / escalate a suspension (S-175)
// PATCH /api/admin/suspensions  — lift a suspension
// GET  /api/admin/suspensions   — list active

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const SOFT_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // soft → hard escalation after 7d

function checkAdmin(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) return null;
  return auth;
}

export async function POST(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { userId, level, reason, details, appealUrl } = await req.json();
  if (!userId || !["soft", "hard"].includes(level) || !reason) {
    return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });
  }
  const row = await prisma.accountSuspension.create({
    data: {
      userId,
      level,
      reason: String(reason).slice(0, 120),
      details: details ? String(details).slice(0, 2000) : null,
      escalatesAt: level === "soft" ? new Date(Date.now() + SOFT_DURATION_MS) : null,
      appealUrl: appealUrl ?? "/appeal/suspension",
    },
  });
  return NextResponse.json({ ok: true, suspension: row });
}

export async function PATCH(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });
  await prisma.accountSuspension.update({
    where: { id },
    data: { liftedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const auth = checkAdmin(req);
  if (!auth) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const rows = await prisma.accountSuspension.findMany({
    where: { liftedAt: null },
    orderBy: { startedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ suspensions: rows });
}
