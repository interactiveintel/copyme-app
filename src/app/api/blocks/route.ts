// POST   /api/blocks  — block a user (S-172). Body: { userId, reason? }
// DELETE /api/blocks  — unblock. Body: { userId }
// GET    /api/blocks  — list blocked users.
//
// Block is mutual-invisibility: the existing `UserBlock` model is asymmetric,
// but message read paths must filter both directions to honor "no
// 'you've been blocked' leak."

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId, reason } = body as { userId?: string; reason?: string };
  if (!userId || userId === auth.userId) {
    return NextResponse.json({ error: "INVALID_TARGET" }, { status: 400 });
  }
  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: auth.userId, blockedId: userId } },
    create: { blockerId: auth.userId, blockedId: userId, reason: reason?.slice(0, 500) ?? null },
    update: {},
  });
  // Drop the contact relationship in both directions so the inbox UX matches.
  await prisma.contact.deleteMany({
    where: {
      OR: [
        { userId: auth.userId, contactId: userId },
        { userId: userId, contactId: auth.userId },
      ],
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { userId } = body as { userId?: string };
  if (!userId) return NextResponse.json({ error: "MISSING_USER" }, { status: 400 });
  const r = await prisma.userBlock.deleteMany({
    where: { blockerId: auth.userId, blockedId: userId },
  });
  return NextResponse.json({ ok: true, removed: r.count });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: auth.userId },
    select: {
      blockedId: true,
      reason: true,
      createdAt: true,
      blocked: { select: { id: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ blocks });
}
