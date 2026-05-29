"use client";

// CallHistorySheet — bottom sheet listing the signed-in user's recent
// calls (last 50). Pattern mirrors BlockedUsersSheet so the Settings
// modal feels consistent.
//
// Mounted from ProfileScreen → Settings → "Call history".
// Data: GET /api/calls (enriched server-side in v4.15.7 with
// otherParty.{id, displayName, avatarUrl} + isOutbound).
//
// Tap "Call back" on a terminal-state row to redial that contact —
// dispatches the same copyme:start-outbound-call event the chat-screen
// Phone/Video buttons use, so GlobalCallListener handles the rest.

import { motion } from "framer-motion";
import {
  X, Phone, PhoneMissed, PhoneIncoming, PhoneOutgoing, Video,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import Avatar from "../ui/Avatar";
import { startOutboundCall } from "./GlobalCallListener";

interface CallRow {
  id: string;
  callType: "voice" | "video";
  status: "ringing" | "accepted" | "declined" | "missed" | "ended" | "failed";
  isOutbound: boolean;
  durationSeconds: number | null;
  createdAt: string;
  otherParty: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface Props {
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
}

function formatDuration(s: number | null): string | null {
  if (s == null) return null;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m}m ${r}s` : `${m}m`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `Yesterday · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function CallHistorySheet({ authFetch, onClose }: Props) {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/calls?status=all&limit=50");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setError("Couldn't load call history.");
        return;
      }
      setRows((data.data ?? []) as CallRow[]);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

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
              <Phone size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Call history</h3>
              <p className="text-[11px] text-slate-500">Last 50 calls.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"
            aria-label="Close call history"
          >
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <p className="text-xs text-rose-500 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-slate-500 text-sm font-medium">No calls yet.</p>
              <p className="text-slate-400 text-xs mt-1">
                Your call history will appear here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const missed = row.status === "missed" || row.status === "declined" || row.status === "failed";
                const isVideo = row.callType === "video";
                const tone = missed ? "text-rose-500" : "text-slate-400";
                const StatusIcon = missed
                  ? PhoneMissed
                  : row.isOutbound
                    ? PhoneOutgoing
                    : PhoneIncoming;
                const duration = formatDuration(row.durationSeconds);
                const subtitle = (() => {
                  switch (row.status) {
                    case "ended":   return duration ?? "Ended";
                    case "missed":  return row.isOutbound ? "No answer" : "Missed call";
                    case "declined": return row.isOutbound ? "Declined" : "You declined";
                    case "failed":  return "Failed";
                    case "ringing": return "Ringing…";
                    case "accepted": return "In progress";
                    default: return "";
                  }
                })();
                const canCallBack = !row.isOutbound || row.status !== "ringing";
                return (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100"
                  >
                    {row.otherParty.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.otherParty.avatarUrl}
                        alt={row.otherParty.displayName}
                        className="w-10 h-10 rounded-full object-cover bg-slate-200"
                      />
                    ) : (
                      <Avatar name={row.otherParty.displayName} size="sm" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {row.otherParty.displayName}
                      </p>
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <StatusIcon size={11} className={tone} />
                        {isVideo && <Video size={11} className="text-slate-400" />}
                        <span className={`${tone} truncate`}>{subtitle}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-400">{formatWhen(row.createdAt)}</span>
                      </div>
                    </div>
                    {canCallBack && (
                      <button
                        type="button"
                        onClick={() => {
                          startOutboundCall({
                            calleeId: row.otherParty.id,
                            calleeName: row.otherParty.displayName,
                            calleeAvatarUrl: row.otherParty.avatarUrl,
                            callType: row.callType,
                          });
                          onClose();
                        }}
                        className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 flex items-center justify-center text-emerald-600"
                        aria-label={`Call ${row.otherParty.displayName} back`}
                      >
                        {isVideo ? <Video size={14} /> : <Phone size={14} />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
