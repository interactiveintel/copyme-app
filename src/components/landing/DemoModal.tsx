"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  ArrowRight,
  Users,
  Zap,
  Heart,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  Mic,
  ChevronDown,
} from "lucide-react";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Scene data — each scene is a "chapter" in the video walkthrough
// ---------------------------------------------------------------------------

const SCENE_DURATION = 7000; // 7 seconds per scene

interface ChatMsg {
  sent: boolean;
  text: string;
  delay: number; // ms delay before appearing
}

const scenes = [
  {
    id: 1,
    chapter: "01",
    title: "The Problem",
    narration: [
      "You open your phone.",
      "127 unread messages. Group chats. Spam. Noise.",
      "When did communication become so exhausting?",
    ],
    icon: MessageSquare,
    color: "from-slate-600 to-slate-800",
    phone: {
      type: "chaos" as const,
      notifications: [
        { app: "GroupChat", count: 47, color: "bg-red-500" },
        { app: "Work Msgs", count: 31, color: "bg-blue-500" },
        { app: "Social", count: 28, color: "bg-purple-500" },
        { app: "Promos", count: 21, color: "bg-orange-500" },
      ],
    },
  },
  {
    id: 2,
    chapter: "02",
    title: "Enter CopyMe",
    narration: [
      "CopyMe flips the script.",
      "Built on the Rule of 7 — a constraint system that replaces noise with meaning.",
      "Seven messages. Seventy words. Infinite impact.",
    ],
    icon: Sparkles,
    color: "from-indigo-500 to-purple-600",
    phone: {
      type: "intro" as const,
      tagline: "Rule of 7",
      features: ["7 messages per cycle", "70 words per message", "7 active contacts"],
    },
  },
  {
    id: 3,
    chapter: "03",
    title: "Messaging That Matters",
    narration: [
      "Every message counts — literally.",
      "The word limit forces you to think before you type.",
      "The result? Conversations that are intentional, creative, and real.",
    ],
    icon: MessageSquare,
    color: "from-indigo-500 to-purple-600",
    phone: {
      type: "chat" as const,
      header: "Sarah Chen",
      messages: [
        { sent: false, text: "Hey! I saw your photography portfolio — stunning work.", delay: 500 },
        { sent: true, text: "Thanks! The constraints here pushed me to describe my art more thoughtfully.", delay: 1800 },
        { sent: false, text: "Exactly. Quality over quantity changes everything.", delay: 3200 },
      ] as ChatMsg[],
      counter: "4/7 messages remaining",
    },
  },
  {
    id: 4,
    chapter: "04",
    title: "Value Connections",
    narration: [
      "Tap any contact to see what connects you.",
      "Shared interests, value match scores, and mutual passions — all at a glance.",
      "CopyMe doesn't just link people. It reveals why they belong together.",
    ],
    icon: Heart,
    color: "from-pink-500 to-rose-500",
    phone: {
      type: "profile" as const,
      header: "Sarah Chen",
      profile: {
        name: "Sarah Chen",
        bio: "UX researcher & street photographer",
        location: "San Francisco",
        matchScore: 92,
        sharedInterests: ["photography", "hiking", "coffee culture"],
        theirInterests: ["UX research", "urban sketching", "documentary films", "mindfulness"],
        messagesLeft: 4,
      },
    },
  },
  {
    id: 5,
    chapter: "05",
    title: "Meet Yogi",
    narration: [
      "Meet Yogi — your personal AI that learns YOU.",
      "Upload your photo and Yogi becomes your animated avatar companion.",
      "Talk, video chat, or text. Yogi adapts to your personality over time.",
    ],
    icon: Sparkles,
    color: "from-violet-500 to-purple-600",
    phone: {
      type: "yogi" as const,
      avatarUrl: "/avatars/paul-1.jpg",
      name: "Paul",
      traits: ["Friendly", "Creative", "Direct"],
      stats: { chats: 47, learned: 12, adapted: 8 },
    },
  },
  {
    id: 6,
    chapter: "06",
    title: "AI Smart Match",
    narration: [
      "Finding the right people shouldn't be random.",
      "Our AI analyzes interests, style, and values to surface real connections.",
      "Not followers. Not contacts. Connections.",
    ],
    icon: Search,
    color: "from-purple-500 to-pink-500",
    phone: {
      type: "match" as const,
      header: "Smart Match",
      matches: [
        { name: "Alex Rivera", match: 94, tag: "Tech & Design", delay: 600 },
        { name: "Mia Zhang", match: 91, tag: "Music & Travel", delay: 1200 },
        { name: "Jordan Blake", match: 88, tag: "Fitness & AI", delay: 1800 },
      ],
    },
  },
  {
    id: 7,
    chapter: "07",
    title: "Your AI Copilot",
    narration: [
      "Stuck on what to say? The AI assistant has your back.",
      "It suggests replies, condenses long thoughts to 70 words, and even translates.",
      "Like having a communication coach in your pocket.",
    ],
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    phone: {
      type: "assist" as const,
      header: "Chat with Alex",
      messages: [
        { sent: false, text: "I'd love to collaborate on that design project!", delay: 400 },
        { sent: true, text: "That sounds great! When should we start?", delay: 1500 },
      ] as ChatMsg[],
      suggestions: [
        { text: "How about Tuesday at 3pm?", tone: "Direct", delay: 2800 },
        { text: "I'm free this week — pick a time!", tone: "Casual", delay: 3200 },
        { text: "Let's sync calendars tomorrow.", tone: "Professional", delay: 3600 },
      ],
    },
  },
  {
    id: 8,
    chapter: "08",
    title: "Your Inner Circle",
    narration: [
      "Seven active contacts. That's it.",
      "Every person in your circle gets your real attention.",
      "When a slot opens up, you choose who fills it. Intentional relationships.",
    ],
    icon: Users,
    color: "from-emerald-500 to-teal-500",
    phone: {
      type: "contacts" as const,
      header: "Inner Circle",
      contacts: [
        { name: "Sarah Chen", active: true, unread: 2, delay: 300 },
        { name: "Alex Rivera", active: true, unread: 0, delay: 500 },
        { name: "Mia Zhang", active: true, unread: 5, delay: 700 },
        { name: "Jordan Blake", active: true, unread: 1, delay: 900 },
        { name: "Priya Sharma", active: true, unread: 0, delay: 1100 },
        { name: "Open Slot", active: false, unread: 0, delay: 1400 },
        { name: "Open Slot", active: false, unread: 0, delay: 1600 },
      ],
    },
  },
  {
    id: 9,
    chapter: "09",
    title: "Private by Design",
    narration: [
      "Your conversations are yours. Period.",
      "End-to-end encryption, AI moderation, and zero data selling.",
      "We built the privacy you deserve into every layer.",
    ],
    icon: Shield,
    color: "from-cyan-500 to-blue-500",
    phone: {
      type: "security" as const,
      header: "Security",
      checks: [
        { label: "End-to-End Encryption", delay: 500 },
        { label: "AI Content Moderation", delay: 1000 },
        { label: "Zero Data Selling", delay: 1500 },
        { label: "Auto-Expiring Messages", delay: 2000 },
        { label: "On-Device Processing", delay: 2500 },
      ],
    },
  },
  {
    id: 10,
    chapter: "",
    title: "Ready to try it?",
    narration: [
      "Less noise. More meaning.",
      "CopyMe — communication that copies your world.",
    ],
    icon: Sparkles,
    color: "from-indigo-500 via-purple-500 to-pink-500",
    phone: { type: "cta" as const },
  },
];

