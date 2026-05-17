// VAP split-bill coordination (D11) — N parallel VapRequests sharing a
// splitGroupId. Each participant gets a regular pending request; paying
// or declining theirs doesn't affect the others'.
//
// Capped at 7 recipients per the Rule of 7 (groups of 7). Anything
// beyond that is rejected at the API layer.
//
// Distribution modes:
//   * equal:  totalCents / N, with any rounding cents added to the
//             requester's "remainder" assignment (always the first
//             entry in recipientIds)
//   * custom: caller supplies per-recipient cents; we validate they
//             sum to totalCents
//
// The created splitGroupId is just a fresh UUID — there's no parent
// row; we use the column as a tag so the read side can
// `findMany({ where: { splitGroupId } })`.

import { randomUUID } from "node:crypto";
import { createRequest } from "./request";
import { addBreadcrumb } from "@/lib/observability";

const MAX_RECIPIENTS = 7;
const MIN_AMOUNT_CENTS = 1;

export type SplitMode = "equal" | "custom";

export type CreateSplitReason =
  | "OK"
  | "TOO_MANY_RECIPIENTS"
  | "NO_RECIPIENTS"
  | "AMOUNT_MISMATCH"
  | "INVALID_AMOUNT"
  | "RECIPIENT_CREATE_FAILED";

export interface CreateSplitResult {
  ok: boolean;
  reason: CreateSplitReason;
  splitGroupId?: string;
  requestIds?: string[];
  /** When some sub-requests fail mid-batch, the ones that did succeed
   *  before the failure are listed here. We don't roll those back since
   *  recipients may have already seen them; instead we surface the
   *  partial state for the requester to act on. */
  partiallyCreatedRequestIds?: string[];
}

export async function createSplit(args: {
  fromUserId: string;
  recipients: Array<{ userId: string; cents?: number }>;
  totalCents: number;
  mode: SplitMode;
  note?: string;
}): Promise<CreateSplitResult> {
  const { fromUserId, recipients, totalCents, mode, note } = args;

  if (recipients.length === 0) return { ok: false, reason: "NO_RECIPIENTS" };
  if (recipients.length > MAX_RECIPIENTS) return { ok: false, reason: "TOO_MANY_RECIPIENTS" };
  if (!Number.isFinite(totalCents) || totalCents < MIN_AMOUNT_CENTS) {
    return { ok: false, reason: "INVALID_AMOUNT" };
  }

  // Compute per-recipient amounts.
  let amounts: number[];
  if (mode === "equal") {
    const base = Math.floor(totalCents / recipients.length);
    const remainder = totalCents - base * recipients.length;
    amounts = recipients.map((_, i) => (i === 0 ? base + remainder : base));
  } else {
    amounts = recipients.map((r) => r.cents ?? 0);
    const sum = amounts.reduce((acc, c) => acc + c, 0);
    if (sum !== totalCents) {
      return { ok: false, reason: "AMOUNT_MISMATCH" };
    }
    if (amounts.some((c) => !Number.isFinite(c) || c < MIN_AMOUNT_CENTS)) {
      return { ok: false, reason: "INVALID_AMOUNT" };
    }
  }

  const splitGroupId = randomUUID();
  const requestIds: string[] = [];
  for (let i = 0; i < recipients.length; i += 1) {
    const r = await createRequest({
      fromUserId,
      toUserId: recipients[i].userId,
      amountCents: amounts[i],
      note,
      splitGroupId,
    });
    if (!r.ok || !r.requestId) {
      return {
        ok: false,
        reason: "RECIPIENT_CREATE_FAILED",
        splitGroupId,
        partiallyCreatedRequestIds: requestIds,
      };
    }
    requestIds.push(r.requestId);
  }
  addBreadcrumb("vap.split.created", {
    fromUserId,
    splitGroupId,
    recipientCount: recipients.length,
    totalCents,
    mode,
  });
  return { ok: true, reason: "OK", splitGroupId, requestIds };
}
