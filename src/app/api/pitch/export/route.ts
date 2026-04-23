import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// GET /api/pitch/export
//
// One-click data export for investor due diligence. Returns a single JSON
// blob with the headline metrics + 30 days of daily series (signups,
// messages, Yogi cost, ad impressions/clicks) so an analyst can drop it
// into a spreadsheet without having to scrape the live page.
//
// PII-safe: no display names, no emails, no UUIDs except aggregated counts.
// Public — gate removed alongside /api/pitch/metrics.
// ---------------------------------------------------------------------------

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function buildDayList(days: number): string[] {
  const today = new Date();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    out.push(dayKey(d));
  }
  return out;
}

export async function GET() {
  try {
    const RANGE = 30;
    const days = buildDayList(RANGE);
    const cutoff = new Date(Date.now() - RANGE * 24 * 60 * 60 * 1000);

    // --- Fetch raw, in parallel where possible --------------------------
    const [signups, messages, yogiAgg, adAgg] = await Promise.all([
      prisma.user.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { createdAt: true },
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: cutoff } },
        select: { createdAt: true, senderId: true },
      }),
      prisma.yogiCostLog.findMany({
        where: { day: { gte: days[0]! } },
        select: {
          day: true,
          callCount: true,
          inputTokens: true,
          outputTokens: true,
          costMicroUsd: true,
          userId: true,
        },
      }),
      prisma.adEventDay.findMany({
        where: { day: { gte: days[0]! } },
        select: { day: true, impressions: true, clicks: true },
      }),
    ]);

    // --- Bucket into per-day series -------------------------------------
    const signupByDay = new Map<string, number>();
    for (const u of signups) {
      const k = dayKey(u.createdAt);
      signupByDay.set(k, (signupByDay.get(k) ?? 0) + 1);
    }

    const msgsByDay = new Map<string, { count: number; senders: Set<string> }>();
    for (const m of messages) {
      const k = dayKey(m.createdAt);
      const cur = msgsByDay.get(k) ?? { count: 0, senders: new Set() };
      cur.count += 1;
      cur.senders.add(m.senderId);
      msgsByDay.set(k, cur);
    }

    const yogiByDay = new Map<
      string,
      { calls: number; inputTokens: number; outputTokens: number; costMicroUsd: number; users: Set<string> }
    >();
    for (const r of yogiAgg) {
      const cur = yogiByDay.get(r.day) ?? {
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        costMicroUsd: 0,
        users: new Set(),
      };
      cur.calls += r.callCount;
      cur.inputTokens += r.inputTokens;
      cur.outputTokens += r.outputTokens;
      cur.costMicroUsd += r.costMicroUsd;
      cur.users.add(r.userId);
      yogiByDay.set(r.day, cur);
    }

    const adByDay = new Map<string, { impressions: number; clicks: number }>();
    for (const r of adAgg) {
      const cur = adByDay.get(r.day) ?? { impressions: 0, clicks: 0 };
      cur.impressions += r.impressions;
      cur.clicks += r.clicks;
      adByDay.set(r.day, cur);
    }

    const series = days.map((day) => {
      const m = msgsByDay.get(day);
      const y = yogiByDay.get(day);
      const a = adByDay.get(day);
      return {
        day,
        signups: signupByDay.get(day) ?? 0,
        messagesSent: m?.count ?? 0,
        activeSenders: m?.senders.size ?? 0,
        yogiCalls: y?.calls ?? 0,
        yogiActiveUsers: y?.users.size ?? 0,
        yogiCostUsd: y ? Math.round((y.costMicroUsd / 1_000_000) * 100) / 100 : 0,
        adImpressions: a?.impressions ?? 0,
        adClicks: a?.clicks ?? 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        rangeDays: RANGE,
        series,
      },
    });
  } catch (error) {
    console.error("[pitch/export] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Export failed" } },
      { status: 500 },
    );
  }
}
