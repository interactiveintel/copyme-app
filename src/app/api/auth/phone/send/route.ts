// POST /api/auth/phone/send — issue an OTP for a phone number (S-101 / S-103).
//
// Body: { phoneE164: string }
// Returns: { ok: boolean, cooldownUntil: ISO, provider: string }

import { NextRequest, NextResponse } from "next/server";
import { sendOtp } from "@/lib/otp";
import { parseE164 } from "@/lib/phone/validate";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { phoneE164?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const phoneE164 = body.phoneE164?.trim();
  if (!phoneE164 || !parseE164(phoneE164)) {
    return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
  }

  // Per-IP rate limit: 5/min. Per-phone cooldown is enforced inside sendOtp.
  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`otp:ip:${ip}`, 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }

  const result = await sendOtp(phoneE164, ip);
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        cooldownUntil: result.cooldownUntil.toISOString(),
        provider: result.provider,
      },
      { status: result.reason === "COOLDOWN" ? 429 : 502 },
    );
  }
  return NextResponse.json({
    ok: true,
    cooldownUntil: result.cooldownUntil.toISOString(),
    provider: result.provider,
  });
}
