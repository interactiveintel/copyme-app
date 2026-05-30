// GET /api/cron/activity-stale — v4.16.12.
//
// Recompute every user's lastActivityAt from authoritative sources:
//   MAX(latest Message sent, latest Session lastUsedAt)
//
// Why: lastActivityAt is incrementally maintained by bumpStreak() on
// each send + by the auth refresh path on each session use. Both
// paths are best-effort fire-and-forget — a Redis hiccup, a missed
// catch, or an old code path that skipped the bump leaves the field
// stale. Search filters ("active in last 7d/30d") rely on this
// field, so stale data → users incorrectly included or excluded
// from results.
//
// Nightly recompute restores ground truth. Cost: one aggregation
// query per user. Acceptable at small scale (the same shape as
// /api/cron/messages-retention's per-pair loop, which already runs).
// Larger scale would batch via GROUP BY in a single SQL.
//
// Auth: identical pattern to calls-retention + messages-retention.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return request.headers.get("x-vercel-cron") === "1";
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  try {
    // Single GROUP BY query → most-recent sent-message timestamp per user.
    const messageMax = await prisma.message.groupBy({
      by: ["senderId"],
      _max: { createdAt: true },
    });
    const msgMap = new Map<string, Date>(
      messageMax
        .filter((r): r is { senderId: string; _max: { createdAt: Date } } => !!r._max.createdAt)
        .map((r) => [r.senderId, r._max.createdAt]),
    );

    // Same for sessions (lastUsedAt is bumped on every refresh).
    const sessionMax = await prisma.session.groupBy({
      by: ["userId"],
      _max: { lastUsedAt: true },
    });
    const sessMap = new Map<string, Date>(
      sessionMax
        .filter((r): r is { userId: string; _max: { lastUsedAt: Date } } => !!r._max.lastUsedAt)
        .map((r) => [r.userId, r._max.lastUsedAt]),
    );

    const users = await prisma.user.findMany({
      select: { id: true, lastActivityAt: true },
    });

    let updated = 0;
    let cleared = 0;
    let unchanged = 0;

    for (const u of users) {
      const msg = msgMap.get(u.id) ?? null;
      const sess = sessMap.get(u.id) ?? null;
      const computed: Date | null =
        msg && sess
          ? msg.getTime() > sess.getTime() ? msg : sess
          : (msg ?? sess);

      const existing = u.lastActivityAt;
      const same =
        (existing == null && computed == null) ||
        (existing != null && computed != null && existing.getTime() === computed.getTime());
      if (same) {
        unchanged += 1;
        continue;
      }

      await prisma.user.update({
        where: { id: u.id },
        data: { lastActivityAt: computed },
      });
      if (computed == null) cleared += 1;
      else updated += 1;
    }

    return NextResponse.json({
      success: true,
      data: { usersScanned: users.length, updated, cleared, unchanged },
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
