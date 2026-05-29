"use client";

// CallSheet — full-screen in-call UI for the caller AND callee once
// the call is accepted. Wraps LiveKit's React components for the room
// connection + audio rendering.
//
// Voice-only in v4.15.0 (Sprint 1). v4.15.3 (Sprint 2) adds:
//   - Connection-quality indicator (4-bar)
//   - Speaker output toggle via setSinkId (feature-detected; falls
//     back gracefully on Safari/mobile where it's not supported)
//   - Permission-denied error state with browser-specific copy
//   - Remote participant name override (LiveKit identity > prop)
// Sprint 3 adds video tiles.
//
// Lifecycle:
//   mount:
//     1. POST /api/calls/token { callId } → { token, url }
//     2. <LiveKitRoom> connects to LiveKit Cloud
//     3. Local audio track auto-published; remote audio auto-played
//   unmount or End:
//     PATCH /api/calls/[id] { action: "end" } → status flips to ended

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic, MicOff, PhoneOff, Volume2, VolumeX, MicOff as MicDenied,
  Video, VideoOff, RotateCcw,
} from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useLocalParticipant,
  useConnectionState,
  useConnectionQualityIndicator,
  useRemoteParticipants,
  useRoomContext,
  useTracks,
} from "@livekit/components-react";
import { ConnectionQuality, ConnectionState, MediaDeviceFailure, Track } from "livekit-client";
import type { MediaDeviceFailure as MediaDeviceFailureType } from "livekit-client";
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
  // v4.15.3: track device-failure shape so we can render a tailored
  // error state (mic denied vs no mic at all vs unknown).
  const [deviceFailure, setDeviceFailure] = useState<MediaDeviceFailureType | null>(null);

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

  // Device-failure path takes priority — render the permission UI
  // even if the rest of the room connection succeeds, because no audio
  // means there's no call.
  if (deviceFailure) {
    return (
      <CallShellPermissionDenied
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        failure={deviceFailure}
        onClose={onClose}
      />
    );
  }

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
        // v4.15.4 (Sprint 3): video publish is driven by callType.
        // Voice calls keep video={false} so we don't ask for camera
        // permission unnecessarily. Video calls auto-publish camera
        // with the default front-facing constraint; user can flip
        // via the camera-switch button in CallControls.
        video={callType === "video"}
        // Catch mic OR camera permission failures so we can render a
        // friendly state instead of failing silently. The `kind`
        // narrows to "audioinput" or "videoinput".
        onMediaDeviceFailure={(failure) => {
          if (failure) setDeviceFailure(failure);
        }}
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
  // v4.15.4: track camera-enabled state separately from muted so the
  // user can be audio-only in a video call (bandwidth fallback or
  // privacy). Camera defaults on for video calls; we never auto-enable
  // it on voice calls.
  const [cameraOn, setCameraOn] = useState(callType === "video");
  // v4.15.4: swap which video tile is full-screen vs PiP on tap.
  // Default: remote is full-screen, self is PiP (the standard video-
  // call convention).
  const [swapped, setSwapped] = useState(false);

  // v4.15.10 (bug fix): useConnectionQualityIndicator() without an
  // explicit `participant` requires a <ParticipantContext.Provider>
  // wrapper — which only exists inside <ParticipantTile>. We render
  // a custom layout (no ParticipantTile), so the bare call threw
  // "No participant provided" and crashed the entire app tree on
  // tap-to-call. Pass localParticipant explicitly. Caught by
  // gstack-browse acceptance test 2026-05-29.
  const { quality } = useConnectionQualityIndicator({ participant: localParticipant });
  const remoteParticipants = useRemoteParticipants();
  const effectivePeerName = useMemo(() => {
    const remote = remoteParticipants[0];
    return remote?.name?.trim() || peerName;
  }, [remoteParticipants, peerName]);

  // v4.15.4: track refs for video rendering. useTracks subscribes to
  // camera-source video tracks from every participant in the room.
  const videoTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const localVideoTrack = videoTracks.find(
    (t) => t.participant.identity === localParticipant.identity,
  );
  const remoteVideoTrack = videoTracks.find(
    (t) => t.participant.identity !== localParticipant.identity,
  );

  const statusLabel =
    connectionState === ConnectionState.Connecting ? "Connecting…" :
    connectionState === ConnectionState.Connected ? "Connected" :
    connectionState === ConnectionState.Reconnecting ? "Reconnecting…" :
    connectionState === ConnectionState.Disconnected ? "Disconnected" :
    "…";

  const toggleMute = async () => {
    const next = !muted;
    setMuted(next);
    await localParticipant.setMicrophoneEnabled(!next);
  };

  const toggleCamera = async () => {
    const next = !cameraOn;
    setCameraOn(next);
    await localParticipant.setCameraEnabled(next);
  };

  // ---- Video layout (callType === "video") --------------------------------
  if (callType === "video") {
    // Decide which track is full-screen vs PiP based on swap state.
    const fullTrack = swapped ? localVideoTrack : remoteVideoTrack;
    const pipTrack  = swapped ? remoteVideoTrack : localVideoTrack;
    const fullIsLocal = swapped;
    const pipIsLocal  = !swapped;

    return (
      <div className="flex-1 relative text-white overflow-hidden">
        {/* Full-screen tile: remote video, or fallback avatar if remote
            hasn't published video yet (still connecting or camera off). */}
        {fullTrack ? (
          <VideoTrack
            trackRef={fullTrack}
            // Mirror only the local tile (selfie convention) — never the
            // remote, where mirroring would look wrong to the viewer.
            className={`absolute inset-0 w-full h-full object-cover ${
              fullIsLocal ? "scale-x-[-1]" : ""
            }`}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
            <div className="flex flex-col items-center gap-3">
              {peerAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={peerAvatarUrl} alt={effectivePeerName} className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20" />
              ) : (
                <Avatar name={effectivePeerName} size="xl" />
              )}
              <p className="text-2xl font-bold">{effectivePeerName}</p>
              <p className="text-xs text-white/50">
                {remoteVideoTrack ? "Camera off" : "Connecting video…"}
              </p>
            </div>
          </div>
        )}

        {/* Top overlay: quality + status + name */}
        <div className="absolute top-0 inset-x-0 p-6 pt-12 bg-gradient-to-b from-black/50 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QualityBars quality={quality} />
              <p className="text-xs text-white/70">{statusLabel}</p>
            </div>
            <p className="text-sm font-semibold drop-shadow">{effectivePeerName}</p>
          </div>
        </div>

        {/* PiP self-view — tap to swap which tile is full-screen. */}
        {pipTrack && (
          <button
            type="button"
            onClick={() => setSwapped((s) => !s)}
            className="absolute top-24 right-4 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden ring-2 ring-white/30 shadow-xl bg-slate-800"
            aria-label="Swap video tiles"
          >
            <VideoTrack
              trackRef={pipTrack}
              className={`w-full h-full object-cover ${pipIsLocal ? "scale-x-[-1]" : ""}`}
            />
          </button>
        )}

        {/* Bottom controls — semi-transparent overlay so tiles stay visible. */}
        <div className="absolute bottom-0 inset-x-0 px-8 pb-8 pt-12 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={toggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                muted ? "bg-white text-slate-900" : "bg-white/15 backdrop-blur text-white hover:bg-white/25"
              }`}
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? <MicOff size={22} /> : <Mic size={22} />}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
                !cameraOn ? "bg-white text-slate-900" : "bg-white/15 backdrop-blur text-white hover:bg-white/25"
              }`}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
            >
              {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>

            <button
              type="button"
              onClick={onHangUp}
              className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30"
              aria-label="End call"
            >
              <PhoneOff size={26} />
            </button>

            <CameraSwitch />
            <SpeakerToggle />
          </div>
        </div>
      </div>
    );
  }

  // ---- Voice layout (callType === "voice") --------------------------------
  return (
    <div className="flex-1 flex flex-col items-center justify-between p-8 text-white">
      {/* Header: peer name + status + quality bars */}
      <div className="text-center pt-12 flex flex-col items-center gap-2">
        <p className="text-[11px] uppercase tracking-widest text-white/60">Voice call</p>
        <div className="flex items-center gap-2">
          <QualityBars quality={quality} />
          <p className="text-xs text-white/50">{statusLabel}</p>
        </div>
      </div>

      {/* Peer avatar */}
      <div className="flex flex-col items-center gap-4">
        {peerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={peerAvatarUrl}
            alt={effectivePeerName}
            className="w-32 h-32 rounded-full object-cover ring-4 ring-white/20"
          />
        ) : (
          <Avatar name={effectivePeerName} size="xl" />
        )}
        <p className="text-2xl font-bold">{effectivePeerName}</p>
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

        <SpeakerToggle />
      </div>
    </div>
  );
}

