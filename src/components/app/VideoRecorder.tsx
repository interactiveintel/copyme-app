"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Square } from "lucide-react";
import { LIMITS } from "@/lib/ruleOf7";

// Video clip recorder (S-132). 720p, 70s cap. Front/back camera toggle.

const MAX_SECONDS = LIMITS.BASIC.maxVideoSeconds;

export interface VideoRecorderProps {
  onClip: (blob: Blob, durationSeconds: number, posterDataUrl: string | null) => void | Promise<void>;
}

type Facing = "user" | "environment";

export default function VideoRecorder({ onClip }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [facing, setFacing] = useState<Facing>("user");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void openCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing]);

  async function openCamera(f: Facing) {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: f, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      setError((e as Error).message ?? "Camera unavailable");
    }
  }

  function start() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mr = new MediaRecorder(stream, { mimeType: pickMime() });
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mr.onstop = async () => {
      const dur = (Date.now() - startedAtRef.current) / 1000;
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "video/webm" });
      const poster = await capturePoster();
      await onClip(blob, Math.min(dur, MAX_SECONDS), poster);
    };
    mr.start(250);
    mediaRef.current = mr;
    startedAtRef.current = Date.now();
    setSeconds(0);
    setRecording(true);
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    setRecording(false);
  }

  function pickMime() {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    for (const c of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) return c;
    }
    return "";
  }

  async function capturePoster(): Promise<string | null> {
    const v = videoRef.current;
    if (!v) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  }

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setSeconds(Math.floor(elapsed));
      if (elapsed >= MAX_SECONDS) stop();
    }, 250);
    return () => clearInterval(t);
  }, [recording]);

  return (
    <div className="space-y-2">
      <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {recording && (
          <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 text-white text-xs px-2 py-0.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> REC {seconds}s
          </div>
        )}
        <div className="absolute top-2 right-2 text-white text-xs bg-black/60 rounded-full px-2 py-0.5 tabular-nums">
          {MAX_SECONDS - seconds}s left
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Flip camera"
          className="inline-flex items-center gap-1 text-xs text-slate-600 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200"
        >
          <RotateCcw size={12} /> Flip
        </button>
        <button
          type="button"
          onClick={recording ? stop : start}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-lg"
          aria-label={recording ? "Stop" : "Record"}
        >
          {recording ? <Square size={18} /> : <Camera size={20} />}
        </button>
        <span className="text-xs text-slate-400">{recording ? "Tap to stop" : "Tap to record"}</span>
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
