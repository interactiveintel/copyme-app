// POST /api/auth/invite/check — public preflight for an invite code.
//
// Used by the /signup UI's "is this code valid?" hint before the user
// commits to entering OTP / display name / etc. Returns only "valid"
// or a generic reason — no codeId leakage so we don't help an attacker
// enumerate.
//
// Rate-limited per IP since the endpoint is unauthenticated.

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { validateInviteCode } from "@/lib/invite-code";

export const runtime = "nodejs";

const IP_LIMIT = 30;
const IP_WINDOW_MS = 60 * 60 * 1000;

interface CheckBody {
  code?: string;
}

export async function POST(req: NextRequest) {
  const ip = clientIpFromRequest(req);
  const limit = await rateLimit(`invite-check:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { valid: false, reason: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CheckBody;
  if (!body.code || typeof body.code !== "string") {
    return NextResponse.json({ valid: false, reason: "MISSING_CODE" }, { status: 400 });
  }

  try {
    const result = await validateInviteCode(body.code);
    if (result.valid) {
      return NextResponse.json({ valid: true });
    }
    return NextResponse.json({ valid: false, reason: result.reason });
  } catch (err) {
    // Don't surface internal errors to an unauthenticated caller; treat as
    // a soft failure so the signup UI can ask the user to retry.
    console.error("[invite/check] unexpected error:", err);
    return NextResponse.json({ valid: false, reason: "SERVER_ERROR" }, { status: 500 });
  }
}