// ---- Camera switch (v4.15.4) ----------------------------------------------
//
// Cycles between available video input devices. On mobile this flips
// between user-facing and environment-facing cameras; on desktop it
// rotates through plugged-in webcams. Hidden when fewer than 2 cameras
// exist so users don't see a useless button.

function CameraSwitch() {
  // switchActiveDevice lives on Room, not LocalParticipant — we use
  // the room context here. (Verified against
  // node_modules/livekit-client/dist/src/room/Room.d.ts.)
  const room = useRoomContext();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setCameras(all.filter((d) => d.kind === "videoinput")))
      .catch(() => undefined);
  }, []);

  if (cameras.length < 2) return null;

  const cycle = async () => {
    const next = (active + 1) % cameras.length;
    setActive(next);
    try {
      // LiveKit re-publishes the camera track on the new device
      // transparently. exact=false so the browser can fall back if
      // the deviceId no longer matches a real device.
      await room.switchActiveDevice("videoinput", cameras[next].deviceId, false);
    } catch {
      // Some browsers reject the switch mid-call (e.g. permission
      // scope changed). Best-effort.
    }
  };

  return (
    <button
      type="button"
      onClick={cycle}
      className="w-14 h-14 rounded-full bg-white/15 backdrop-blur text-white flex items-center justify-center hover:bg-white/25 transition-colors"
      aria-label="Switch camera"
      title={`Switch camera (now: ${cameras[active]?.label || "default"})`}
    >
      <RotateCcw size={22} />
    </button>
  );
}

