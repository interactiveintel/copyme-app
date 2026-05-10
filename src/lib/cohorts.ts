// D1 / D7 / D30 cohort retention (S-252).
//
// Pure SQL via Prisma. Caller fetches the chart data; presentation lives
// in the /pitch surface (S-158).

import { prisma } from "@/lib/db";

export interface CohortPoint {
  cohortDate: string; // YYYY-MM-DD
  cohortSize: number;
  d1: number;
  d7: number;
  d30: number;
}

export async function cohortRetention(daysBack = 60): Promise<CohortPoint[]> {
  const out: CohortPoint[] = [];
  const today = new Date();
  for (let i = daysBack; i >= 30; i--) {
    const cohortStart = new Date(today.getTime() - i * 86_400_000);
    cohortStart.setUTCHours(0, 0, 0, 0);
    const cohortEnd = new Date(cohortStart.getTime() + 86_400_000);

    const cohortUsers = await prisma.user.findMany({
      where: { createdAt: { gte: cohortStart, lt: cohortEnd } },
      select: { id: true, lastActivityAt: true },
    });
    if (cohortUsers.length === 0) continue;

    const d1End = new Date(cohortStart.getTime() + 2 * 86_400_000);
    const d7End = new Date(cohortStart.getTime() + 8 * 86_400_000);
    const d30End = new Date(cohortStart.getTime() + 31 * 86_400_000);

    let d1 = 0, d7 = 0, d30 = 0;
    for (const u of cohortUsers) {
      const last = u.lastActivityAt;
      if (!last) continue;
      if (last >= cohortEnd && last < d1End) d1++;
      if (last >= cohortEnd && last < d7End) d7++;
      if (last >= cohortEnd && last < d30End) d30++;
    }
    out.push({
      cohortDate: cohortStart.toISOString().slice(0, 10),
      cohortSize: cohortUsers.length,
      d1, d7, d30,
    });
  }
  return out;
}
