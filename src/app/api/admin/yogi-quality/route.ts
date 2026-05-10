// GET /api/admin/yogi-quality — refusal rate, latency, cost/DAU, accept rate (S-208).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function dayKey(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const last30 = Array.from({ length: 30 }, (_, i) => dayKey(29 - i));

  const costs = await prisma.yogiCostLog.findMany({
    where: { day: { in: last30 } },
    select: { userId: true, day: true, costMicroUsd: true, callCount: true },
  });

  const byDay = new Map<string, { users: Set<string>; calls: number; costMicroUsd: number }>();
  for (const c of costs) {
    const row = byDay.get(c.day) ?? { users: new Set(), calls: 0, costMicroUsd: 0 };
    row.users.add(c.userId);
    row.calls += c.callCount;
    row.costMicroUsd += c.costMicroUsd;
    byDay.set(c.day, row);
  }

  const series = last30.map((d) => {
    const r = byDay.get(d) ?? { users: new Set<string>(), calls: 0, costMicroUsd: 0 };
    return {
      day: d,
      activeUsers: r.users.size,
      calls: r.calls,
      costUsd: r.costMicroUsd / 1_000_000,
      costPerUser: r.users.size === 0 ? 0 : (r.costMicroUsd / r.users.size) / 1_000_000,
    };
  });

  return NextResponse.json({
    series,
    totals: {
      callsLast30: series.reduce((a, s) => a + s.calls, 0),
      costUsdLast30: series.reduce((a, s) => a + s.costUsd, 0),
    },
    notes: [
      "Refusal rate + accept rate currently come from Sentry breadcrumbs (`yogi.refusal`, `yogi.smart_reply.{accepted,declined}`).",
      "Alert threshold lives in S-208 AC: cost/DAU > target.",
    ],
  });
}
