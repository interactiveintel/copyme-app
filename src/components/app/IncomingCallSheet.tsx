"use client";

// IncomingCallSheet — full-screen accept/decline prompt for the callee.
//
// Mounted by ChatScreen (and eventually any screen) when polling
// /api/calls/incoming returns a ringing call where I'm the callee.
// Accept → PATCH /api/calls/[id] { action: "accept" } → mount CallSheet
// Decline → PATCH /api/calls/[id] { action: "decline" } → unmount.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import Avatar from "../ui/Avatar";

interface Props {
  callId: string;
  callerName: string;
  callerAvatarUrl?: string | null;
  callType: "voice" | "video";
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Called after successfully POST-accepting. The parent should now
   *  mount CallSheet. */
  onAccepted: () => void;
  /** Called after declining (or on dismiss). */
  onDismissed: () => void;
}

export default function IncomingCallSheet({
  callId,
  callerName,
  callerAvatarUrl,
  callType,
  authFetch,
  onAccepted,
  onDismissed,
}: Props) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  // Ringtone via WebAudio so we don't ship an asset. Two-tone phone ring
  // pattern on a loop — stops on unmount or when busy.
  useEffect(() => {
    if (typeof window === "undefined" || !("AudioContext" in window)) return;
    const ctx = new AudioContext();
    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const playBeep = (freq: number, when: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(0.18, when + 0.02);
      gain.gain.linearRampToValueAtTime(0, when + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(when);
      osc.stop(when + duration + 0.05);
    };

    const ring = () => {
      if (stopped) return;
      const t = ctx.currentTime;
      playBeep(440, t, 0.4);
      playBeep(440, t + 0.6, 0.4);
      timeoutId = setTimeout(ring, 3000);
    };
    ring();

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
      ctx.close().catch(() => undefined);
    };
  }, []);

  const respond = async (action: "accept" | "decline") => {
    if (busy) return;
    setBusy(action);
    try {
      const res = await authFetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        if (action === "accept") {
          onAccepted();
        } else {
          onDismissed();
        }
      } else {
        // If accept fails (call already ended on caller's side, etc),
        // just dismiss so the UI doesn't stick.
        onDismissed();
      }
    } catch {
      onDismissed();
    } finally {
      setBusy(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-900 flex flex-col items-center justify-between p-8 text-white"
    >
      <div className="text-center pt-12">
        <p className="text-[11px] uppercase tracking-widest text-white/60 animate-pulse">
          Incoming {callType === "video" ? "video" : "voice"} call
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {callerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={callerAvatarUrl}
            alt={callerName}
            className="w-32 h-32 rounded-full object-cover ring-4 ring-white/30 animate-pulse"
          />
        ) : (
          <Avatar name={callerName} size="xl" />
        )}
        <p className="text-2xl font-bold">{callerName}</p>
      </div>

      <div className="flex items-center gap-12 pb-8">
        <button
          type="button"
          onClick={() => respond("decline")}
          disabled={!!busy}
          className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 disabled:opacity-60"
          aria-label="Decline call"
        >
          <PhoneOff size={26} />
        </button>

        <button
          type="button"
          onClick={() => respond("accept")}
          disabled={!!busy}
          className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 disabled:opacity-60"
          aria-label="Accept call"
        >
          {callType === "video" ? <Video size={26} /> : <Phone size={26} />}
        </button>
      </div>
    </motion.div>
  );
}
