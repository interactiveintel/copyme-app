// POST /api/vap/transfer — atomic P2P move from auth.user → receiverId.
//
// Body: { receiverId, amountCents, note?, threadMessage? }
//   * threadMessage = true → also writes an inline Message row (type
//     vap_transfer) so the chat thread renders the bubble.
//
// Returns: { transactionId, senderBalanceCents, receiverBalanceCents,
// messageId? }
//
// Returns 422 with a `reason` string for business-rule failures
// (insufficient balance, fraud-decline, same-user, etc.) so the UI can
// render specific copy without parsing a single generic 400.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { transfer } from "@/lib/vap/transfer";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface Body {
  receiverId?: string;
  amountCents?: number;
  note?: string;
  /** When true, write a Message row of type vap_transfer between the
   *  pair so the chat renders the inline bubble. */
  threadMessage?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  // Per-user rate limit: 30 transfers/min. Higher than per-IP since one
  // user could legitimately fire many transfers if they're catching up
  // on a tab of splits.
  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`vap:transfer:${auth.userId}:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.receiverId || typeof body.amountCents !== "number") {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS" } },
      { status: 400 },
    );
  }

  // Pre-create the thread message so we can pass its id into transfer().
  // If transfer fails we clean up the message row.
  let messageId: string | undefined;
  if (body.threadMessage) {
    try {
      const msg = await prisma.message.create({
        data: {
          senderId: auth.userId,
          receiverId: body.receiverId,
          type: "vap_transfer",
          content: JSON.stringify({
            kind: "vap_transfer",
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
    } catch {
      // Don't block the transfer — the bubble just won't appear in the thread.
    }
  }

  const result = await transfer({
    senderId: auth.userId,
    receiverId: body.receiverId,
    amountCents: body.amountCents,
    note: body.note,
    messageId,
  });

  if (!result.ok) {
    // Tidy up the thread message if it was created.
    if (messageId) {
      await prisma.message.delete({ where: { id: messageId } }).catch(() => undefined);
    }
    const status = result.reason === "INSUFFICIENT_BALANCE" || result.reason === "FRAUD_SCORE_HIGH" ? 422 : 400;
    return NextResponse.json(
      { success: false, error: { code: result.reason } },
      { status },
    );
  }

  // Stamp the transactionId into the Message row's content so the chat
  // bubble can render a deep-link / receipt.
  if (messageId) {
    await prisma.message.update({
      where: { id: messageId },
      data: {
        content: JSON.stringify({
          kind: "vap_transfer",
          amountCents: body.amountCents,
          currency: "USD",
          note: body.note?.slice(0, 140) ?? null,
          status: "completed",
          transactionId: result.transactionId,
        }),
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    success: true,
    data: {
      transactionId: result.transactionId,
      senderBalanceCents: result.senderBalanceCents,
      receiverBalanceCents: result.receiverBalanceCents,
      messageId,
    },
  });
}
