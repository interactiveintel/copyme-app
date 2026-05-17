"use client";

// ReportUserSheet — small modal that captures a reason + optional details
// and POSTs /api/reports. Used by ChatScreen for both "report this user"
// (header overflow menu) and "report this message" (per-message icon).
//
// The reports API accepts: reportedId, reason (enum), details (<=2000 chars).
// When reporting a specific message we tuck the messageId into details so
// moderators have context — the schema doesn't model per-message reports
// yet, so the prefix is the workaround.

import { motion } from "framer-motion";
import { X, Flag } from "lucide-react";
import { useState } from "react";

// Must match ALLOWED_REASONS in /api/reports.
const REASONS = [
  { value: "harassment", label: "Harassment or bullying" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "sexual_content", label: "Sexual / inappropriate content" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "underage_user", label: "Underage user" },
  { value: "other", label: "Something else" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

interface Props {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  reportedId: string;
  reportedName: string;
  /** When set, this is a per-message report. The id is prepended to details. */
  messageId?: string;
  /** Optional preset reason (e.g. message icon defaults to "inappropriate"). */
  defaultReason?: Reason;
  onClose: () => void;
  /** Called on successful submission so the parent can show a toast. */
  onSubmitted?: () => void;
}

export default function ReportUserSheet({
  authFetch,
  reportedId,
  reportedName,
  messageId,
  defaultReason,
  onClose,
  onSubmitted,
}: Props) {
  const [reason, setReason] = useState<Reason>(defaultReason ?? "harassment");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_DETAILS = 500;

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // Per-message reports get a small context prefix in details so
      // moderators can find the message without needing a new schema.
      const trimmed = details.trim().slice(0, MAX_DETAILS);
      const payload = {
        reportedId,
        reason,
        details: messageId
          ? `[messageId:${messageId}] ${trimmed}`.slice(0, 2000)
          : trimmed || undefined,
      };
      const res = await authFetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        const code = data?.error?.code as string | undefined;
        if (code === "RATE_LIMITED") {
          setError("You've sent a lot of reports recently. Try again later.");
        } else if (code === "SELF_REPORT") {
          setError("You can't report yourself.");
        } else {
          setError(data?.error?.message ?? "Couldn't file the report.");
        }
        return;
      }
      onSubmitted?.();
      onClose();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center">
              <Flag size={16} className="text-rose-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Report {messageId ? "message" : reportedName}
              </h3>
              <p className="text-[11px] text-slate-500 truncate">
                {messageId
                  ? `from ${reportedName} — our team will review`
                  : "Our team will review and take action"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="Close report"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
              Reason
            </label>
            <div className="space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm text-left transition-colors ${
                    reason === r.value
                      ? "bg-purple-50 border-purple-200 text-purple-700"
                      : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{r.label}</span>
                  {reason === r.value && (
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-1.5">
              Details (optional)
            </label>
            <textarea
              value={details}
              maxLength={MAX_DETAILS}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Anything else our team should know?"
              className="w-full text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-purple-500/40 resize-none"
            />
            <p className="mt-1 text-[10px] text-slate-400 text-right tabular-nums">
              {details.length}/{MAX_DETAILS}
            </p>
          </div>

          {error && (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-semibold shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : null}
            Submit report
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
