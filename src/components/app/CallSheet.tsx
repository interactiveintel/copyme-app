"use client";

// CallSheet — full-screen in-call UI for the caller AND callee once
// the call is accepted. Wraps LiveKit's React components for the room
// connection + audio rendering.
//
// Voice-only in v4.15.0 (Sprint 1). Sprint 3 adds video tiles.
//
// Lifecycle:
//   mount:
//     1. POST /api/calls/token { callId } → { token, url }
//     2. <LiveKitRoom> connects to LiveKit Cloud
//     3. Local audio track auto-published; remote audio auto-played
//   unmount or End:
//     PATCH /api/calls/[id] { action: "end" } → status flips to ended

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, MicOff, PhoneOff, Volume2 } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useLocalParticipant,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";
import "@livekit/components-styles";
import Avatar from "../ui/Avatar";

interface Props {
  /** The call id this sheet is bound to. */
  callId: string;
  /** Display name of the other party (for the header). */
  peerName: string;
  /** Avatar URL of the other party (optional — falls back to initials). */
  peerAvatarUrl?: string | null;
  /** "voice" or "video". v4.15.0 treats both as voice; v4.15.2 enables camera. */
  callType: "voice" | "video";
  /** Auth-wrapped fetch. */
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
  /** Called when the sheet has fully torn down (call ended / failed). */
  onClose: () => void;
}

export default function CallSheet({
  callId,
  peerName,
  peerAvatarUrl,
  callType,
  authFetch,
  onClose,
}: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mint a join token on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await authFetch("/api/calls/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok || !data.success) {
          setError(data?.error?.code ?? "Couldn't get a call token.");
          return;
        }
        setToken(data.data.token);
        setServerUrl(data.data.url);
      } catch {
        if (alive) setError("Network error getting call token.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [callId, authFetch]);

  // End the call on the server when the sheet closes — best-effort.
  const endAndClose = async () => {
    try {
      await authFetch(`/api/calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
    } catch {
      /* server-side end is best-effort; client tears down regardless */
    }
    onClose();
  };

  if (error) {
    return (
      <CallShellFatal
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        message={error}
        onClose={onClose}
      />
    );
  }

  if (!token || !serverUrl) {
    return (
      <CallShellLoading
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        callType={callType}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col"
    >
      <LiveKitRoom
        token={token}
        serverUrl={serverUrl}
        connect
        audio
        // v4.15.0 is voice-only. Sprint 3 will read callType here.
        video={false}
        // LiveKit injects an audio element under this component.
        className="flex-1 flex flex-col"
      >
        <CallInnerUI
          peerName={peerName}
          peerAvatarUrl={peerAvatarUrl}
          callType={callType}
          onHangUp={endAndClose}
        />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </motion.div>
  );
}

function CallInnerUI({
  peerName,
  peerAvatarUrl,
  callType,
  onHangUp,
}: {
  peerName: string;
  peerAvatarUrl?: string | null;
  callType: "voice" | "video";
  onHangUp: () => void | Promise<void>;
}) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [muted, setMuted] = useState(false);

  const statusLabel =
    connectionState === ConnectionState.Connecting ? "Connecting…" :
    connectionState === ConnectionState.Connected ? "Connected" :
    connectionState === ConnectionState.Reconnecting ? "Reconnecting…" :
    connectionState === ConnectionState.Disconnected ? "Disconnected" :
    "…";

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    // setMicrophoneEnabled(enabled): true = unmuted.
    await localParticipant.setMicrophoneEnabled(!next);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-between p-8 text-white">
      {/* Header: peer name + status */}
      <div className="text-center pt-12">
        <p className="text-[11px] uppercase tracking-widest text-white/60">
          {callType === "video" ? "Video call" : "Voice call"}
        </p>
        <p className="mt-2 text-xs text-white/50">{statusLabel}</p>
      </div>

      {/* Peer avatar */}
      <div className="flex flex-col items-center gap-4">
        {peerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peerAvatarUrl}
            alt={peerName}
            className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20"
          />
        ) : (
          <Avatar name={peerName} size="xl" />
        )}
        <p className="text-2xl font-bold">{peerName}</p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 pb-8">
        <button
          type="button"
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            muted ? "bg-white text-slate-900" : "bg-white/10 text-white hover:bg-white/20"
          }`}
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff size={22} /> : <Mic size={22} />}
        </button>

        <button
          type="button"
          onClick={onHangUp}
          className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30"
          aria-label="End call"
        >
          <PhoneOff size={26} />
        </button>

        {/* Speaker toggle is a Sprint 2 polish — disabled but present
            so the layout stays stable. */}
        <button
          type="button"
          disabled
          className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center text-white/30"
          aria-label="Speaker (coming in Sprint 2)"
        >
          <Volume2 size={22} />
        </button>
      </div>
    </div>
  );
}

// ---- Loading + fatal-error shells -----------------------------------------

function CallShellLoading({
  peerName,
  peerAvatarUrl,
  callType,
}: {
  peerName: string;
  peerAvatarUrl?: string | null;
  callType: "voice" | "video";
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        {peerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peerAvatarUrl} alt={peerName} className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20" />
        ) : (
          <Avatar name={peerName} size="xl" />
        )}
        <p className="text-2xl font-bold">{peerName}</p>
        <p className="text-xs text-white/50 mt-1">
          {callType === "video" ? "Starting video call…" : "Starting voice call…"}
        </p>
        <span className="mt-4 w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );
}

function CallShellFatal({
  peerName,
  peerAvatarUrl,
  message,
  onClose,
}: {
  peerName: string;
  peerAvatarUrl?: string | null;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 flex flex-col items-center justify-center text-white px-8">
      <div className="flex flex-col items-center gap-4 text-center">
        {peerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peerAvatarUrl} alt={peerName} className="w-24 h-24 rounded-full object-cover ring-4 ring-white/20" />
        ) : (
          <Avatar name={peerName} size="xl" />
        )}
        <p className="text-xl font-bold">{peerName}</p>
        <p className="text-sm text-white/70 max-w-xs">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 px-6 py-2 rounded-full bg-white text-slate-900 font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}
