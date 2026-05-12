// GET /api/surveys/pending — surveys the caller hasn't responded to yet
// that match at least one of their interests (or are untargeted).
//
// Used by the inbox feed (Tier C5, Surface 2b) to surface a small "pending
// surveys" stack above the contacts list. We deliberately keep this cheap:
// at most ~3 active surveys returned per call, ranked by recency.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 3;
const MAX_LIMIT = 10;

function userHash(userId: string, surveyId: string): string {
  return createHash("sha256").update(`${userId}|${surveyId}`).digest("hex");
}

interface PendingQuestion {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
    : DEFAULT_LIMIT;

  // Caller's interests for targeting overlap.
  const myInterests = await prisma.userInterest.findMany({
    where: { userId: auth.userId },
    select: { interestText: true },
  });
  const myInterestSet = new Set(
    myInterests.map((i) => i.interestText.toLowerCase()),
  );

  // Pull a wider window of active surveys so we can filter / rank in memory.
  // The ownerId check excludes the caller's own surveys (you don't take your
  // own poll). We exclude surveys with an existing response via userHash
  // lookup below.
  const candidates = await prisma.survey.findMany({
    where: {
      status: "active",
      ownerId: { not: auth.userId },
    },
    orderBy: { createdAt: "desc" },
    take: limit * 5,
  });

  if (candidates.length === 0) {
    return NextResponse.json({ surveys: [] });
  }

  // Bulk-fetch the caller's existing responses for these surveys so we can
  // exclude already-answered ones in one round trip.
  const myHashes = candidates.map((s) => ({
    surveyId: s.id,
    hash: userHash(auth.userId, s.id),
  }));
  const existing = await prisma.surveyResponse.findMany({
    where: {
      OR: myHashes.map((h) => ({ surveyId: h.surveyId, userHash: h.hash })),
    },
    select: { surveyId: true },
  });
  const respondedIds = new Set(existing.map((r) => r.surveyId));

  // Score by interest overlap; untargeted surveys are eligible-with-low-score.
  // This mirrors the ads-inbox ranking philosophy.
  const scored = candidates
    .filter((s) => !respondedIds.has(s.id))
    .map((s) => {
      const targets = Array.isArray(s.targetInterests)
        ? (s.targetInterests as string[]).map((t) => t.toLowerCase())
        : [];
      const sharedCount = targets.filter((t) => myInterestSet.has(t)).length;
      const untargeted = targets.length === 0;
      // Targeted surveys with zero overlap are dropped (don't ask a vegan
      // about steak preferences).
      const eligible = untargeted || sharedCount > 0;
      return {
        s,
        score: untargeted ? 0.5 : sharedCount,
        eligible,
      };
    })
    .filter((x) => x.eligible);

  scored.sort((a, b) => b.score - a.score);

  const top = scored.slice(0, limit).map(({ s }) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    questions: Array.isArray(s.questions)
      ? (s.questions as unknown as PendingQuestion[])
      : [],
  }));

  return NextResponse.json({ surveys: top });
}
