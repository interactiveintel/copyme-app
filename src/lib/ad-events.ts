// ---------------------------------------------------------------------------
// Per-day ad event aggregation.
//
// We use a (adId, day) composite-key table — same pattern as yogi_cost_logs.
// A daily upsert is cheap, the storage footprint stays tiny no matter how
// many impressions roll in, and the dashboard queries are O(days_in_range)
// per ad rather than O(events).
//
// We also keep the denormalized impressions/clicks counters on business_ads
// up to date so the ad-list view doesn't need a JOIN. Dashboards that need
// time-series data hit ad_event_days directly.
// ---------------------------------------------------------------------------

import prisma from "@/lib/db";

function todayKey(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Record one impression for each ad ID. Bumps both the daily aggregate and
 * the denormalized lifetime counter. Fire-and-forget callers should ignore
 * the returned promise.
 */
export async function recordImpressions(adIds: string[]): Promise<void> {
  if (adIds.length === 0) return;
  const day = todayKey();
  await Promise.all([
    // Daily aggregate
    Promise.all(
      adIds.map((adId) =>
        prisma.adEventDay.upsert({
          where: { adId_day: { adId, day } },
          create: { adId, day, impressions: 1 },
          update: { impressions: { increment: 1 } },
        }),
      ),
    ),
    // Lifetime counters
    prisma.businessAd.updateMany({
      where: { id: { in: adIds } },
      data: { impressions: { increment: 1 } },
    }),
  ]);
}

/**
 * Record one click for the given ad. Bumps both the daily aggregate and
 * the denormalized lifetime counter.
 */
export async function recordClick(adId: string): Promise<void> {
  const day = todayKey();
  await Promise.all([
    prisma.adEventDay.upsert({
      where: { adId_day: { adId, day } },
      create: { adId, day, clicks: 1 },
      update: { clicks: { increment: 1 } },
    }),
    prisma.businessAd.update({
      where: { id: adId },
      data: { clicks: { increment: 1 } },
    }),
  ]);
}

/**
 * Daily series for an ad over the last `days` days, oldest first. Includes
 * "empty" days (zeros) so the dashboard's chart is regular.
 */
export async function dailySeries(
  adId: string,
  days = 30,
): Promise<Array<{ day: string; impressions: number; clicks: number; ctr: number }>> {
  const now = new Date();
  // Build the canonical day list (UTC).
  const daysList: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    daysList.push(`${y}-${m}-${dd}`);
  }

  const rows = await prisma.adEventDay.findMany({
    where: { adId, day: { in: daysList } },
    select: { day: true, impressions: true, clicks: true },
  });
  const byDay = new Map(rows.map((r) => [r.day, r]));

  return daysList.map((day) => {
    const r = byDay.get(day);
    const i = r?.impressions ?? 0;
    const c = r?.clicks ?? 0;
    return {
      day,
      impressions: i,
      clicks: c,
      ctr: i > 0 ? Math.round((c / i) * 10000) / 100 : 0, // %
    };
  });
}
