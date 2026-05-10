// POST /api/auth/onboarding/contacts — bulk-add the user's first 7 contacts (S-104)
// Body: { phonesE164: string[] }   (server clamps to 7)
//
// Phones that don't resolve to an existing CopyMe user are stored as
// "pending invite" rows by the existing /api/contacts surface; here we just
// wire the bulk-import.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { hashPhone } from "@/lib/otp";
import { parseE164 } from "@/lib/phone/validate";
import { prisma } from "@/lib/db";
import { addBreadcrumb } from "@/lib/observability";

export const runtime = "nodejs";

const MAX_AT_ONCE = 7; // Rule of 7

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const phones: unknown = body?.phonesE164;
  if (!Array.isArray(phones)) return NextResponse.json({ error: "BAD_BODY" }, { status: 400 });

  // Clamp + de-dupe + validate
  const clean = Array.from(new Set(
    (phones as unknown[])
      .filter((p): p is string => typeof p === "string")
      .map((p) => p.trim())
      .filter((p) => parseE164(p)),
  )).slice(0, MAX_AT_ONCE);

  if (clean.length === 0) {
    return NextResponse.json({ ok: true, added: 0, invited: 0 });
  }

  const hashes = clean.map(hashPhone);
  const existing = await prisma.user.findMany({
    where: { phoneHash: { in: hashes } },
    select: { id: true, phoneHash: true },
  });
  const existingByHash = new Map(existing.map((u) => [u.phoneHash, u.id]));

  let added = 0;
  let invited = 0;
  for (const phone of clean) {
    const targetId = existingByHash.get(hashPhone(phone));
    if (targetId && targetId !== auth.userId) {
      // Idempotent — Contact has composite PK.
      await prisma.contact.upsert({
        where: { userId_contactId: { userId: auth.userId, contactId: targetId } },
        create: { userId: auth.userId, contactId: targetId },
        update: {},
      });
      added += 1;
    } else if (!targetId) {
      // Outside the db; in S-104 we just count it. The full invite-by-SMS
      // flow lands with S-129 push + S-101 sign-up.
      invited += 1;
    }
  }

  addBreadcrumb("onboarding.contacts_imported", {
    userId: auth.userId,
    added,
    invited,
  });

  return NextResponse.json({ ok: true, added, invited });
}
