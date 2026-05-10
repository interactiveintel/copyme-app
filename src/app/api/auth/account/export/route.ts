// GET /api/auth/account/export — GDPR Art. 15 data export (S-146).
//
// Returns a JSON dump of the user's PII + counts. Production export ZIP
// is built by the cron worker; this endpoint is the immediate "see your
// data" view referenced by the UI.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const userId = auth.userId;
  const [user, contacts, sentCount, receivedCount, sessions, interests, location] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        accountTier: true,
        createdAt: true,
        emailVerifiedAt: true,
        lastActivityAt: true,
        streakDays: true,
        referralCode: true,
      },
    }),
    prisma.contact.findMany({
      where: { userId },
      select: { contactId: true, createdAt: true },
    }),
    prisma.message.count({ where: { senderId: userId } }),
    prisma.message.count({ where: { receiverId: userId } }),
    prisma.session.findMany({
      where: { userId },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    }),
    prisma.userInterest.findMany({ where: { userId }, select: { slotNumber: true, interestText: true } }),
    prisma.userLocation.findUnique({ where: { userId } }),
  ]);

  if (!user) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const payload = {
    schema: "copyme-data-export/v1",
    issuedAt: new Date().toISOString(),
    user,
    profile: { interests, location },
    contacts,
    sessions,
    counts: { sent: sentCount, received: receivedCount },
    note:
      "This JSON view is the same data the ZIP archive will contain when " +
      "your hard-delete request finishes processing. Encrypted message " +
      "ciphertext is stored on-device and is not part of this export.",
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="copyme-export-${userId}.json"`,
    },
  });
}
