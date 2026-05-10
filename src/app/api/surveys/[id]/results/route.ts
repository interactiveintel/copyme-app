// GET /api/surveys/:id/results — aggregated results with k-anonymity ≥ 7 (S-223).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const K_MIN = 7;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const { id } = await ctx.params;

  const survey = await prisma.survey.findUnique({ where: { id } });
  if (!survey || survey.ownerId !== auth.userId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const total = await prisma.surveyResponse.count({ where: { surveyId: id } });
  if (total < K_MIN) {
    return NextResponse.json({
      pending: true,
      have: total,
      needed: K_MIN,
      message: `Results unlock at ${K_MIN} responses to protect respondent identity (k-anonymity).`,
    });
  }

  const responses = await prisma.surveyResponse.findMany({ where: { surveyId: id } });
  // Tally by question id.
  const tallies: Record<string, Record<string, number>> = {};
  for (const r of responses) {
    const ans = r.answers as Record<string, string | string[]>;
    for (const [qid, value] of Object.entries(ans ?? {})) {
      tallies[qid] ??= {};
      const values = Array.isArray(value) ? value : [String(value)];
      for (const v of values) {
        tallies[qid][v] = (tallies[qid][v] ?? 0) + 1;
      }
    }
  }
  return NextResponse.json({ total, tallies });
}
