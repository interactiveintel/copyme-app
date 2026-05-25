"use client";

// CallMessageBubble — renders Message rows of type "call" as inline
// chat bubbles. Mirrors the VapMessageBubble pattern.
//
// Content JSON shape (written by /api/calls and updated by
// /api/calls/[id]):
//   {
//     kind: "call",
//     callType: "voice" | "video",
//     status: "ringing"|"accepted"|"declined"|"missed"|"ended"|"failed",
//     callId: string,
//     durationSeconds?: number
//   }

import { motion } from "framer-motion";
import { Phone, PhoneMissed, Video } from "lucide-react";

export interface CallBubblePayload {
  kind: "call";
  callType: "voice" | "video";
  status: "ringing" | "accepted" | "declined" | "missed" | "ended" | "failed";
  callId: string;
  durationSeconds?: number;
}

interface Props {
  payload: CallBubblePayload;
  /** True when the signed-in user *placed* the call. */
  isSent: boolean;
  /** Callback to redial — only useful for missed/declined/ended states. */
  onCallBack?: () => void;
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

export default function CallMessageBubble({ payload, isSent, onCallBack }: Props) {
  const isVideo = payload.callType === "video";
  const Icon = payload.status === "missed" || payload.status === "declined" || payload.status === "failed"
    ? PhoneMissed
    : isVideo ? Video : Phone;

  const label = (() => {
    switch (payload.status) {
      case "ringing": return isSent ? "Calling…" : "Incoming call…";
      case "accepted": return "Call in progress";
      case "ended":   return payload.durationSeconds != null ? `Call · ${formatDuration(payload.durationSeconds)}` : "Call ended";
      case "missed":  return isSent ? "No answer" : "Missed call";
      case "declined": return isSent ? "Declined" : "You declined";
      case "failed":  return "Call failed";
      default: return "Call";
    }
  })();

  const tone =
    payload.status === "missed" || payload.status === "declined" || payload.status === "failed"
      ? "bg-rose-50 border-rose-200 text-rose-600"
      : payload.status === "ringing" || payload.status === "accepted"
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-slate-50 border-slate-200 text-slate-600";

  // "Call back" is only meaningful for missed/declined/ended states
  // when the bubble belongs to the *callee* who didn't answer, or
  // when the *caller* wants to redial after no-answer. To keep v1
  // simple we always show it on terminal states (any participant).
  const showCallBack = onCallBack && (payload.status === "missed" || payload.status === "declined" || payload.status === "ended");

  return (
    <motion.div
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`max-w-[260px] rounded-2xl p-3 border ${tone} shadow-sm`}
    >
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
          isVideo ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "bg-gradient-to-br from-emerald-500 to-emerald-600"
        }`}>
          <Icon size={14} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide font-semibold opacity-70">
            {isSent ? "Outgoing" : "Incoming"} · {isVideo ? "video" : "voice"}
          </p>
          <p className="text-sm font-semibold leading-tight">{label}</p>
        </div>
      </div>

      {showCallBack && (
        <button
          type="button"
          onClick={onCallBack}
          className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-white text-slate-700 text-xs font-medium border border-slate-200 hover:bg-slate-50"
        >
          <Phone size={11} />
          Call back
        </button>
      )}
    </motion.div>
  );
}
