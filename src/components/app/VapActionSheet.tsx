"use client";

// VapActionSheet — bottom sheet that lets the user Send / Request /
// Split with the current chat peer. Mounted from ChatScreen via a $
// button next to the attachment icon.
//
// Tabs:
//   send    → POST /api/vap/transfer (thread bubble)
//   request → POST /api/vap/request  (thread bubble)
//   split   → POST /api/vap/split    (no inline bubble — owner gets a
//              receipt in their requests inbox; we render a confirmation
//              banner inside the sheet)
//
// Balance + lazy-load: opens to fetch /api/vap/account once so the user
// sees their balance before sending. If the network is offline we render
// "-" and disable the send button.

import { motion } from "framer-motion";
import { X, ArrowUpRight, ArrowDownLeft, Users, Wallet, Plus, Minus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import Avatar from "../ui/Avatar";

type Tab = "send" | "request" | "split";

interface SplitRow {
  userId: string;
  displayName?: string;
  cents: number;
}

interface Props {
  /** Auth-wrapped fetch from useAuth(). */
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Peer this sheet acts on. Used as the default Send/Request target. */
  peerId: string;
  peerName: string;
  /** Optional extra contacts the split tab can pick from. The peer is
   *  always pre-included as the first recipient. */
  splitCandidates?: Array<{ id: string; displayName: string }>;
  onClose: () => void;
  /** Called when a Send/Request fires successfully. Lets the parent
   *  refetch its message list immediately so the bubble appears. */
  onSent?: (kind: "transfer" | "request" | "split") => void;
}

interface AccountSnapshot {
  balanceCents: number;
  currency: string;
}

export default function VapActionSheet({
  authFetch,
  peerId,
  peerName,
  splitCandidates = [],
  onClose,
  onSent,
}: Props) {
  const [tab, setTab] = useState<Tab>("send");
  const [amountCents, setAmountCents] = useState<number>(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountSnapshot | null>(null);
  const [splitRows, setSplitRows] = useState<SplitRow[]>([
    { userId: peerId, displayName: peerName, cents: 0 },
  ]);
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");

  // ---- Load balance on open --------------------------------------------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authFetch("/api/vap/account");
        if (!res.ok) return;
        const data = await res.json();
        if (alive) {
          // getOrCreateAccount returns balanceCents already in cents.
          setAccount({
            balanceCents: Number(data.data?.balanceCents ?? 0),
            currency: data.data?.currency ?? "USD",
          });
        }
      } catch {
        /* offline → just hide balance */
      }
    })();
    return () => {
      alive = false;
    };
  }, [authFetch]);

  // ---- Amount entry ----------------------------------------------------
  const onAmountChange = (raw: string) => {
    // Strip non-digits and treat as cents (e.g. "525" → $5.25)
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    setAmountCents(digits ? parseInt(digits, 10) : 0);
  };
  const currency = account?.currency ?? "USD";
  const formatCents = useCallback(
    (cents: number) => {
      const dollars = cents / 100;
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(dollars);
    },
    [currency],
  );

  // ---- Split helpers ---------------------------------------------------
  const addSplitRow = () => {
    // Pick the next splitCandidate not already in the rows
    const used = new Set(splitRows.map((r) => r.userId));
    const next = splitCandidates.find((c) => !used.has(c.id));
    if (!next) return;
    if (splitRows.length >= 7) return;
    setSplitRows([...splitRows, { userId: next.id, displayName: next.displayName, cents: 0 }]);
  };
  const removeSplitRow = (userId: string) => {
    if (splitRows.length <= 1) return;
    setSplitRows(splitRows.filter((r) => r.userId !== userId));
  };
  const updateSplitCents = (userId: string, cents: number) => {
    setSplitRows(splitRows.map((r) => (r.userId === userId ? { ...r, cents } : r)));
  };
  const splitTotalCustomCents = splitRows.reduce((s, r) => s + (r.cents || 0), 0);

  // ---- Submit ----------------------------------------------------------
  const submit = useCallback(async () => {
    setError(null);
    setConfirmation(null);
    if (busy) return;

    if (tab === "send" || tab === "request") {
      if (amountCents < 1) {
        setError("Enter an amount.");
        return;
      }
      if (tab === "send" && account && amountCents > account.balanceCents) {
        setError("Insufficient balance.");
        return;
      }
      setBusy(true);
      try {
        if (tab === "send") {
          const res = await authFetch("/api/vap/transfer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              receiverId: peerId,
              amountCents,
              note: note.trim() || undefined,
              threadMessage: true,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            setError(data.error?.code ?? "Send failed.");
            return;
          }
          onSent?.("transfer");
          onClose();
        } else {
          const res = await authFetch("/api/vap/request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              toUserId: peerId,
              amountCents,
              note: note.trim() || undefined,
              threadMessage: true,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.success) {
            setError(data.error?.code ?? "Request failed.");
            return;
          }
          onSent?.("request");
          onClose();
        }
      } catch {
        setError("Network error.");
      } finally {
        setBusy(false);
      }
      return;
    }

    // ---- Split -----
    if (tab === "split") {
      if (amountCents < splitRows.length) {
        setError("Amount too small to split.");
        return;
      }
      if (splitMode === "custom" && splitTotalCustomCents !== amountCents) {
        setError(`Per-person total (${formatCents(splitTotalCustomCents)}) must equal ${formatCents(amountCents)}.`);
        return;
      }
      setBusy(true);
      try {
        const body = {
          totalCents: amountCents,
          mode: splitMode,
          note: note.trim() || undefined,
          recipients: splitRows.map((r) => ({
            userId: r.userId,
            ...(splitMode === "custom" ? { cents: r.cents } : {}),
          })),
        };
        const res = await authFetch("/api/vap/split", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          setError(data.error?.code ?? "Split failed.");
          return;
        }
        setConfirmation(`Sent ${splitRows.length} requests · split ${formatCents(amountCents)}.`);
        onSent?.("split");
      } catch {
        setError("Network error.");
      } finally {
        setBusy(false);
      }
    }
  }, [
    tab,
    amountCents,
    note,
    peerId,
    busy,
    account,
    authFetch,
    onSent,
    onClose,
    splitMode,
    splitRows,
    splitTotalCustomCents,
    formatCents,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 px-5 pt-5 pb-4">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
          >
            <X size={16} className="text-white" />
          </button>
          <div className="flex items-center gap-2 text-white">
            <Wallet size={16} />
            <span className="text-[11px] uppercase tracking-wide font-semibold opacity-90">
              VAP Wallet
            </span>
          </div>
          <p className="mt-1 text-2xl font-bold text-white">
            {account ? formatCents(account.balanceCents) : "—"}
          </p>
          <p className="text-[11px] text-white/70">Available balance</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {(["send", "request", "split"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setError(null);
                setConfirmation(null);
              }}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t
                  ? "text-purple-600 border-b-2 border-purple-500"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t === "send" ? "Send" : t === "request" ? "Request" : "Split"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Recipient summary */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <Avatar name={peerName} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400">
                {tab === "send" ? "Sending to" : tab === "request" ? "Requesting from" : "Splitting with"}
              </p>
              <p className="text-sm font-semibold text-slate-800 truncate">{peerName}</p>
            </div>
            {tab === "send" ? (
              <ArrowUpRight size={16} className="text-emerald-500" />
            ) : tab === "request" ? (
              <ArrowDownLeft size={16} className="text-indigo-500" />
            ) : (
              <Users size={16} className="text-purple-500" />
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
              Amount
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amountCents ? formatCents(amountCents) : ""}
              onChange={(e) => onAmountChange(e.target.value)}
              placeholder={formatCents(0)}
              className="w-full text-2xl font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
              Note (optional, 140 chars)
            </label>
            <input
              type="text"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tab === "send" ? "Lunch, rent, etc." : tab === "request" ? "What's this for?" : "Dinner split"}
              className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500/40"
            />
          </div>

          {/* Split-only controls */}
          {tab === "split" && (
            <div className="space-y-3">
              {/* Mode toggle */}
              <div className="flex bg-slate-100 rounded-xl p-1">
                {(["equal", "custom"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSplitMode(m)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      splitMode === m ? "bg-white text-purple-600 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {m === "equal" ? "Split equally" : "Custom amounts"}
                  </button>
                ))}
              </div>

              {/* Recipient rows */}
              <div className="space-y-2">
                {splitRows.map((r, i) => (
                  <div
                    key={r.userId}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <Avatar name={r.displayName ?? r.userId.slice(0, 4)} size="sm" />
                    <span className="flex-1 text-xs text-slate-700 truncate">
                      {r.displayName ?? r.userId.slice(0, 8)}
                    </span>
                    {splitMode === "equal" ? (
                      <span className="text-xs text-slate-500 tabular-nums">
                        {amountCents > 0
                          ? formatCents(
                              Math.floor(amountCents / splitRows.length) +
                                (i === 0 ? amountCents % splitRows.length : 0),
                            )
                          : "—"}
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={r.cents ? formatCents(r.cents) : ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                          updateSplitCents(r.userId, digits ? parseInt(digits, 10) : 0);
                        }}
                        placeholder={formatCents(0)}
                        className="w-24 text-right text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1"
                      />
                    )}
                    <button
                      type="button"
                      disabled={splitRows.length === 1}
                      onClick={() => removeSplitRow(r.userId)}
                      className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center disabled:opacity-30"
                    >
                      <Minus size={10} className="text-slate-500" />
                    </button>
                  </div>
                ))}
                {splitCandidates.length > 0 && splitRows.length < 7 && (
                  <button
                    type="button"
                    onClick={addSplitRow}
                    className="w-full flex items-center justify-center gap-1 py-2 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-500 hover:border-purple-300 hover:text-purple-500 transition-colors"
                  >
                    <Plus size={12} /> Add another
                  </button>
                )}
              </div>
              {splitMode === "custom" && amountCents > 0 && (
                <p
                  className={`text-[11px] tabular-nums ${
                    splitTotalCustomCents === amountCents ? "text-emerald-600" : "text-rose-500"
                  }`}
                >
                  Per-person total: {formatCents(splitTotalCustomCents)} of {formatCents(amountCents)}
                </p>
              )}
            </div>
          )}

          {/* Inline error / confirmation */}
          {error && (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {confirmation && (
            <p className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
              {confirmation}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={submit}
            disabled={busy || amountCents < 1}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : null}
            {tab === "send"
              ? `Send ${amountCents > 0 ? formatCents(amountCents) : ""}`.trim()
              : tab === "request"
                ? `Request ${amountCents > 0 ? formatCents(amountCents) : ""}`.trim()
                : `Split ${amountCents > 0 ? formatCents(amountCents) : ""}`.trim()}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
