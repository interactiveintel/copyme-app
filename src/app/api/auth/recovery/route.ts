// POST   /api/auth/recovery — generate (or rotate) a recovery file (S-108)
// PUT    /api/auth/recovery — set / replace the secondary phone fallback
//
// On generation, the response includes the one-time `secret` plain-text. The
// server only stores the SHA-256 of it.

import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { authenticateRequest } from "@/lib/auth";
import { hashPhone } from "@/lib/otp";
import { parseE164 } from "@/lib/phone/validate";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

function generateSecret(): string {
  // 24 bytes → ~32 chars URL-safe. Printed to the user once.
  return randomBytes(24).toString("base64url");
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const secret = generateSecret();
  const secretHash = createHash("sha256").update(secret).digest("hex");

  await prisma.recoveryFile.upsert({
    where: { userId: auth.userId },
    create: { userId: auth.userId, secretHash },
    update: { secretHash, consumedAt: null },
  });

  // Build the printable file payload — user is told to save this.
  const payload = {
    type: "copyme-recovery-file",
    version: 1,
    issuedAt: new Date().toISOString(),
    userId: auth.userId,
    secret,
    instructions:
      "Save this file securely. If you lose access to your phone, present this " +
      "secret on the recovery screen to regain access. The secret is single-use; " +
      "regenerate immediately after using it.",
  };

  return NextResponse.json({ ok: true, file: payload });
}

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const phone: string | undefined = body?.secondaryPhoneE164;
  if (!phone || !parseE164(phone)) {
    return NextResponse.json({ error: "INVALID_PHONE" }, { status: 400 });
  }
  await prisma.recoveryFile.upsert({
    where: { userId: auth.userId },
    create: {
      userId: auth.userId,
      secretHash: createHash("sha256").update(generateSecret()).digest("hex"),
      secondaryPhoneHash: hashPhone(phone),
    },
    update: { secondaryPhoneHash: hashPhone(phone) },
  });
  return NextResponse.json({ ok: true });
}