// ---------------------------------------------------------------------------
// Typewriter narration hook
// ---------------------------------------------------------------------------

function useTypewriter(lines: string[], active: boolean, speed = 30) {
  const [displayed, setDisplayed] = useState<string[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!active) {
      setDisplayed([]);
      return;
    }

    let lineIdx = 0;
    let charIdx = 0;
    const result: string[] = [];

    function tick() {
      if (lineIdx >= lines.length) return;

      const currentLine = lines[lineIdx];
      charIdx++;
      result[lineIdx] = currentLine.slice(0, charIdx);
      setDisplayed([...result]);

      if (charIdx >= currentLine.length) {
        lineIdx++;
        charIdx = 0;
        // Pause between lines
        timeoutRef.current = setTimeout(tick, 400);
      } else {
        timeoutRef.current = setTimeout(tick, speed);
      }
    }

    // Small initial delay
    timeoutRef.current = setTimeout(tick, 300);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [lines, active, speed]);

  return displayed;
}

// ---------------------------------------------------------------------------
// Voice narration hook — uses Web Speech API (SpeechSynthesis)
// ---------------------------------------------------------------------------

// Curated voice presets — default is a profound British English male voice
// (BBC narrator feel). Keyword order matters: each list runs top-to-bottom
// against the platform's installed voices, first hit wins.
const VOICE_PRESETS = [
  // Daniel = iOS/macOS BBC-style English male. Oliver/Arthur = newer Apple
  // "Premium" British males. Microsoft George/Ryan = Windows. Google UK
  // English Male = Android/Chrome. "british" / "english (united kingdom)"
  // are last-ditch substring matches.
  {
    id: "auto",
    label: "Profound British (Default)",
    keywords: [
      "daniel",
      "oliver",
      "arthur",
      "google uk english male",
      "microsoft george",
      "microsoft ryan",
      "british",
      "english (united kingdom)",
    ],
  },
  {
    id: "british-female",
    label: "Refined British Female",
    keywords: [
      "kate",
      "serena",
      "martha",
      "google uk english female",
      "microsoft hazel",
      "microsoft susan",
    ],
  },
  {
    id: "us-male",
    label: "Deep American Male",
    keywords: ["alex", "tom", "google us english", "microsoft david"],
  },
  {
    id: "us-female",
    label: "Warm American Female",
    keywords: ["samantha", "tessa", "moira", "microsoft zira", "google us english"],
  },
] as const;

