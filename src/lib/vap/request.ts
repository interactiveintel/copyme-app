// VAP money requests (D10) — "X is asking you for $Y."
//
// A VapRequest is intent + state, not money. Money only moves when the
// recipient fulfills via transfer(). Until then the row sits at status
// `pending` and expires after `REQUEST_TTL_DAYS` days. Lifecycle:
//
//   pending → paid       (recipient hit Pay, transfer succeeded)
//           → declined   (recipient explicitly declined)
//           → canceled   (requester canceled before expiry)
//           → expired    (TTL elapsed; checked lazily on read)
//
// We don't run a sweeper to bulk-expire — the read path treats any
// pending row with expiresAt < now() as expired. A periodic sweeper
// would be a Phase 2 optimization once the table grows.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addBreadcrumb, reportError } from "@/lib/observability";
import { transfer } from "./transfer";

const REQUEST_TTL_DAYS = 7;
const MAX_AMOUNT_CENTS = 100_000_00;
const MIN_AMOUNT_CENTS = 1;

// Cents↔Decimal conversion lives here too so we never accidentally
// round-trip a money value through a JS float. See transfer.ts for the
// full rationale.
const CENTS_PER_DOLLAR = new Prisma.Decimal(100);

export type CreateRequestReason =
  | "OK"
  | "INVALID_AMOUNT"
  | "SAME_USER"
  | "RECIPIENT_NOT_FOUND"
  | "ERROR";

export interface CreateRequestResult {
  ok: boolean;
  reason: CreateRequestReason;
  requestId?: string;
  expiresAt?: string;
}

export async function createRequest(args: {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
  note?: string;
  splitGroupId?: string;
  messageId?: string;
}): Promise<CreateRequestResult> {
  const { fromUserId, toUserId, amountCents, note, splitGroupId, messageId } = args;

  if (!Number.isFinite(amountCents) || amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  if (fromUserId === toUserId) {
    return { ok: false, reason: "SAME_USER" };
  }
  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  });
  if (!recipient) {
    return { ok: false, reason: "RECIPIENT_NOT_FOUND" };
  }

  const expiresAt = new Date(Date.now() + REQUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  try {
    const row = await prisma.vapRequest.create({
      data: {
        fromUserId,
        toUserId,
        amount: new Prisma.Decimal(amountCents).div(CENTS_PER_DOLLAR),
        note: note?.slice(0, 140) ?? null,
        splitGroupId: splitGroupId ?? null,
        messageId: messageId ?? null,
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    addBreadcrumb("vap.request.created", { fromUserId, toUserId, amountCents, requestId: row.id });
    return { ok: true, reason: "OK", requestId: row.id, expiresAt: row.expiresAt.toISOString() };
  } catch (err) {
    reportError(err, { context: "vap.request.create", fromUserId, toUserId, amountCents });
    return { ok: false, reason: "ERROR" };
  }
}

// ---------------------------------------------------------------------

export type ActionRequestReason =
  | "OK"
  | "REQUEST_NOT_FOUND"
  | "WRONG_PAYER"
  | "ALREADY_RESOLVED"
  | "EXPIRED"
  | "INSUFFICIENT_BALANCE"
  | "TRANSFER_FAILED"
  | "ERROR";

export interface ActionRequestResult {
  ok: boolean;
  reason: ActionRequestReason;
  transactionId?: string;
  status?: string;
}

/**
 * Recipient (`payerId`) accepts a pending request by transferring the
 * requested amount to the original requester. Atomic from the caller's
 * perspective: the request row only flips to `paid` if the transfer
 * succeeded.
 */
export async function fulfillRequest(args: {
  requestId: string;
  payerId: string;
  deviceId?: string;
  countryIso2?: string;
}): Promise<ActionRequestResult> {
  const { requestId, payerId } = args;

  const req = await prisma.vapRequest.findUnique({
    where: { id: requestId },
    select: { id: true, fromUserId: true, toUserId: true, amount: true, status: true, expiresAt: true },
  });
  if (!req) return { ok: false, reason: "REQUEST_NOT_FOUND" };
  if (req.toUserId !== payerId) return { ok: false, reason: "WRONG_PAYER" };
  if (req.status !== "pending") return { ok: false, reason: "ALREADY_RESOLVED", status: req.status };
  if (req.expiresAt < new Date()) {
    // Lazy-expire. Caller can re-call to see the updated state.
    await prisma.vapRequest.update({
      where: { id: requestId },
      data: { status: "expired" },
    });
    return { ok: false, reason: "EXPIRED" };
  }

  // Decimal → integer cents. Exact for Decimal(12,2) values multiplied
  // by 100; transfer() takes cents-on-wire as its contract.
  const amountCents = req.amount.mul(CENTS_PER_DOLLAR).toNumber();
  const result = await transfer({
    senderId: payerId,
    receiverId: req.fromUserId,
    amountCents,
    deviceId: args.deviceId,
    countryIso2: args.countryIso2,
  });
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason === "INSUFFICIENT_BALANCE" ? "INSUFFICIENT_BALANCE" : "TRANSFER_FAILED",
    };
  }
  await prisma.vapRequest.update({
    where: { id: requestId },
    data: { status: "paid", fulfilledTransactionId: result.transactionId },
  });
  addBreadcrumb("vap.request.paid", { requestId, transactionId: result.transactionId });
  return { ok: true, reason: "OK", transactionId: result.transactionId, status: "paid" };
}

export async function declineRequest(args: {
  requestId: string;
  payerId: string;
}): Promise<ActionRequestResult> {
  const req = await prisma.vapRequest.findUnique({
    where: { id: args.requestId },
    select: { id: true, toUserId: true, status: true },
  });
  if (!req) return { ok: false, reason: "REQUEST_NOT_FOUND" };
  if (req.toUserId !== args.payerId) return { ok: false, reason: "WRONG_PAYER" };
  if (req.status !== "pending") return { ok: false, reason: "ALREADY_RESOLVED", status: req.status };
  await prisma.vapRequest.update({
    where: { id: args.requestId },
    data: { status: "declined" },
  });
  addBreadcrumb("vap.request.declined", { requestId: args.requestId });
  return { ok: true, reason: "OK", status: "declined" };
}

export async function cancelRequest(args: {
  requestId: string;
  requesterId: string;
}): Promise<ActionRequestResult> {
  const req = await prisma.vapRequest.findUnique({
    where: { id: args.requestId },
    select: { id: true, fromUserId: true, status: true },
  });
  if (!req) return { ok: false, reason: "REQUEST_NOT_FOUND" };
  if (req.fromUserId !== args.requesterId) return { ok: false, reason: "WRONG_PAYER" };
  if (req.status !== "pending") return { ok: false, reason: "ALREADY_RESOLVED", status: req.status };
  await prisma.vapRequest.update({
    where: { id: args.requestId },
    data: { status: "canceled" },
  });
  addBreadcrumb("vap.request.canceled", { requestId: args.requestId });
  return { ok: true, reason: "OK", status: "canceled" };
}
