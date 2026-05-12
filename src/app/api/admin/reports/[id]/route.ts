// PATCH /api/admin/reports/:id — resolve / dismiss a UserReport (B3).
//
// Admin-only. Marks the report as "resolved" and stamps resolvedAt.
// Suspension creation lives in /api/admin/suspensions — this endpoint is
// just the moderation-queue dismiss action.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "MISSING_ID" }, { status: 400 });

  const existing = await prisma.userReport.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  await prisma.userReport.update({
    where: { id },
    data: { status: "resolved", resolvedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
