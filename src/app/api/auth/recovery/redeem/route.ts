// POST /api/auth/recovery/redeem — exchange a recovery secret for a session.
// Body: { userId, secret } OR { secondaryPhoneE164, code }   (S-108)
//
// On success returns a fresh session and marks the secret consumed; the user
// MUST regenerate immediately after.

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hashPhone, verifyOtp } from "@/lib/otp";
import { parseE164 } from "@/lib/phone/validate";
import { prisma } from "@/lib/db";
import { issueSession } from "@/lib/sessions";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  if (typeof body.userId === "string" && typeof body.secret === "string") {
    const secretHash = createHash("sha256").update(body.secret).digest("hex");
    const file = await prisma.recoveryFile.findUnique({
      where: { userId: body.userId },
    });
    if (!file || file.secretHash !== secretHash || file.consumedAt) {
      return NextResponse.json({ error: "INVALID" }, { status: 401 });
    }
    await prisma.recoveryFile.update({
      where: { id: file.id },
      data: { consumedAt: new Date() },
    });
    const tokens = await issueSession({
      userId: body.userId,
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });
    return NextResponse.json({ ok: true, ...tokens });
  }

  if (typeof body.secondaryPhoneE164 === "string" && typeof body.code === "string") {
    const phone = body.secondaryPhoneE164;
    if (!parseE164(phone)) return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
    const v = await verifyOtp(phone, body.code);
    if (!v.ok) return NextResponse.json({ error: "BAD_OTP", reason: v.reason }, { status: 401 });
    const file = await prisma.recoveryFile.findFirst({
      where: { secondaryPhoneHash: hashPhone(phone) },
    });
    if (!file) return NextResponse.json({ error: "NO_RECOVERY" }, { status: 404 });
    const tokens = await issueSession({
      userId: file.userId,
      userAgent: req.headers.get("user-agent") ?? undefined,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? undefined,
    });
    return NextResponse.json({ ok: true, ...tokens });
  }

  return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
}
