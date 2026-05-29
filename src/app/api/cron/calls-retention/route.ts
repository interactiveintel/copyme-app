// GET /api/cron/calls-retention — v4.15.13 (Tier E Sprint 7).
//
// Nightly sweep: hard-delete calls + their participants older than
// the retention window. Privacy policy commits to call records being
// kept for 90 days. The CallParticipant FK to calls is ON DELETE
// CASCADE, so a single deleteMany on calls also drops the related
// participant rows.
//
// Auth: identical pattern to /api/cron/daily-digest — Bearer
// CRON_SECRET OR x-vercel-cron header.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RETENTION_DAYS = 90;

function isCronAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    // Hard delete — participants cascade via FK.
    const result = await prisma.call.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedCalls: result.count,
        cutoff: cutoff.toISOString(),
        retentionDays: RETENTION_DAYS,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