// ---- Speaker toggle (v4.15.3) ---------------------------------------------
//
// Cycles the audio output between "default" and the next available
// device. Uses HTMLAudioElement.setSinkId() which is supported on
// Chromium-based browsers (desktop + Android Chrome). Safari (incl.
// iOS) doesn't implement setSinkId — there we feature-detect and
// disable the button with a tooltip.
//
// Note: this controls which OUTPUT device receives the audio. On mobile
// the OS routes between earpiece and loudspeaker; the web API can't
// influence that directly. For desktop with headphones plugged in this
// lets the user switch between speakers and headphones in-call.

function SpeakerToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [active, setActive] = useState(0); // index into outputs

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Feature-detect setSinkId on HTMLAudioElement.
    const proto = HTMLAudioElement.prototype as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    if (typeof proto.setSinkId !== "function" || !navigator.mediaDevices?.enumerateDevices) {
      setSupported(false);
      return;
    }
    setSupported(true);
    navigator.mediaDevices
      .enumerateDevices()
      .then((all) => setOutputs(all.filter((d) => d.kind === "audiooutput")))
      .catch(() => setSupported(false));
  }, []);

  const cycle = async () => {
    if (!supported || outputs.length < 2) return;
    const next = (active + 1) % outputs.length;
    setActive(next);
    const deviceId = outputs[next].deviceId;
    // Apply to all <audio> elements LiveKit's RoomAudioRenderer mounts.
    const audios = document.querySelectorAll("audio");
    for (const a of Array.from(audios)) {
      const el = a as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      try {
        await el.setSinkId?.(deviceId);
      } catch {
        /* one element failing shouldn't break the others */
      }
    }
  };

  const disabled = supported === false || outputs.length < 2;
  const label = supported === false
    ? "Speaker switch not supported in this browser"
    : outputs.length < 2
      ? "Only one audio output available"
      : `Switch output (currently ${outputs[active]?.label || "default"})`;

  return (
    <button
      type="button"
      onClick={cycle}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
        disabled
          ? "bg-white/5 text-white/30"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {disabled ? <VolumeX size={22} /> : <Volume2 size={22} />}
    </button>
  );
}

