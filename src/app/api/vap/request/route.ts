// POST /api/vap/request — create a money request.
// GET  /api/vap/request — list requests where I'm payer or requester
//                         (status defaults to pending; pass ?status=all).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createRequest } from "@/lib/vap/request";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface CreateBody {
  toUserId?: string;
  amountCents?: number;
  note?: string;
  threadMessage?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`vap:request:${auth.userId}:${ip}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.toUserId || typeof body.amountCents !== "number") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS" } },
      { status: 400 },
    );
  }

  let messageId: string | undefined;
  if (body.threadMessage) {
    try {
      const msg = await prisma.message.create({
        data: {
          senderId: auth.userId,
          receiverId: body.toUserId,
          type: "vap_request",
          content: JSON.stringify({
            kind: "vap_request",
            amountCents: body.amountCents,
            currency: "USD",
            note: body.note?.slice(0, 140) ?? null,
            status: "pending",
          }),
          deliveredAt: new Date(),
        },
        select: { id: true },
      });
      messageId = msg.id;
    } catch { /* non-fatal */ }
  }

  const result = await createRequest({
    fromUserId: auth.userId,
    toUserId: body.toUserId,
    amountCents: body.amountCents,
    note: body.note,
    messageId,
  });

  if (!result.ok) {
    if (messageId) {
      await prisma.message.delete({ where: { id: messageId } }).catch(() => undefined);
    }
    return NextResponse.json(
      { success: false, error: { code: result.reason } },
      { status: 400 },
    );
  }

  // Stamp the requestId back into the message content so the bubble
  // knows which row to act on when the recipient hits Pay/Decline.
  if (messageId) {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        content: JSON.stringify({
          kind: "vap_request",
          amountCents: body.amountCents,
          currency: "USD",
          note: body.note?.slice(0, 140) ?? null,
          status: "pending",
          requestId: result.requestId,
          expiresAt: result.expiresAt,
        }),
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    success: true,
    data: {
      requestId: result.requestId,
      expiresAt: result.expiresAt,
      messageId,
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const where = status === "all"
    ? { OR: [{ fromUserId: auth.userId }, { toUserId: auth.userId }] }
    : { status, OR: [{ fromUserId: auth.userId }, { toUserId: auth.userId }] };
  const rows = await prisma.vapRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      amount: true,
      currency: true,
      note: true,
      status: true,
      splitGroupId: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      amountCents: Math.round(Number(r.amount) * 100),
      amount: undefined,
    })),
  });
}
