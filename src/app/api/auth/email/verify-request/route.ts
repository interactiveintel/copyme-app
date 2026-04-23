import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { issueEmailVerification } from "@/lib/email-verification";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /api/auth/email/verify-request
//
// Triggers (re)sending a verification email. Two entry points:
//   1. Anonymous caller:   body = { email }      — looked up by emailHash.
//   2. Authenticated user: userId from x-user-id  — uses body.email to send.
//
// Response is always a generic success to prevent enumeration.
// ---------------------------------------------------------------------------

const IP_LIMIT = 10;
const IP_WINDOW_MS = 60 * 60 * 1000;

interface RequestBody {
  email?: string;
}

const GENERIC = NextResponse.json({
  success: true,
  data: { message: "If that email is on an account, a verification link was sent." },
});

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as RequestBody;
    if (!body.email) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "email is required" },
        },
        { status: 400 },
      );
    }

    const ip = clientIpFromRequest(request);
    const limit = await rateLimit(`verify-request:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "RATE_LIMITED", message: "Too many requests. Try again later." },
        },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
      );
    }

    // Prefer the authenticated user if middleware passed one through.
    const xUser = request.headers.get("x-user-id");

    const user = xUser
      ? await prisma.user.findUnique({
          where: { id: xUser },
          select: { id: true, emailVerifiedAt: true },
        })
      : await prisma.user.findUnique({
          where: { emailHash: createHash("sha256").update(body.email).digest("hex") },
          select: { id: true, emailVerifiedAt: true },
        });

    if (!user) return GENERIC;

    // If already verified, no-op (still return generic).
    if (user.emailVerifiedAt) return GENERIC;

    await issueEmailVerification(user.id, body.email);
    return GENERIC;
  } catch (error) {
    console.error("[verify-request] error:", error);
    return GENERIC;
  }
}
