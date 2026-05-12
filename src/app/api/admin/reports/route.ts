// GET /api/admin/reports — list open UserReports for the moderation queue (B3).
//
// Admin-only. Returns the open reports with reporter + reported display names
// hydrated, sorted by oldest first so reviewers tackle them in age order.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rows = await prisma.userReport.findMany({
    where: { status: "open" },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: {
      reporter: { select: { id: true, displayName: true } },
      reported: { select: { id: true, displayName: true } },
    },
  });

  return NextResponse.json({ reports: rows });
}
