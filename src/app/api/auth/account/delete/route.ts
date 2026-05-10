// POST   /api/auth/account/delete  — request hard-delete (30-day grace, S-109)
// DELETE /api/auth/account/delete  — cancel a pending deletion
// GET    /api/auth/account/delete  — status

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const GRACE_DAYS = 30;

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const existing = await prisma.accountDeletion.findUnique({ where: { userId: auth.userId } });
  if (existing && !existing.cancelledAt && !existing.erasedAt) {
    return NextResponse.json({
      ok: true,
      effectiveAt: existing.effectiveAt.toISOString(),
      exportReadyAt: existing.exportReadyAt?.toISOString() ?? null,
    });
  }

  const effectiveAt = new Date(Date.now() + GRACE_DAYS * 24 * 60 * 60 * 1000);
  const row = await prisma.accountDeletion.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, effectiveAt },
    update: { effectiveAt, cancelledAt: null, erasedAt: null, exportUrl: null, exportReadyAt: null },
  });

  // Kick off the export job. We just enqueue here — the worker is in
  // /api/cron/export-account, run hourly. See S-146 for the ZIP shape.
  // (For dev we mark it ready immediately so the UX is testable.)
  if (process.env.NODE_ENV !== "production") {
    await prisma.accountDeletion.update({
      where: { id: row.id },
      data: {
        exportUrl: `/api/auth/account/export.json?u=${auth.userId}`,
        exportReadyAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    effectiveAt: row.effectiveAt.toISOString(),
    graceDays: GRACE_DAYS,
  });
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const r = await prisma.accountDeletion.updateMany({
    where: { userId: auth.userId, erasedAt: null, cancelledAt: null },
    data: { cancelledAt: new Date() },
  });
  return NextResponse.json({ ok: true, cancelled: r.count });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const row = await prisma.accountDeletion.findUnique({ where: { userId: auth.userId } });
  return NextResponse.json({ deletion: row });
}
