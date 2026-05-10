"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { LIMITS } from "@/lib/ruleOf7";

// Voice clip recorder (S-131). Hold-to-record, release-to-send. 70s hard
// cap (Rule of 7). Renders a live waveform from the analyser node so the
// UI feels alive.

const MAX_SECONDS = LIMITS.BASIC.maxVoiceSeconds; // 70

export interface VoiceRecorderProps {
  onClip: (blob: Blob, durationSeconds: number) => void | Promise<void>;
  onCancel?: () => void;
}

export default function VoiceRecorder({ onClip }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 28 }, () => 0));
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => undefined);
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const dur = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        await onClip(blob, Math.min(dur, MAX_SECONDS));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start(100);
      mediaRef.current = mr;
      startedAtRef.current = Date.now();
      setRecording(true);
      setSeconds(0);

      // Waveform meter
      const ac = new AudioContext();
      const source = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioCtxRef.current = ac;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next = Array.from(data).slice(0, 28).map((v) => v / 255);
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      setError((e as Error).message ?? "Microphone unavailable");
    }
  }

  function stop() {
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => undefined);
    setRecording(false);
  }

  // Tick the seconds counter and auto-stop at the 70s cap.
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      setSeconds(Math.floor(elapsed));
      if (elapsed >= MAX_SECONDS) stop();
    }, 250);
    return () => clearInterval(t);
  }, [recording]);

  const remaining = Math.max(0, MAX_SECONDS - seconds);
  const ringDeg = (seconds / MAX_SECONDS) * 360;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onMouseDown={start}
        onMouseUp={stop}
        onTouchStart={start}
        onTouchEnd={stop}
        className="relative w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md"
        aria-label={recording ? "Stop recording" : "Hold to record"}
      >
        {recording ? <Square size={16} /> : <Mic size={18} />}
        {recording && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(rgba(255,255,255,0.7) ${ringDeg}deg, transparent 0)`,
              mask: "radial-gradient(circle, transparent 60%, black 62%)",
              WebkitMask: "radial-gradient(circle, transparent 60%, black 62%)",
            }}
          />
        )}
      </button>

      {/* Waveform */}
      <div className="flex items-center gap-0.5 h-8 flex-1">
        {levels.map((v, i) => (
          <span
            key={i}
            className="w-0.5 rounded-full bg-purple-400/60 transition-all"
            style={{ height: `${Math.max(2, v * 28)}px` }}
          />
        ))}
      </div>

      <span className={`text-xs font-mono tabular-nums ${remaining <= 10 ? "text-rose-600" : "text-slate-500"}`}>
        {String(seconds).padStart(2, "0")}s · {remaining}s left
      </span>

      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
