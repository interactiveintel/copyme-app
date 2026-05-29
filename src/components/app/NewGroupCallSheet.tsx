"use client";

// NewGroupCallSheet — bottom sheet that lets the user pick 2-6 contacts
// from their list and start a group call. Mounted from ProfileScreen
// Settings + InboxScreen + button (v4.15.12 / Tier E Sprint 6).
//
// Rule of 7: caller + up to 6 callees = 7 participants total. Sheet
// caps selection at 6 and disables remaining checkboxes.
//
// On start: POST /api/calls with calleeIds array → server creates the
// group call → dispatches the same window event GlobalCallListener
// uses for 1:1 outbound, so the existing CallSheet + flow apply.

import { motion } from "framer-motion";
import { X, Phone, Video, Users, Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Avatar from "../ui/Avatar";

interface Contact {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Pre-selected contact (e.g. opening the sheet from a chat thread).
   *  Optional. */
  initiallySelected?: string;
  onClose: () => void;
  /** Called after server-side group call create succeeds. Parent
   *  should mount CallSheet for the returned callId. */
  onCallStarted?: (call: { callId: string; room: string }) => void;
}

const MAX_CALLEES = 6;

export default function NewGroupCallSheet({
  authFetch,
  initiallySelected,
  onClose,
  onCallStarted,
}: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initiallySelected ? [initiallySelected] : []),
  );
  const [callType, setCallType] = useState<"voice" | "video">("voice");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/contacts");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError("Couldn't load contacts.");
        return;
      }
      // /api/contacts shape: { data: { contacts: [{ id, displayName, avatarUrl, ...}] } }
      const rows = (data.data?.contacts ?? []) as Array<{
        id?: string;
        displayName?: string;
        avatarUrl?: string | null;
      }>;
      setContacts(
        rows
          .filter((r) => r.id && r.displayName)
          .map((r) => ({
            id: String(r.id),
            displayName: String(r.displayName),
            avatarUrl: r.avatarUrl ?? null,
          })),
      );
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_CALLEES) return prev; // cap
        next.add(id);
      }
      return next;
    });
  };

  const start = async () => {
    if (selected.size < 2 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calleeIds: Array.from(selected),
          callType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setError(
          data?.error?.code === "TOO_MANY_PARTICIPANTS"
            ? "Group calls are limited to 7 people."
            : data?.error?.code === "RECIPIENT_NOT_FOUND"
              ? "One of those contacts isn't reachable."
              : "Couldn't start the call. Try again.",
        );
        return;
      }
      onCallStarted?.({ callId: data.data.callId, room: data.data.room });
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
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
              <Users size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">New group call</h3>
              <p className="text-[11px] text-slate-500">
                Up to 6 contacts (7 total — Rule of 7).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="Close"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {/* Call-type toggle */}
        <div className="px-5 pt-3 pb-2">
          <div className="flex bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setCallType("voice")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                callType === "voice" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <Phone size={12} /> Voice
            </button>
            <button
              type="button"
              onClick={() => setCallType("video")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${
                callType === "video" ? "bg-white text-purple-600 shadow-sm" : "text-slate-500"
              }`}
            >
              <Video size={12} /> Video
            </button>
          </div>
        </div>

        {/* Contacts list with checkboxes */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-slate-500 text-sm font-medium">No contacts yet.</p>
              <p className="text-slate-400 text-xs mt-1">
                Add contacts before starting a group call.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => {
                const isSelected = selected.has(c.id);
                const atCap = !isSelected && selected.size >= MAX_CALLEES;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      disabled={atCap}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                        isSelected
                          ? "bg-emerald-50 border-emerald-200"
                          : atCap
                            ? "bg-slate-50 border-slate-100 opacity-50 cursor-not-allowed"
                            : "bg-slate-50 border-slate-100 hover:border-slate-200"
                      }`}
                    >
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatarUrl}
                          alt={c.displayName}
                          className="w-9 h-9 rounded-full object-cover bg-slate-200"
                        />
                      ) : (
                        <Avatar name={c.displayName} size="sm" />
                      )}
                      <span className="flex-1 text-sm font-semibold text-slate-800 text-left truncate">
                        {c.displayName}
                      </span>
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer with count + Start button */}
        <div className="p-4 border-t border-slate-100">
          <button
            type="button"
            onClick={start}
            disabled={selected.size < 2 || busy}
            className={`w-full py-3.5 rounded-2xl text-white text-sm font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 ${
              callType === "video"
                ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-purple-500/20"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/20"
            }`}
          >
            {busy ? (
              <span className="w-4 h-4 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
            ) : callType === "video" ? (
              <Video size={16} />
            ) : (
              <Phone size={16} />
            )}
            {selected.size < 2
              ? `Pick at least 2 contacts (${selected.size}/${MAX_CALLEES})`
              : `Start ${callType} call with ${selected.size} ${selected.size === 1 ? "person" : "people"}`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
