// POST /api/auth/phone/verify — verify an OTP and either start sign-up
// (returns a short-lived "signup ticket") or sign in an existing user.
//
// Body: { phoneE164, code }
// Returns:
//   - existing user: { ok, status: "signin", tokens, sessionId }
//   - new user:      { ok, status: "signup", signupTicket }

import { NextRequest, NextResponse } from "next/server";
import { verifyOtp, hashPhone } from "@/lib/otp";
import { issueSignupTicket } from "@/lib/otp/signup-ticket";
import { parseE164 } from "@/lib/phone/validate";
import { issueSession } from "@/lib/sessions";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { phoneE164?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const phoneE164 = body.phoneE164?.trim();
  const code = body.code?.trim();
  if (!phoneE164 || !parseE164(phoneE164) || !code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const r = await verifyOtp(phoneE164, code);
  if (!r.ok) {
    return NextResponse.json({ ok: false, reason: r.reason }, { status: 401 });
  }

  // Existing user?
  const phoneHash = hashPhone(phoneE164);
  const user = await prisma.user.findUnique({
    where: { phoneHash },
    select: { id: true, displayName: true },
  });

  if (!user) {
    return NextResponse.json({
      ok: true,
      status: "signup",
      signupTicket: issueSignupTicket(phoneHash),
    });
  }

  // Sign in.
  const tokens = await issueSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
  });

  // Best-effort: bump last activity.
  await prisma.user.update({
    where: { id: user.id },
    data: { lastActivityAt: new Date() },
  }).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    status: "signin",
    user: { id: user.id, displayName: user.displayName },
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    sessionId: tokens.sessionId,
    deviceId: tokens.deviceId,
  });
}

