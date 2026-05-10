// POST /api/surveys           — create a survey (S-221). Up to 7 questions, 7 tags.
// GET  /api/surveys           — list user's surveys (creator view).
// POST /api/surveys/respond   — submit a response (S-222). One per user/survey.
// GET  /api/surveys/:id/results — aggregated, k>=7 anonymity (S-223).

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const MAX_QUESTIONS = 7;
const MAX_TAGS = 7;

interface SurveyQuestion {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
}

function userHash(userId: string, surveyId: string): string {
  return createHash("sha256").update(`${userId}|${surveyId}`).digest("hex");
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const { title, description, questions, targetInterests } = body;
  if (!title || !Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });
  }
  if (questions.length > MAX_QUESTIONS) {
    return NextResponse.json({ error: "TOO_MANY_QUESTIONS", limit: MAX_QUESTIONS }, { status: 400 });
  }
  if (Array.isArray(targetInterests) && targetInterests.length > MAX_TAGS) {
    return NextResponse.json({ error: "TOO_MANY_TAGS", limit: MAX_TAGS }, { status: 400 });
  }

  const survey = await prisma.survey.create({
    data: {
      ownerId: auth.userId,
      title: String(title).slice(0, 120),
      description: description ? String(description).slice(0, 500) : null,
      questions: questions.map((q: SurveyQuestion) => ({
        id: q.id,
        prompt: String(q.prompt).slice(0, 200),
        type: ["single", "multi", "text"].includes(q.type) ? q.type : "text",
        options: Array.isArray(q.options) ? q.options.slice(0, 7) : undefined,
      })),
      targetInterests: Array.isArray(targetInterests)
        ? (targetInterests.slice(0, 7) as unknown as object)
        : undefined,
      status: "active",
    },
  });
  return NextResponse.json({ ok: true, survey });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const surveys = await prisma.survey.findMany({
    where: { ownerId: auth.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ surveys });
}

export async function PUT(req: NextRequest) {
  // Submit response (idempotent per user via unique [surveyId, userHash]).
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const { surveyId, answers } = await req.json();
  if (!surveyId || !answers) return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });

  const survey = await prisma.survey.findUnique({ where: { id: surveyId } });
  if (!survey || survey.status !== "active") {
    return NextResponse.json({ error: "NOT_AVAILABLE" }, { status: 404 });
  }

  await prisma.surveyResponse.upsert({
    where: { surveyId_userHash: { surveyId, userHash: userHash(auth.userId, surveyId) } },
    create: {
      surveyId,
      userHash: userHash(auth.userId, surveyId),
      answers,
    },
    update: { answers },
  });
  return NextResponse.json({ ok: true });
}