type VoicePresetId = typeof VOICE_PRESETS[number]["id"] | "custom";

function resolveVoice(presetId: VoicePresetId, customVoiceName?: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  if (presetId === "custom" && customVoiceName) {
    return voices.find((v) => v.name === customVoiceName) ?? null;
  }

  const preset = VOICE_PRESETS.find((p) => p.id === presetId) ?? VOICE_PRESETS[0];
  const wantsBritish = presetId === "auto" || presetId === "british-female";

  for (const kw of preset.keywords) {
    // For British presets, prefer en-GB locale matches first; only fall back
    // to en-* if no en-GB voice carries the keyword. Without this an installed
    // "Microsoft David — en-US" voice would match the "david" keyword on the
    // US-male preset but would never be picked over en-GB Daniel for Auto.
    if (wantsBritish) {
      const gbMatch = voices.find(
        (v) => v.lang.toLowerCase().startsWith("en-gb") && v.name.toLowerCase().includes(kw),
      );
      if (gbMatch) return gbMatch;
    }
    const enMatch = voices.find(
      (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes(kw),
    );
    if (enMatch) return enMatch;
  }

  // Last resort: any en-GB voice for British presets, otherwise any English voice.
  if (wantsBritish) {
    const anyGb = voices.find((v) => v.lang.toLowerCase().startsWith("en-gb"));
    if (anyGb) return anyGb;
  }
  return voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function useAvailableVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
      setVoices(v);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);
  return voices;
}

// Some TTS engines (notably Apple) clip the final ~150ms of a phrase that
// has no terminal punctuation. Force a period so the synthesizer renders the
// trailing pause and the last syllable doesn't get cut off.
function ensureTerminalPunctuation(line: string): string {
  const trimmed = line.trimEnd();
  if (!trimmed) return trimmed;
  const last = trimmed[trimmed.length - 1];
  if (".!?…".includes(last)) return trimmed;
  return trimmed + ".";
}

