import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/reports
//
// Body: { reportedId: string, reason: string, details?: string }
//
// Files an abuse report against another user. Rate-limited so a single user
// can't carpet-bomb the moderation queue. Reports start in "open" status;
// a future moderation tool / admin surface will move them to
// "actioned" / "dismissed".
// ---------------------------------------------------------------------------

const ALLOWED_REASONS = [
  "harassment",
  "spam",
  "impersonation",
  "hate_speech",
  "sexual_content",
  "underage_user",
  "other",
] as const;
type AllowedReason = (typeof ALLOWED_REASONS)[number];

const REPORT_LIMIT = 10;
const REPORT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_DETAILS = 2000;

interface ReportBody {
  reportedId?: string;
  reason?: string;
  details?: string;
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  // Rate limit so a malicious actor can't drown the moderation queue.
  const ip = clientIpFromRequest(request);
  const limit = rateLimit(`report:${auth.userId}:${ip}`, REPORT_LIMIT, REPORT_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMITED", message: "Too many reports. Try again later." },
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ReportBody;

    if (!body.reportedId || !body.reason) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "reportedId and reason are required" },
        },
        { status: 400 },
      );
    }

    if (body.reportedId === auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "SELF_REPORT", message: "You can't report yourself" } },
        { status: 400 },
      );
    }

    if (!(ALLOWED_REASONS as readonly string[]).includes(body.reason)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REASON",
            message: `reason must be one of: ${ALLOWED_REASONS.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: body.reportedId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Reported user not found" } },
        { status: 404 },
      );
    }

    const row = await prisma.userReport.create({
      data: {
        reporterId: auth.userId,
        reportedId: body.reportedId,
        reason: body.reason as AllowedReason,
        details: body.details?.slice(0, MAX_DETAILS) || null,
      },
      select: { id: true, createdAt: true, status: true },
    });

    return NextResponse.json(
      { success: true, data: row },
      { status: 201 },
    );
  } catch (error) {
    console.error("[reports POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to file report" } },
      { status: 500 },
    );
  }
}
