"use client";

// VapMessageBubble — renders Message rows of type `vap_transfer` or
// `vap_request` as inline chat bubbles, with action buttons for
// pending requests received from the peer.
//
// Two shapes parsed out of Message.content (JSON):
//   { kind: "vap_transfer", amountCents, currency, note?, status, transactionId? }
//   { kind: "vap_request",  amountCents, currency, note?, status, requestId?, transactionId?, expiresAt? }
//
// Status flow:
//   transfer: pending → completed (almost instant; we still render the
//     intermediate state in case the network was slow)
//   request : pending → paid | declined | canceled | expired

import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Check, Clock, X, Hourglass } from "lucide-react";
import { useState } from "react";

export interface VapBubblePayload {
  kind: "vap_transfer" | "vap_request";
  amountCents: number;
  currency: string;
  note?: string | null;
  status: "pending" | "completed" | "paid" | "declined" | "canceled" | "expired";
  transactionId?: string;
  requestId?: string;
  expiresAt?: string;
}

interface Props {
  payload: VapBubblePayload;
  /** True when the signed-in user *sent* the bubble. */
  isSent: boolean;
  /** Action handler — only invoked for requests where the signed-in
   *  user is the recipient (i.e. they got asked for money). */
  onAction?: (action: "fulfill" | "decline" | "cancel") => Promise<void> | void;
  /** Inline disabled state during an action call. */
  busy?: boolean;
}

function formatCents(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function expiryLabel(iso?: string): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  const mins = Math.max(1, Math.floor(ms / 60_000));
  return `${mins}m left`;
}

export default function VapMessageBubble({ payload, isSent, onAction, busy }: Props) {
  const [actionBusy, setActionBusy] = useState<null | "fulfill" | "decline" | "cancel">(null);
  const amount = formatCents(payload.amountCents, payload.currency);
  const isTransfer = payload.kind === "vap_transfer";
  const isRequest = payload.kind === "vap_request";

  // For a received request bubble the *recipient* (isSent === false from
  // their POV) is the one who has to Pay/Decline. For a sent request,
  // the sender can Cancel while pending.
  const showPayDecline = isRequest && !isSent && payload.status === "pending";
  const showCancel = isRequest && isSent && payload.status === "pending";

  const handle = async (action: "fulfill" | "decline" | "cancel") => {
    if (!onAction || actionBusy) return;
    setActionBusy(action);
    try {
      await onAction(action);
    } finally {
      setActionBusy(null);
    }
  };

  // Status pill copy
  const statusCopy: Record<string, { label: string; tone: "ok" | "warn" | "neutral" | "bad" }> = {
    pending: { label: "pending", tone: "warn" },
    completed: { label: "sent", tone: "ok" },
    paid: { label: "paid", tone: "ok" },
    declined: { label: "declined", tone: "bad" },
    canceled: { label: "canceled", tone: "neutral" },
    expired: { label: "expired", tone: "neutral" },
  };
  const status = statusCopy[payload.status] ?? statusCopy.pending;
  const toneClass =
    status.tone === "ok"
      ? "bg-emerald-50 text-emerald-600 border-emerald-200"
      : status.tone === "warn"
        ? "bg-amber-50 text-amber-600 border-amber-200"
        : status.tone === "bad"
          ? "bg-rose-50 text-rose-600 border-rose-200"
          : "bg-slate-50 text-slate-500 border-slate-200";

  return (
    <motion.div
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`max-w-[260px] rounded-2xl p-3 border ${
        isSent
          ? "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 border-purple-200"
          : "bg-white border-slate-200"
      } shadow-sm`}
    >
      {/* Header row: kind + amount */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
            isTransfer
              ? "bg-gradient-to-br from-emerald-400 to-emerald-600"
              : "bg-gradient-to-br from-indigo-500 to-purple-500"
          }`}
        >
          {isTransfer ? (
            <ArrowUpRight size={14} className="text-white" />
          ) : (
            <ArrowDownLeft size={14} className="text-white" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            {isTransfer ? (isSent ? "You sent" : "You received") : isSent ? "You requested" : "Request"}
          </p>
          <p className="text-base font-bold text-slate-900 leading-tight">{amount}</p>
        </div>
        <span
          className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${toneClass}`}
        >
          {status.label}
        </span>
      </div>

      {/* Note */}
      {payload.note ? (
        <p className="text-xs text-slate-600 mb-2 line-clamp-2">&ldquo;{payload.note}&rdquo;</p>
      ) : null}

      {/* Expiry hint for pending requests */}
      {isRequest && payload.status === "pending" && payload.expiresAt && (
        <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
          <Hourglass size={10} />
          <span>{expiryLabel(payload.expiresAt)}</span>
        </div>
      )}

      {/* Action row */}
      {showPayDecline && (
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            disabled={busy || !!actionBusy}
            onClick={() => handle("fulfill")}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-semibold disabled:opacity-50"
          >
            {actionBusy === "fulfill" ? (
              <span className="w-3 h-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check size={12} />
            )}
            Pay
          </button>
          <button
            type="button"
            disabled={busy || !!actionBusy}
            onClick={() => handle("decline")}
            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold disabled:opacity-50"
          >
            {actionBusy === "decline" ? (
              <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <X size={12} />
            )}
            Decline
          </button>
        </div>
      )}

      {showCancel && (
        <button
          type="button"
          disabled={busy || !!actionBusy}
          onClick={() => handle("cancel")}
          className="w-full mt-2 flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200 disabled:opacity-50"
        >
          {actionBusy === "cancel" ? (
            <span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Clock size={11} />
          )}
          Cancel request
        </button>
      )}
    </motion.div>
  );
}
