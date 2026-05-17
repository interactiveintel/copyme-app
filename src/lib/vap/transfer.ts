// Atomic VAP P2P transfer (D9).
//
// All ledger writes happen inside a single Prisma $transaction so we
// never end up in a "money debited but not credited" state under
// concurrent load. The VapTransaction row is written in the same
// transaction so reads see consistent state.
//
// Optional `messageId` parameter ties the transfer to a thread message
// (a Message row with type=vap_transfer) so the conversation can render
// the transfer as an inline bubble. Caller is responsible for creating
// the Message row first and passing its id in — keeps this function
// purely ledger-shaped.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addBreadcrumb, reportError } from "@/lib/observability";
import { scoreTransaction } from "./fraud";

const MAX_AMOUNT_CENTS = 100_000_00; // $100,000 hard ceiling per single transfer
const MIN_AMOUNT_CENTS = 1;          // $0.01 floor
const FRAUD_DECLINE_THRESHOLD = 0.7;

// Decimal balances live in DB as Decimal(12,2). We do ALL math in
// Prisma.Decimal (Decimal.js under the hood) and only convert to a JS
// number at the function boundary — $0.10 + $0.20 in floats is the
// classic 0.30000000000000004 trap, fatal for a money ledger.
const CENTS_PER_DOLLAR = new Prisma.Decimal(100);

function decimalToCents(d: Prisma.Decimal): number {
  // .mul(100).toNumber() is exact here because Decimal(12,2) values have
  // at most 2 fractional digits — multiplying by 100 yields an integer
  // well within JS's safe-integer range (max would be 100_000_00_00).
  return d.mul(CENTS_PER_DOLLAR).toNumber();
}

export type TransferReason =
  | "OK"
  | "INVALID_AMOUNT"
  | "SAME_USER"
  | "RECIPIENT_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "FRAUD_SCORE_HIGH"
  | "ERROR";

export interface TransferResult {
  ok: boolean;
  reason: TransferReason;
  transactionId?: string;
  senderBalanceCents?: number;
  receiverBalanceCents?: number;
  fraudScore?: number;
}

/**
 * Move `amountCents` from sender → receiver. Atomic. Idempotent only
 * if the caller dedupes upstream (we don't accept a client-supplied
 * idempotency key in v1 — Tier D Phase 2 wires that up alongside the
 * BaaS partner integration).
 */
export async function transfer(args: {
  senderId: string;
  receiverId: string;
  amountCents: number;
  note?: string;
  /** Optional Message row id this transfer is bound to. */
  messageId?: string;
  /** Optional fraud-scoring context. */
  deviceId?: string;
  countryIso2?: string;
}): Promise<TransferResult> {
  const { senderId, receiverId, amountCents, note, messageId } = args;

  // ---- Pre-flight validations (fast-fail before opening a tx) ----------
  if (!Number.isFinite(amountCents) || amountCents < MIN_AMOUNT_CENTS || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }
  if (senderId === receiverId) {
    return { ok: false, reason: "SAME_USER" };
  }
  const recipient = await prisma.user.findUnique({
    where: { id: receiverId },
    select: { id: true },
  });
  if (!recipient) {
    return { ok: false, reason: "RECIPIENT_NOT_FOUND" };
  }

  // Single conversion point from cents-on-wire → Decimal-internal. Every
  // ledger touch from here on uses `amount` (a Decimal), not amountCents.
  const amount = new Prisma.Decimal(amountCents).div(CENTS_PER_DOLLAR);

  // ---- Fraud check (out-of-tx — pure read) -----------------------------
  let fraudScore = 0;
  try {
    const signal = await scoreTransaction({
      userId: senderId,
      // fraud lib takes a JS number (EUR/USD) — boundary conversion only.
      amountEur: amount.toNumber(),
      deviceId: args.deviceId,
      countryIso2: args.countryIso2,
    });
    fraudScore = signal.score;
    if (fraudScore >= FRAUD_DECLINE_THRESHOLD) {
      addBreadcrumb("vap.transfer.fraud_decline", { senderId, fraudScore, reasons: signal.reasons.join(",") });
      return { ok: false, reason: "FRAUD_SCORE_HIGH", fraudScore };
    }
  } catch (err) {
    // Don't let a fraud-lib outage block transfers — log and continue.
    reportError(err, { context: "vap.transfer.fraud_score", senderId });
  }

  // ---- Atomic debit + credit + ledger row ------------------------------
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Lazy-create both accounts if missing. Sender starts at 0; that's
      // fine because the next step's update will throw if balance < amount.
      await tx.vapAccount.upsert({
        where: { userId: senderId },
        create: { userId: senderId, balance: 0 },
        update: {},
      });
      await tx.vapAccount.upsert({
        where: { userId: receiverId },
        create: { userId: receiverId, balance: 0 },
        update: {},
      });

      // Re-read sender balance under the row lock.
      const sender = await tx.vapAccount.findUnique({
        where: { userId: senderId },
        select: { balance: true },
      });
      if (sender!.balance.lessThan(amount)) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Debit + credit. Prisma's `decrement`/`increment` are atomic at the
      // SQL level (`balance = balance - X`) and respect the row lock taken
      // by upsert above. Pass Decimal directly — Prisma accepts
      // `Decimal | number | string` for numeric field operations.
      const newSender = await tx.vapAccount.update({
        where: { userId: senderId },
        data: {
          balance: { decrement: amount },
          lastTransactionAt: new Date(),
        },
        select: { balance: true },
      });
      const newReceiver = await tx.vapAccount.update({
        where: { userId: receiverId },
        data: {
          balance: { increment: amount },
          lastTransactionAt: new Date(),
        },
        select: { balance: true },
      });

      const txRow = await tx.vapTransaction.create({
        data: {
          senderId,
          receiverId,
          type: "transfer",
          amount,
          status: "completed",
        },
        select: { id: true },
      });

      // Best-effort link the Message row → VapTransaction. We don't have a
      // FK from Message to VapTransaction in the schema; the linkage is
      // stored in Message.content (JSON) by the caller.
      if (messageId) {
        await tx.message.update({
          where: { id: messageId },
          data: {
            // Keep existing content untouched; we just verify the row
            // exists. The caller already wrote {kind:"vap_transfer", ...}
            // into content as JSON.
          },
        }).catch(() => undefined);
      }

      addBreadcrumb("vap.transfer.ok", {
        senderId,
        receiverId,
        amountCents,
        transactionId: txRow.id,
        note: note ? "yes" : "no",
      });

      return {
        transactionId: txRow.id,
        // Boundary conversion: Decimal → cents-on-wire number. Exact for
        // Decimal(12,2) values multiplied by 100.
        senderBalanceCents: decimalToCents(newSender.balance),
        receiverBalanceCents: decimalToCents(newReceiver.balance),
      };
    });

    return { ok: true, reason: "OK", fraudScore, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "INSUFFICIENT_BALANCE") {
      return { ok: false, reason: "INSUFFICIENT_BALANCE" };
    }
    reportError(err, { context: "vap.transfer.tx", senderId, receiverId, amountCents });
    return { ok: false, reason: "ERROR" };
  }
}