// ---- Quality bars indicator (v4.15.3) -------------------------------------
//
// 4 stacked bars; light up 1-4 based on ConnectionQuality. Color shifts
// from rose (Lost) → amber (Poor) → emerald (Good/Excellent).

function QualityBars({ quality }: { quality: ConnectionQuality }) {
  const filled =
    quality === ConnectionQuality.Excellent ? 4 :
    quality === ConnectionQuality.Good ? 3 :
    quality === ConnectionQuality.Poor ? 2 :
    quality === ConnectionQuality.Lost ? 1 :
    0;
  const colorClass =
    filled >= 3 ? "bg-emerald-400" :
    filled === 2 ? "bg-amber-400" :
    filled === 1 ? "bg-rose-400" :
    "bg-white/20";

  // LiveKit's ConnectionQuality is a string enum ("excellent"|"good"|
  // "poor"|"lost"|"unknown") so `quality` is already human-readable
  // lowercase — title-case it for the tooltip.
  const qualityLabel = quality
    ? quality[0].toUpperCase() + quality.slice(1)
    : "Unknown";

  return (
    <div
      className="flex items-end gap-[2px] h-3"
      title={`Connection: ${qualityLabel}`}
      aria-label={`Connection quality: ${qualityLabel.toLowerCase()}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`w-[3px] rounded-sm ${i < filled ? colorClass : "bg-white/15"}`}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      ))}
    </div>
  );
}

// ---- Loading + fatal-error + permission-denied shells ---------------------

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

// v4.15.3: dedicated permission-denied state with browser-specific
// instructions. Detects the major engines via user-agent (cheap; only
// used for help-copy steering, no security implications).

function CallShellPermissionDenied({
  peerName,
  peerAvatarUrl,
  failure,
  onClose,
}: {
  peerName: string;
  peerAvatarUrl?: string | null;
  failure: MediaDeviceFailureType;
  onClose: () => void;
}) {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isAndroid = /Android/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  const headline =
    failure === MediaDeviceFailure.PermissionDenied
      ? "Microphone permission needed"
      : failure === MediaDeviceFailure.NotFound
        ? "No microphone found"
        : failure === MediaDeviceFailure.DeviceInUse
          ? "Microphone is in use by another app"
          : "Microphone error";

  const instructions = (() => {
    if (failure !== MediaDeviceFailure.PermissionDenied) {
      return failure === MediaDeviceFailure.NotFound
        ? "Plug in a microphone or enable one in your system audio settings, then tap Retry."
        : "Close any other app using the microphone (Zoom, Meet, etc.), then tap Retry.";
    }
    if (isIos && isSafari) {
      return "Open Settings → Safari → Microphone → set to Ask. Then return to this tab and tap Retry.";
    }
    if (isAndroid) {
      return "Tap the lock icon in the address bar → Permissions → Microphone → Allow. Then tap Retry.";
    }
    if (isSafari) {
      return "Safari → Settings for copyme1.com → Microphone → Allow. Then tap Retry.";
    }
    // Chrome / Edge / Firefox / etc.
    return "Click the lock icon left of the URL → Site settings → Microphone → Allow. Then tap Retry.";
  })();

  return (
    <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 flex flex-col items-center justify-center text-white px-8">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        {peerAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={peerAvatarUrl} alt={peerName} className="w-24 h-24 rounded-full object-cover ring-4 ring-white/20 opacity-60" />
        ) : (
          <div className="opacity-60"><Avatar name={peerName} size="xl" /></div>
        )}
        <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
          <MicDenied size={22} className="text-amber-400" />
        </div>
        <p className="text-lg font-bold">{headline}</p>
        <p className="text-sm text-white/70 leading-relaxed">{instructions}</p>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-full bg-white text-slate-900 font-semibold"
          >
            Retry
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-white/10 text-white font-semibold hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
