// PATCH /api/vap/request/[id] — fulfill, decline, or cancel a request.
//
// Body: { action: "fulfill" | "decline" | "cancel" }
//   * fulfill is recipient-only; runs transfer + flips status to "paid"
//   * decline is recipient-only; flips status to "declined"
//   * cancel  is requester-only; flips status to "canceled"

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fulfillRequest, declineRequest, cancelRequest } from "@/lib/vap/request";

export const runtime = "nodejs";

interface PatchBody {
  action?: "fulfill" | "decline" | "cancel";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as PatchBody;

  let result;
  switch (body.action) {
    case "fulfill":
      result = await fulfillRequest({ requestId: id, payerId: auth.userId });
      break;
    case "decline":
      result = await declineRequest({ requestId: id, payerId: auth.userId });
      break;
    case "cancel":
      result = await cancelRequest({ requestId: id, requesterId: auth.userId });
      break;
    default:
      return NextResponse.json({ success: false, error: { code: "INVALID_ACTION" } }, { status: 400 });
  }

  if (!result.ok) {
    const status =
      result.reason === "INSUFFICIENT_BALANCE" || result.reason === "ALREADY_RESOLVED" || result.reason === "EXPIRED"
        ? 422
        : 400;
    return NextResponse.json(
      { success: false, error: { code: result.reason, status: result.status } },
      { status },
    );
  }

  // Update the bound Message row's content to reflect the new status,
  // so the chat bubble re-renders without a separate fetch.
  const req2 = await prisma.vapRequest.findUnique({
    where: { id },
    select: { messageId: true, amount: true, currency: true, note: true, status: true, fulfilledTransactionId: true },
  });
  if (req2?.messageId) {
    await prisma.message.update({
      where: { id: req2.messageId },
      data: {
        content: JSON.stringify({
          kind: "vap_request",
          amountCents: Math.round(Number(req2.amount) * 100),
          currency: req2.currency,
          note: req2.note,
          status: req2.status,
          requestId: id,
          transactionId: req2.fulfilledTransactionId ?? undefined,
        }),
      },
    }).catch(() => undefined);
  }

  return NextResponse.json({
    success: true,
    data: {
      requestId: id,
      status: result.status,
      transactionId: result.transactionId,
    },
  });
}