function useVoiceNarration(
  lines: string[],
  active: boolean,
  enabled: boolean,
  voicePreset: VoicePresetId,
  customVoiceName: string | undefined,
  onComplete?: () => void,
) {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const lineIndexRef = useRef(0);
  const unlockedRef = useRef(false);
  // Latest onComplete is held in a ref so changing it doesn't tear down the
  // speech effect mid-scene.
  const onCompleteRef = useRef<(() => void) | undefined>(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  // Unlock speech synthesis immediately when hook is active (user already clicked to open modal)
  useEffect(() => {
    if (unlockedRef.current || !active || typeof window === "undefined" || !window.speechSynthesis) return;

    // Immediate unlock — user already clicked "Watch the Demo" button
    try {
      window.speechSynthesis.cancel();
      const silent = new SpeechSynthesisUtterance("");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
      unlockedRef.current = true;
    } catch { /* ignore */ }

    // Also listen for click/touch as fallback
    const unlock = () => {
      if (unlockedRef.current) return;
      try {
        const s = new SpeechSynthesisUtterance("");
        s.volume = 0;
        window.speechSynthesis.speak(s);
        unlockedRef.current = true;
      } catch { /* ignore */ }
    };

    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });

    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("touchstart", unlock);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !enabled || typeof window === "undefined" || !window.speechSynthesis) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      lineIndexRef.current = 0;
      return;
    }

    window.speechSynthesis.cancel();
    lineIndexRef.current = 0;
    const padded = lines.map(ensureTerminalPunctuation);

    function speakLine(idx: number) {
      if (idx >= padded.length) {
        // Notify parent that the full scene narration finished. Small delay
        // gives the audio engine time to flush its tail buffer before any
        // next-scene cancel() lands.
        setTimeout(() => onCompleteRef.current?.(), 250);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(padded[idx]);
      // Slower + deeper for that BBC narrator feel; lang en-GB so Chromium /
      // Android pick a British voice when no exact preset match exists.
      utterance.rate = 0.85;
      utterance.pitch = 0.9;
      utterance.lang = "en-GB";

      const voice = resolveVoice(voicePreset, customVoiceName);
      if (voice) {
        utterance.voice = voice;
        // Match utterance.lang to the picked voice's locale so the engine
        // doesn't re-resolve to a different voice mid-line.
        utterance.lang = voice.lang;
      }

      utterance.onend = () => {
        lineIndexRef.current = idx + 1;
        // ~350ms pause between lines — gives the previous sentence room to
        // fully decay before the next one starts. Fixes the "blends together
        // and clips" complaint on Apple voices.
        setTimeout(() => speakLine(idx + 1), 350);
      };

      utterance.onerror = () => {
        // Skip to next line on error
        lineIndexRef.current = idx + 1;
        setTimeout(() => speakLine(idx + 1), 350);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }

    // Chrome 15s pause keepalive
    const keepAlive = setInterval(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);

    // Small delay to ensure voices are loaded after unlock
    const startSpeaking = () => {
      setTimeout(() => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          speakLine(0);
        } else {
          const onVoicesChanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            speakLine(0);
          };
          window.speechSynthesis.onvoiceschanged = onVoicesChanged;
          // Timeout fallback — some browsers never fire onvoiceschanged
          setTimeout(() => {
            if (lineIndexRef.current === 0) speakLine(0);
          }, 1000);
        }
      }, 200);
    };

    startSpeaking();

    return () => {
      clearInterval(keepAlive);
      window.speechSynthesis.cancel();
    };
  }, [lines, active, enabled, voicePreset, customVoiceName]);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DemoModal({ open, onClose }: DemoModalProps) {
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voicePreset, setVoicePreset] = useState<VoicePresetId>("auto");
  const [customVoiceName, setCustomVoiceName] = useState<string>();
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceSample, setVoiceSample] = useState<string | null>(null);
  // narrationDone gates auto-advance: even if SCENE_DURATION elapses, we hold
  // the scene until the British narrator has actually finished speaking. Stops
  // the last sentence of long scenes from being clipped by a scene change.
  const [narrationDone, setNarrationDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const availableVoices = useAvailableVoices();

  const scene = scenes[current];
  // Progress bar caps at 100% within a scene even if we're holding for the
  // narrator — the bar shouldn't overflow visually while waiting on voice.
  const sceneProgressFraction = Math.min(1, elapsed / SCENE_DURATION);
  const progress = ((current + sceneProgressFraction) / scenes.length) * 100;

  const narrationLines = useTypewriter(scene.narration, open && true, 25);

  // TTS narration. onComplete flips narrationDone when the British narrator
  // finishes the last sentence — auto-advance reads that flag.
  useVoiceNarration(
    scene.narration,
    open,
    voiceEnabled,
    voicePreset,
    customVoiceName,
    () => setNarrationDone(true),
  );

  // Record voice sample for "My Voice" feature
  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setVoiceSample(url);
        stream.getTracks().forEach((t) => t.stop());
        setIsRecordingVoice(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecordingVoice(true);
      // Auto-stop after 5 seconds
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 5000);
    } catch {
      setIsRecordingVoice(false);
    }
  }, []);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Timer tick — drives progress bar (capped at SCENE_DURATION). Auto-advance
  // happens in a separate effect so it can also gate on narrationDone.
  useEffect(() => {
    if (!open || !playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const TICK = 50;
    // Cap at 1.5x SCENE_DURATION as a safety so a stuck voice engine never
    // freezes the demo forever — past that we move on regardless.
    const HARD_CAP = SCENE_DURATION * 1.5;
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => Math.min(HARD_CAP, prev + TICK));
    }, TICK);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, playing]);

  // Auto-advance: scene moves on once BOTH SCENE_DURATION has elapsed AND the
  // narrator has signalled it's done, OR we hit the hard cap. Voice-disabled
  // mode falls back to pure timer-based pacing.
  useEffect(() => {
    if (!open || !playing) return;
    const minElapsedReached = elapsed >= SCENE_DURATION;
    const hardCapReached = elapsed >= SCENE_DURATION * 1.5;
    const narratorReady = !voiceEnabled || narrationDone;
    if (!(minElapsedReached && narratorReady) && !hardCapReached) return;

    if (current >= scenes.length - 1) {
      setPlaying(false);
      return;
    }
    setCurrent((c) => c + 1);
  }, [open, playing, elapsed, narrationDone, voiceEnabled, current]);

  // Reset elapsed + narrationDone when scene changes — fresh sentence ahead.
  useEffect(() => {
    setElapsed(0);
    setNarrationDone(false);
  }, [current]);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setCurrent(0);
      setElapsed(0);
      setPlaying(true);
      setNarrationDone(false);
      // Cancel any ongoing speech when modal closes
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    }
  }, [open]);

  const goTo = useCallback((idx: number) => {
    setCurrent(idx);
    setElapsed(0);
    setNarrationDone(false);
    setPlaying(true);
  }, []);

  const skipBack = useCallback(() => {
    goTo(Math.max(0, current - 1));
  }, [current, goTo]);

  const skipForward = useCallback(() => {
    if (current < scenes.length - 1) goTo(current + 1);
  }, [current, goTo]);

  // Scene-local elapsed for staggering phone animations
  const sceneElapsed = elapsed;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 30 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
          >
            {/* ---- Video progress bar ---- */}
            <div className="h-1 bg-white/10 relative">
              <motion.div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.05 }}
              />
              {/* Scene markers */}
              <div className="absolute inset-0 flex">
                {scenes.map((_, i) => (
                  <button
                    key={i}
                    className="flex-1 relative group"
                    onClick={() => goTo(i)}
                  >
                    <div className="absolute right-0 top-0 w-px h-full bg-white/10" />
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/5 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* ---- Close button ---- */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X size={14} className="text-white/70" />
            </button>

            {/* ---- Main content ---- */}
            <div className="grid md:grid-cols-5 min-h-[520px]">
              {/* Left — Narration panel (3 cols) */}
              <div className="md:col-span-3 p-8 md:p-10 flex flex-col justify-between">
                <div>
                  {/* Chapter indicator */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={scene.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.35 }}
                    >
                      {scene.chapter && (
                        <div className="flex items-center gap-3 mb-6">
                          <span className="text-[11px] font-mono font-bold tracking-widest text-purple-400 uppercase">
                            Chapter {scene.chapter}
                          </span>
                          <div className="h-px flex-1 bg-gradient-to-r from-purple-500/40 to-transparent" />
                        </div>
                      )}

                      {/* Title */}
                      <div className="flex items-center gap-3 mb-6">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${scene.color} flex items-center justify-center`}>
                          <scene.icon size={20} className="text-white" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                          {scene.title}
                        </h3>
                      </div>

                      {/* Narration text — typewriter */}
                      <div className="space-y-3 min-h-[120px]">
                        {narrationLines.map((line, i) => (
                          <motion.p
                            key={`${scene.id}-${i}`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`text-base sm:text-lg leading-relaxed ${
                              i === 0 ? "text-white/90" : "text-white/60"
                            }`}
                          >
                            {line}
                            {i === narrationLines.length - 1 && (
                              <span className="inline-block w-0.5 h-5 bg-purple-400 ml-0.5 animate-pulse align-middle" />
                            )}
                          </motion.p>
                        ))}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* ---- Video controls ---- */}
                <div className="mt-8 flex items-center gap-4">
                  {/* Transport controls */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={skipBack}
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <SkipBack size={14} className="text-white/70" />
                    </button>
                    <button
                      onClick={() => setPlaying(!playing)}
                      className="w-11 h-11 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
                    >
                      {playing ? (
                        <Pause size={16} className="text-white" />
                      ) : (
                        <Play size={16} className="text-white ml-0.5" />
                      )}
                    </button>
                    <button
                      onClick={skipForward}
                      className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    >
                      <SkipForward size={14} className="text-white/70" />
                    </button>
                  </div>

                  {/* Scene dots */}
                  <div className="flex gap-1.5 ml-2">
                    {scenes.map((s, i) => (
                      <button
                        key={s.id}
                        onClick={() => goTo(i)}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          i === current
                            ? "w-6 bg-gradient-to-r from-indigo-400 to-purple-400"
                            : i < current
                              ? "w-1.5 bg-purple-400/60"
                              : "w-1.5 bg-white/20"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Voice controls */}
                  <div className="relative ml-2 flex items-center gap-1.5">
                    {/* Mute / unmute */}
                    <button
                      onClick={() => setVoiceEnabled((v) => !v)}
                      className="w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors border border-white/20"
                      title={voiceEnabled ? "Mute narration" : "Unmute narration"}
                    >
                      {voiceEnabled ? (
                        <Volume2 size={16} className="text-white" />
                      ) : (
                        <VolumeX size={16} className="text-white/50" />
                      )}
                    </button>

                    {/* Voice picker toggle */}
                    <button
                      onClick={() => setShowVoicePicker((v) => !v)}
                      className="h-10 px-3 rounded-full bg-white/15 hover:bg-white/25 flex items-center gap-1.5 transition-colors border border-white/20 text-xs text-white/80"
                      title="Change voice"
                    >
                      <Mic size={13} />
                      <span className="hidden sm:inline">Voice</span>
                      <ChevronDown size={12} className={`transition-transform ${showVoicePicker ? "rotate-180" : ""}`} />
                    </button>

                    {/* Voice picker dropdown */}
                    <AnimatePresence>
                      {showVoicePicker && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-14 right-0 w-72 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-3 z-50"
                        >
                          <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2 px-1">Voice Style</p>

                          {/* Preset voices */}
                          <div className="space-y-1 mb-3">
                            {VOICE_PRESETS.map((preset) => (
                              <button
                                key={preset.id}
                                onClick={() => { setVoicePreset(preset.id); setVoiceEnabled(true); }}
                                className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center justify-between ${
                                  voicePreset === preset.id && voicePreset !== "custom"
                                    ? "bg-purple-500/30 text-white border border-purple-400/30"
                                    : "text-white/70 hover:bg-white/10"
                                }`}
                              >
                                <span>{preset.label}</span>
                                {voicePreset === preset.id && voicePreset !== "custom" && (
                                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                                )}
                              </button>
                            ))}
                          </div>

                          {/* System voices */}
                          {availableVoices.length > 0 && (
                            <>
                              <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2 px-1">System Voices</p>
                              <div className="max-h-32 overflow-y-auto space-y-0.5 mb-3 scrollbar-thin">
                                {availableVoices.map((v) => (
                                  <button
                                    key={v.name}
                                    onClick={() => { setVoicePreset("custom"); setCustomVoiceName(v.name); setVoiceEnabled(true); }}
                                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-all truncate ${
                                      voicePreset === "custom" && customVoiceName === v.name
                                        ? "bg-purple-500/30 text-white"
                                        : "text-white/50 hover:bg-white/10 hover:text-white/80"
                                    }`}
                                  >
                                    {v.name}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {/* Record my voice */}
                          <div className="border-t border-white/10 pt-3">
                            <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold mb-2 px-1">Clone My Voice</p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                  isRecordingVoice
                                    ? "bg-red-500/30 text-red-300 border border-red-400/30 animate-pulse"
                                    : "bg-white/10 text-white/80 hover:bg-white/15 border border-white/10"
                                }`}
                              >
                                <Mic size={14} />
                                {isRecordingVoice ? "Recording... Tap to stop" : "Record Voice Sample"}
                              </button>
                            </div>
                            {voiceSample && (
                              <div className="mt-2 flex items-center gap-2">
                                <audio src={voiceSample} controls className="h-8 flex-1 opacity-70" />
                                <span className="text-[10px] text-white/40">Sample saved</span>
                              </div>
                            )}
                            <p className="text-[10px] text-white/30 mt-2 px-1 leading-relaxed">
                              Voice cloning uses your sample to personalize AI responses. Full cloning available in the app.
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Time display */}
                  <span className="ml-auto text-[11px] font-mono text-white/40">
                    {current + 1}/{scenes.length}
                  </span>
                </div>

                {/* CTA on last slide */}
                {scene.phone.type === "cta" && (
                  <motion.a
                    href="/app"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="mt-6 inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow w-fit"
                  >
                    Try CopyMe Now
                    <ArrowRight size={14} />
                  </motion.a>
                )}
              </div>

              {/* Right — Phone visual (2 cols) */}
              <div className="md:col-span-2 hidden md:flex items-center justify-center relative overflow-hidden">
                {/* Animated background */}
                <div className={`absolute inset-0 bg-gradient-to-br ${scene.color} opacity-20 transition-all duration-700`} />
                <div className="absolute inset-0">
                  <motion.div
                    key={scene.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1.2, opacity: 0.08 }}
                    transition={{ duration: 3, ease: "easeOut" }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-white"
                  />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={scene.id}
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -40, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative z-10"
                  >
                    <PhoneScreen scene={scene} elapsed={sceneElapsed} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Phone screen renderer — renders different content per scene type
// ---------------------------------------------------------------------------

function PhoneScreen({ scene, elapsed }: { scene: (typeof scenes)[number]; elapsed: number }) {
  const color = scene.color;

  // CTA scene — big logo
  if (scene.phone.type === "cta") {
    return (
      <div className="w-[220px] h-[440px] rounded-[2rem] border border-white/20 bg-slate-900 overflow-hidden shadow-2xl flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", damping: 15 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-purple-500/40">
            <Sparkles size={28} className="text-white" />
          </div>
          <p className="text-lg font-bold text-white">CopyMe</p>
          <p className="text-[10px] text-white/40 mt-1">Communication reimagined</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-[220px] h-[440px] rounded-[2rem] border border-white/20 bg-white overflow-hidden shadow-2xl">
      {/* Notch */}
      <div className="relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-xl z-10" />
      </div>

      {/* Header */}
      {"header" in scene.phone && (
        <div className="pt-7 px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${color} flex items-center justify-center`}>
            <scene.icon size={10} className="text-white" />
          </div>
          <span className="text-[11px] font-semibold text-slate-900">{scene.phone.header}</span>
        </div>
      )}

      {/* Body */}
      <div className={`p-3 space-y-2 overflow-hidden ${"header" in scene.phone ? "" : "pt-8"}`}>
        {/* ---- Chaos scene (notifications) ---- */}
        {scene.phone.type === "chaos" &&
          scene.phone.notifications.map((n, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: elapsed > i * 400 ? 1 : 0, x: elapsed > i * 400 ? 0 : 30 }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className={`w-7 h-7 rounded-lg ${n.color} flex items-center justify-center`}>
                <MessageSquare size={10} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-medium text-slate-700">{n.app}</p>
                <p className="text-[8px] text-slate-400">Unread messages</p>
              </div>
              <span className="w-6 h-6 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center">
                {n.count}
              </span>
            </motion.div>
          ))}

        {/* ---- Intro scene ---- */}
        {scene.phone.type === "intro" && (
          <div className="flex flex-col items-center pt-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: elapsed > 300 ? 1 : 0 }}
              transition={{ type: "spring", damping: 12 }}
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}
            >
              <Sparkles size={24} className="text-white" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 600 ? 1 : 0 }}
              className="text-sm font-bold text-slate-900 mb-4"
            >
              {scene.phone.tagline}
            </motion.p>
            {scene.phone.features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{
                  opacity: elapsed > 1200 + i * 500 ? 1 : 0,
                  y: elapsed > 1200 + i * 500 ? 0 : 8,
                }}
                className="flex items-center gap-2 mb-2"
              >
                <div className="w-4 h-4 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-[8px] text-purple-600 font-bold">7</span>
                </div>
                <span className="text-[10px] text-slate-600">{f}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* ---- Chat scene ---- */}
        {scene.phone.type === "chat" && (
          <>
            {scene.phone.messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: elapsed > msg.delay ? 1 : 0,
                  y: elapsed > msg.delay ? 0 : 12,
                }}
                transition={{ duration: 0.4 }}
                className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-[10px] leading-relaxed ${
                    msg.sent
                      ? `bg-gradient-to-r ${color} text-white rounded-br-sm`
                      : "bg-slate-100 text-slate-700 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
            {/* Message counter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 4500 ? 1 : 0 }}
              className="flex justify-center mt-3"
            >
              <span className="px-3 py-1 rounded-full bg-purple-50 text-[9px] font-medium text-purple-600 border border-purple-100">
                {scene.phone.counter}
              </span>
            </motion.div>
          </>
        )}

        {/* ---- Profile / Value Connections scene ---- */}
        {scene.phone.type === "profile" && "profile" in scene.phone && (
          <div className="flex flex-col items-center">
            {/* Avatar + name */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: elapsed > 300 ? 1 : 0, scale: elapsed > 300 ? 1 : 0.8 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center mb-2"
            >
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${color} flex items-center justify-center mb-1`}>
                <span className="text-[9px] font-bold text-white">SC</span>
              </div>
              <p className="text-[10px] font-semibold text-slate-900">{scene.phone.profile.name}</p>
              <p className="text-[8px] text-slate-400">{scene.phone.profile.location}</p>
            </motion.div>

            {/* Match score */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: elapsed > 800 ? 1 : 0, y: elapsed > 800 ? 0 : 8 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-50 border border-pink-200 mb-2.5"
            >
              <Heart size={9} className="text-pink-500" />
              <span className="text-[10px] font-bold text-pink-600">{scene.phone.profile.matchScore}% Value Match</span>
            </motion.div>

            {/* Shared interests */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 1500 ? 1 : 0 }}
              className="w-full mb-2"
            >
              <div className="flex items-center gap-1 mb-1">
                <Sparkles size={8} className="text-purple-500" />
                <span className="text-[8px] font-semibold text-slate-600">Shared Interests</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {scene.phone.profile.sharedInterests.map((interest: string, i: number) => (
                  <motion.span
                    key={interest}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{
                      opacity: elapsed > 1800 + i * 300 ? 1 : 0,
                      scale: elapsed > 1800 + i * 300 ? 1 : 0.8,
                    }}
                    className="px-2 py-0.5 rounded-full text-[8px] font-medium bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 border border-purple-200"
                  >
                    {interest}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Their interests */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 3000 ? 1 : 0 }}
              className="w-full mb-2"
            >
              <span className="text-[8px] font-semibold text-slate-600 mb-1 block">Their Interests</span>
              <div className="flex flex-wrap gap-1">
                {scene.phone.profile.theirInterests.map((interest: string, i: number) => (
                  <motion.span
                    key={interest}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: elapsed > 3300 + i * 200 ? 1 : 0 }}
                    className="px-2 py-0.5 rounded-full text-[8px] font-medium bg-slate-100 text-slate-500"
                  >
                    {interest}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Messages remaining dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 4500 ? 1 : 0 }}
              className="flex items-center gap-1.5 mt-1"
            >
              <span className="text-[7px] text-slate-400">Messages left</span>
              <div className="flex gap-0.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${
                      i < scene.phone.profile.messagesLeft
                        ? "bg-gradient-to-br from-indigo-500 to-purple-500"
                        : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* ---- Match scene ---- */}
        {scene.phone.type === "match" &&
          scene.phone.matches.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -15 }}
              animate={{
                opacity: elapsed > m.delay ? 1 : 0,
                x: elapsed > m.delay ? 0 : -15,
              }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${color} flex items-center justify-center shrink-0`}>
                <span className="text-[8px] font-bold text-white">
                  {m.name.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-slate-900">{m.name}</p>
                <p className="text-[8px] text-slate-400">{m.tag}</p>
              </div>
              <div className="flex items-center gap-1">
                <Heart size={8} className="text-pink-500" />
                <span className="text-[9px] font-bold text-purple-600">{m.match}%</span>
              </div>
            </motion.div>
          ))}

        {/* ---- Assist scene ---- */}
        {scene.phone.type === "assist" && (
          <>
            {scene.phone.messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{
                  opacity: elapsed > msg.delay ? 1 : 0,
                  y: elapsed > msg.delay ? 0 : 12,
                }}
                transition={{ duration: 0.4 }}
                className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-[10px] leading-relaxed ${
                    msg.sent
                      ? `bg-gradient-to-r ${color} text-white rounded-br-sm`
                      : "bg-slate-100 text-slate-700 rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
            {/* AI suggestions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 2500 ? 1 : 0 }}
              className="mt-2 p-2 rounded-xl bg-amber-50 border border-amber-200"
            >
              <div className="flex items-center gap-1 mb-1.5">
                <Sparkles size={9} className="text-amber-500" />
                <span className="text-[8px] font-semibold text-amber-600">AI Suggestions</span>
              </div>
              {scene.phone.suggestions.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{
                    opacity: elapsed > s.delay ? 1 : 0,
                    x: elapsed > s.delay ? 0 : -8,
                  }}
                  className="flex items-center justify-between py-1 border-b border-amber-100 last:border-0"
                >
                  <span className="text-[9px] text-amber-800">{s.text}</span>
                  <span className="text-[7px] text-amber-500 ml-1 shrink-0">{s.tone}</span>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}

        {/* ---- Contacts scene ---- */}
        {scene.phone.type === "contacts" &&
          scene.phone.contacts.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: elapsed > c.delay ? 1 : 0,
                x: elapsed > c.delay ? 0 : -10,
              }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  c.active
                    ? `bg-gradient-to-br ${color}`
                    : "bg-white border-2 border-dashed border-slate-300"
                }`}
              >
                {c.active ? (
                  <span className="text-[7px] font-bold text-white">
                    {c.name.split(" ").map((n) => n[0]).join("")}
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400">+</span>
                )}
              </div>
              <p className={`text-[10px] flex-1 ${c.active ? "font-medium text-slate-900" : "text-slate-400 italic"}`}>
                {c.name}
              </p>
              {c.unread > 0 && (
                <span className="w-4 h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-[7px] font-bold text-white flex items-center justify-center">
                  {c.unread}
                </span>
              )}
            </motion.div>
          ))}

        {/* ---- Security scene ---- */}
        {scene.phone.type === "security" &&
          scene.phone.checks.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: elapsed > c.delay ? 1 : 0,
                x: elapsed > c.delay ? 0 : -10,
              }}
              transition={{ duration: 0.3 }}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: elapsed > c.delay + 200 ? 1 : 0 }}
                transition={{ type: "spring", damping: 10 }}
                className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center"
              >
                <Shield size={10} className="text-emerald-600" />
              </motion.div>
              <p className="text-[10px] font-medium text-slate-700 flex-1">{c.label}</p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: elapsed > c.delay + 300 ? 1 : 0 }}
                className="w-7 h-4 rounded-full bg-emerald-500 flex items-end justify-end p-0.5"
              >
                <div className="w-3 h-3 rounded-full bg-white" />
              </motion.div>
            </motion.div>
          ))}

        {/* ---- Yogi scene ---- */}
        {scene.phone.type === "yogi" && (
          <div className="flex flex-col items-center pt-2">
            {/* Avatar with pulsing gradient border */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: elapsed > 300 ? 1 : 0, scale: elapsed > 300 ? 1 : 0.5 }}
              transition={{ type: "spring", damping: 12 }}
              className="relative mb-2"
            >
              <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 animate-pulse" />
              <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={scene.phone.avatarUrl}
                  alt={scene.phone.name}
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>

            {/* Name label */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 600 ? 1 : 0 }}
              className="text-sm font-bold text-slate-900 mb-0.5"
            >
              Yogi
            </motion.p>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 800 ? 1 : 0 }}
              className="text-[8px] text-slate-400 mb-2"
            >
              AI companion for {scene.phone.name}
            </motion.p>

            {/* Personality traits */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: elapsed > 1200 ? 1 : 0 }}
              className="flex flex-wrap justify-center gap-1.5 mb-3"
            >
              {scene.phone.traits.map((trait: string, i: number) => (
                <motion.span
                  key={trait}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    opacity: elapsed > 1400 + i * 300 ? 1 : 0,
                    scale: elapsed > 1400 + i * 300 ? 1 : 0.8,
                  }}
                  className="px-2.5 py-1 rounded-full text-[9px] font-medium bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 border border-violet-200"
                >
                  {trait}
                </motion.span>
              ))}
            </motion.div>

            {/* Stats grid */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: elapsed > 2500 ? 1 : 0, y: elapsed > 2500 ? 0 : 8 }}
              className="grid grid-cols-3 gap-2 w-full mb-3"
            >
              {[
                { label: "Chats", value: scene.phone.stats.chats },
                { label: "Learned", value: scene.phone.stats.learned },
                { label: "Adapted", value: scene.phone.stats.adapted },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center p-1.5 rounded-lg bg-violet-50 border border-violet-100"
                >
                  <span className="text-[11px] font-bold text-violet-600">{stat.value}</span>
                  <span className="text-[7px] text-violet-400">{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Talk to Yogi button */}
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: elapsed > 3500 ? 1 : 0, y: elapsed > 3500 ? 0 : 8 }}
              className="w-full py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-[10px] font-semibold text-white shadow-lg shadow-purple-500/30 flex items-center justify-center gap-1.5"
            >
              <Sparkles size={10} className="text-white" />
              Talk to Yogi
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
