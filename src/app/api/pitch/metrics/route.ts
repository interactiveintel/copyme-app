import { NextResponse } from "next/server";
import prisma from "@/lib/db";

// S-158: edge-cache for 60s so the page survives a ~100 RPS burst.
export const revalidate = 60;

// ---------------------------------------------------------------------------
// GET /api/pitch/metrics
//
// Investor-grade live metrics — public. Returns the same DAU/WAU/MAU/funnel
// set as /api/admin/metrics PLUS:
//   - D1 / D7 / D30 retention   (% of N-day-old signups active in last 24h)
//   - Yogi cost-per-user        (sum of YogiCostLog.costMicroUsd / distinct
//                                 users) over last 30 days
//   - Ad revenue                (sum of approved BusinessAd.priceMicroUsd)
//
// Previously gated by PITCH_PASSWORD; gate removed by user request so
// investors can land directly without an access key.
// ---------------------------------------------------------------------------

function minusMs(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** Day-window for users created exactly N days ago (UTC). */
function cohortWindow(daysAgo: number): { gte: Date; lt: Date } {
  const start = minusMs(daysAgo + 1);
  const end = minusMs(daysAgo);
  return { gte: start, lt: end };
}

export async function GET() {
  try {
    const now = new Date();
    const c24h = minusMs(1);
    const c7d = minusMs(7);
    const c30d = minusMs(30);

    // --- Top-line user counts --------------------------------------------
    const [totalUsers, signups24h, signups7d, signups30d, emailVerified] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: c24h } } }),
        prisma.user.count({ where: { createdAt: { gte: c7d } } }),
        prisma.user.count({ where: { createdAt: { gte: c30d } } }),
        prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      ]);

    // --- Activity: distinct senders per window ---------------------------
    const [active24h, active7d, active30d] = await Promise.all([
      prisma.message.findMany({
        where: { createdAt: { gte: c24h } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: c7d } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: c30d } },
        select: { senderId: true },
        distinct: ["senderId"],
      }),
    ]);
    const dau = active24h.length;
    const wau = active7d.length;
    const mau = active30d.length;
    const activeIds24h = new Set(active24h.map((m) => m.senderId));

    // --- Retention: D1 / D7 / D30 ---------------------------------------
    // For each cohort N: users created in (N+1, N) days ago AND active in
    // the last 24h.
    const computeRetention = async (daysAgo: number) => {
      const win = cohortWindow(daysAgo);
      const cohort = await prisma.user.findMany({
        where: { createdAt: { gte: win.gte, lt: win.lt } },
        select: { id: true },
      });
      if (cohort.length === 0) return { cohortSize: 0, retained: 0, pct: 0 };
      const retained = cohort.filter((u) => activeIds24h.has(u.id)).length;
      return {
        cohortSize: cohort.length,
        retained,
        pct: Math.round((retained / cohort.length) * 1000) / 10,
      };
    };

    const [d1, d7, d30] = await Promise.all([
      computeRetention(1),
      computeRetention(7),
      computeRetention(30),
    ]);

    // --- Funnel: signup → first message ---------------------------------
    const sendersEver = await prisma.message.findMany({
      select: { senderId: true },
      distinct: ["senderId"],
    });
    const sentFirstMessage = sendersEver.length;
    const funnelPct =
      totalUsers > 0
        ? Math.round((sentFirstMessage / totalUsers) * 1000) / 10
        : 0;

    // --- Volume ---------------------------------------------------------
    const [messages24h, messages7d, totalMessages] = await Promise.all([
      prisma.message.count({ where: { createdAt: { gte: c24h } } }),
      prisma.message.count({ where: { createdAt: { gte: c7d } } }),
      prisma.message.count(),
    ]);

    // --- Contacts -------------------------------------------------------
    const [totalContacts, contacts7d] = await Promise.all([
      prisma.contact.count(),
      prisma.contact.count({ where: { createdAt: { gte: c7d } } }),
    ]);

    // --- Yogi usage + cost ----------------------------------------------
    // Sum cost over last 30 days, divided by distinct users active in Yogi.
    const yogiAgg = await prisma.yogiCostLog.aggregate({
      _sum: { costMicroUsd: true, callCount: true, inputTokens: true, outputTokens: true },
      where: { day: { gte: cutoffDayKey(30) } },
    });
    const yogiActive30d = await prisma.yogiCostLog.findMany({
      where: { day: { gte: cutoffDayKey(30) } },
      distinct: ["userId"],
      select: { userId: true },
    });
    const yogiCostUsd30d = (yogiAgg._sum.costMicroUsd ?? 0) / 1_000_000;
    const yogiActiveUsers30d = yogiActive30d.length;
    const yogiCostPerUserUsd =
      yogiActiveUsers30d > 0
        ? Math.round((yogiCostUsd30d / yogiActiveUsers30d) * 100) / 100
        : 0;

    // --- Ad marketplace -------------------------------------------------
    const [adsApproved, adRevenueAgg, adImpressionsAgg, adClicksAgg] =
      await Promise.all([
        prisma.businessAd.count({
          where: { status: { in: ["approved", "paused", "expired"] } },
        }),
        prisma.businessAd.aggregate({
          _sum: { priceMicroUsd: true },
          where: { status: { in: ["approved", "paused", "expired"] } },
        }),
        prisma.businessAd.aggregate({ _sum: { impressions: true } }),
        prisma.businessAd.aggregate({ _sum: { clicks: true } }),
      ]);
    const adRevenueUsd = (adRevenueAgg._sum.priceMicroUsd ?? 0) / 1_000_000;
    const adImpressions = adImpressionsAgg._sum.impressions ?? 0;
    const adClicks = adClicksAgg._sum.clicks ?? 0;
    const adCtrPct =
      adImpressions > 0
        ? Math.round((adClicks / adImpressions) * 10000) / 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        asOf: now.toISOString(),
        users: {
          total: totalUsers,
          signupsLast24h: signups24h,
          signupsLast7d: signups7d,
          signupsLast30d: signups30d,
          emailVerified,
        },
        activity: { dau, wau, mau },
        retention: { d1, d7, d30 },
        funnel: { signups: totalUsers, sentFirstMessage, conversionPct: funnelPct },
        messages: {
          totalLast24h: messages24h,
          totalLast7d: messages7d,
          totalEver: totalMessages,
        },
        contacts: { total: totalContacts, addedLast7d: contacts7d },
        yogi: {
          activeUsers30d: yogiActiveUsers30d,
          totalCallsLast30d: yogiAgg._sum.callCount ?? 0,
          inputTokensLast30d: yogiAgg._sum.inputTokens ?? 0,
          outputTokensLast30d: yogiAgg._sum.outputTokens ?? 0,
          costLast30dUsd: Math.round(yogiCostUsd30d * 100) / 100,
          costPerUserUsd: yogiCostPerUserUsd,
        },
        ads: {
          approved: adsApproved,
          revenueUsd: Math.round(adRevenueUsd * 100) / 100,
          impressions: adImpressions,
          clicks: adClicks,
          ctrPct: adCtrPct,
        },
      },
    });
  } catch (error) {
    console.error("[pitch/metrics] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to compute metrics" },
      },
      { status: 500 },
    );
  }
}

function cutoffDayKey(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
