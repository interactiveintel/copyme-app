"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  Sparkles,
  Brain,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  VolumeX,
  MessageCircle,
  Camera,
  ImagePlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { MOCK_PROFILES } from "@/lib/mock-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YogiMessage {
  id: string;
  role: "user" | "yogi";
  content: string;
  timestamp: Date;
  mode: "text" | "voice" | "video";
  feedback?: "liked" | "disliked";
}

interface PersonalityState {
  tone: string;
  humor: number;
  empathy: number;
  interests: string[];
  totalChats: number;
}

// ---------------------------------------------------------------------------
// Photo-based Animated AI Avatar — "Yogi"
// Shows user's photo with animated lip sync, eye blinks, head movement
// ---------------------------------------------------------------------------

function YogiAvatar({
  speaking,
  listening,
  thinking,
  videoMode,
  avatarUrl,
  name,
}: {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  videoMode: boolean;
  avatarUrl?: string;
  name?: string;
}) {
  const size = videoMode ? "w-36 h-36" : "w-32 h-32";
  const ringColor = speaking
    ? "from-purple-500 via-pink-500 to-rose-500"
    : listening
      ? "from-emerald-400 via-teal-400 to-cyan-400"
      : thinking
        ? "from-amber-400 via-orange-400 to-yellow-400"
        : "from-indigo-400 via-purple-400 to-pink-400";

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Outer pulse rings */}
      {(speaking || listening) && (
        <>
          <motion.div
            animate={{ scale: [1, 1.6, 1], opacity: [0.25, 0, 0.25] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute w-44 h-44 rounded-full ${
              speaking ? "bg-purple-500/20" : "bg-emerald-500/20"
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.35, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            className={`absolute w-40 h-40 rounded-full ${
              speaking ? "bg-purple-500/10" : "bg-emerald-500/10"
            }`}
          />
        </>
      )}

      {/* Animated ring */}
      <motion.div
        animate={
          speaking
            ? { rotate: 360 }
            : listening
              ? { rotate: -360 }
              : thinking
                ? { rotate: [0, 180] }
                : {}
        }
        transition={{
          duration: speaking || listening ? 4 : 3,
          repeat: Infinity,
          ease: "linear",
        }}
        className={`absolute ${size} rounded-full bg-gradient-to-tr ${ringColor} p-[3px]`}
        style={{ filter: speaking || listening ? "blur(0px)" : "blur(0.5px)" }}
      >
        <div className="w-full h-full rounded-full bg-white" />
      </motion.div>

      {/* Photo avatar with head movement */}
      <motion.div
        animate={
          thinking
            ? { scale: [1, 1.03, 1], rotateY: [0, 5, -5, 0] }
            : speaking
              ? {
                  scale: [1, 1.02, 1],
                  rotateZ: [0, 1, -1, 0.5, -0.5, 0],
                  y: [0, -2, 0, -1, 0],
                }
              : listening
                ? { scale: [1, 1.01, 1], rotateZ: [0, 0.5, -0.5, 0] }
                : { scale: 1 }
        }
        transition={{
          duration: thinking ? 2 : speaking ? 1.2 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className={`relative ${size} rounded-full overflow-hidden shadow-2xl border-[3px] border-white z-10`}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={name || "Yogi AI"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles size={40} className="text-white" />
          </div>
        )}

        {/* Speaking overlay — mouth animation simulation */}
        {speaking && (
          <div className="absolute inset-0 flex items-end justify-center">
            <motion.div
              animate={{
                scaleY: [0.3, 1, 0.5, 0.8, 0.3, 1, 0.6, 0.3],
                scaleX: [0.8, 1, 0.9, 1.1, 0.8, 1, 0.95, 0.8],
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="w-8 h-4 mb-[22%] rounded-full bg-gradient-to-b from-red-400/40 to-red-500/50 backdrop-blur-[1px]"
            />
          </div>
        )}

        {/* Eye blink animation — periodic blinks */}
        <motion.div
          animate={{ scaleY: [1, 1, 0.1, 1, 1, 1, 1, 1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[30%] left-[20%] w-[16%] h-[6%] rounded-full bg-transparent border-b-2 border-slate-800/20"
          style={{ transformOrigin: "center" }}
        />
        <motion.div
          animate={{ scaleY: [1, 1, 0.1, 1, 1, 1, 1, 1, 0.1, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.05 }}
          className="absolute top-[30%] right-[20%] w-[16%] h-[6%] rounded-full bg-transparent border-b-2 border-slate-800/20"
          style={{ transformOrigin: "center" }}
        />

        {/* Thinking overlay */}
        {thinking && (
          <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Brain size={28} className="text-white drop-shadow-lg" />
            </motion.div>
          </div>
        )}

        {/* Listening indicator overlay */}
        {listening && (
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/15 to-transparent" />
        )}
      </motion.div>

      {/* Status badge */}
      <motion.div
        animate={speaking || listening ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
        className={`absolute -bottom-1 right-[calc(50%-40px)] z-20 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-lg ${
          speaking
            ? "bg-purple-500"
            : listening
              ? "bg-emerald-500"
              : thinking
                ? "bg-amber-500"
                : "bg-slate-400"
        }`}
      >
        {speaking ? (
          <Volume2 size={11} className="text-white" />
        ) : listening ? (
          <Mic size={11} className="text-white" />
        ) : thinking ? (
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Brain size={11} className="text-white" />
          </motion.div>
        ) : (
          <Sparkles size={11} className="text-white" />
        )}
      </motion.div>

      {/* Name label */}
      {name && (
        <motion.p
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-sm font-bold text-slate-700 z-20"
        >
          {name}
        </motion.p>
      )}

      {/* Sound wave bars when speaking */}
      {speaking && (
        <div className="absolute -bottom-10 flex items-end gap-[3px] z-20">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [3, 6 + Math.random() * 18, 3],
              }}
              transition={{
                duration: 0.35 + Math.random() * 0.3,
                repeat: Infinity,
                delay: i * 0.04,
              }}
              className="w-[3px] rounded-full bg-gradient-to-t from-purple-500 to-pink-400"
            />
          ))}
        </div>
      )}

      {/* Waveform when listening */}
      {listening && (
        <div className="absolute -bottom-10 flex items-end gap-[3px] z-20">
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [3, 5 + Math.random() * 12, 3],
              }}
              transition={{
                duration: 0.3 + Math.random() * 0.4,
                repeat: Infinity,
                delay: i * 0.04,
              }}
              className="w-[3px] rounded-full bg-gradient-to-t from-emerald-500 to-teal-400"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personality Panel
// ---------------------------------------------------------------------------

function PersonalityPanel({ personality }: { personality: PersonalityState }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-28 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 p-4 z-30"
    >
      <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
        <Brain size={14} className="text-purple-500" />
        Yogi Personality Profile
      </h3>

      <div className="space-y-3">
        {/* Tone */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Communication Style</span>
          <span className="text-xs font-medium text-purple-600 capitalize">{personality.tone}</span>
        </div>

        {/* Humor */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Humor</span>
            <span className="text-xs text-slate-400">{personality.humor}/10</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all"
              style={{ width: `${personality.humor * 10}%` }}
            />
          </div>
        </div>

        {/* Empathy */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500">Empathy</span>
            <span className="text-xs text-slate-400">{personality.empathy}/10</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full transition-all"
              style={{ width: `${personality.empathy * 10}%` }}
            />
          </div>
        </div>

        {/* Interests */}
        {personality.interests.length > 0 && (
          <div>
            <span className="text-xs text-slate-500 block mb-1.5">Learned Interests</span>
            <div className="flex flex-wrap gap-1.5">
              {personality.interests.map((interest) => (
                <span
                  key={interest}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
          <MessageCircle size={12} className="text-slate-400" />
          <span className="text-[11px] text-slate-400">
            {personality.totalChats} conversations — Yogi learns more each time
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function YogiAIScreen() {
  const { user, authFetch } = useAuth();
  const [mode, setMode] = useState<"text" | "voice" | "video">("text");
  const [messages, setMessages] = useState<YogiMessage[]>([
    {
      id: "welcome",
      role: "yogi",
      content:
        "Hey! I'm Yogi — your personal agentic AI trained to learn your individual habits and assist you. I adapt to your communication style over time, remembering your preferences, interests, and personality. Chat with me by text, voice, or video. What's on your mind?",
      timestamp: new Date(),
      mode: "text",
    },
  ]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [showPersonality, setShowPersonality] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [personality, setPersonality] = useState<PersonalityState>({
    tone: "friendly",
    humor: 5,
    empathy: 7,
    interests: [],
    totalChats: 0,
  });

  // Avatar state — Yogi has its own distinct DiceBear avatar
  const defaultAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=yogi-copyme&backgroundColor=b6e3f4&eyes=bulging&mouth=smile01";
  const [yogiAvatarUrl, setYogiAvatarUrl] = useState<string>(defaultAvatar);
  const [yogiName, setYogiName] = useState<string>("Yogi");
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Handle photo upload for custom Yogi avatar
  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setYogiAvatarUrl(reader.result as string);
      setShowAvatarPicker(false);
    };
    reader.readAsDataURL(file);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Demo response system — keyword-matched local responses when no auth
  // ---------------------------------------------------------------------------

  const demoResponses: Array<{ keywords: string[]; response: string }> = [
    {
      keywords: ["hello", "hi", "hey", "sup", "what's up", "howdy", "greetings"],
      response: "Hey there! Great to hear from you. I'm Yogi, your personal AI companion here on CopyMe. How can I help you today?",
    },
    {
      keywords: ["copyme", "app", "what is", "how does", "feature", "about"],
      response: "CopyMe is your all-in-one social messaging platform! It combines messaging, AI-curated ad inbox, smart contact matching, and me — Yogi, your personal AI companion. I learn your communication style over time to become more helpful. Pretty cool, right?",
    },
    {
      keywords: ["help", "can you", "what can", "able to", "do you"],
      response: "I can help with a lot! You can chat with me by text, voice, or video. I can answer questions, brainstorm ideas, help you practice conversations, or just keep you company. I also learn your style over time so my responses feel more natural to you.",
    },
    {
      keywords: ["weather", "temperature", "rain", "sunny", "forecast"],
      response: "I wish I could check the weather for you in real-time! In the full version of CopyMe, I can connect to live data sources. For now, I'd recommend checking your favorite weather app. Is there anything else I can help with?",
    },
    {
      keywords: ["joke", "funny", "laugh", "humor", "tell me"],
      response: "Here's one for you: Why do programmers prefer dark mode? Because light attracts bugs! But seriously, I'm always learning what makes you laugh so I can be a better companion. Got any favorite topics?",
    },
    {
      keywords: ["thanks", "thank you", "appreciate", "awesome", "great"],
      response: "You're welcome! That's what I'm here for. The more we chat, the better I understand your style. Keep the conversations coming!",
    },
    {
      keywords: ["voice", "speak", "talk", "listen", "audio", "call"],
      response: "Voice mode is awesome! Just switch to the voice tab and tap the mic to start talking to me. I'll listen, understand your speech, and respond both with text and voice. It feels like a real conversation!",
    },
    {
      keywords: ["video", "camera", "see", "face", "visual"],
      response: "Video mode lets us have a face-to-face chat! Turn on your camera, and I'll show my animated avatar while we talk. The voice recognition works the same way — just speak naturally and I'll respond. Try it out!",
    },
    {
      keywords: ["bye", "goodbye", "see you", "later", "night", "gtg"],
      response: "See you later! Remember, I'm always here whenever you want to chat. Each conversation helps me understand you better. Take care!",
    },
    {
      keywords: ["name", "who are", "yourself", "your name", "yogi"],
      response: "I'm Yogi — your personal AI companion on CopyMe! You can customize my avatar, change my name, and the more we chat, the more I adapt to your communication style. I track humor, empathy, and your interests to become a better conversational partner.",
    },
  ];

  const getDemoResponse = (text: string): string => {
    const lower = text.toLowerCase();
    for (const entry of demoResponses) {
      if (entry.keywords.some((kw) => lower.includes(kw))) {
        return entry.response;
      }
    }
    return "That's an interesting thought! I'm still learning about your communication style. In the full version, I'd have access to smarter AI models for deeper conversations. For now, feel free to ask me about CopyMe features, try voice or video mode, or just say hi!";
  };

  // ---------------------------------------------------------------------------
  // Send message to Yogi API
  // ---------------------------------------------------------------------------

  const sendToYogi = useCallback(
    async (text: string, messageMode: "text" | "voice" | "video") => {
      const userMsg: YogiMessage = {
        id: `user_${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
        mode: messageMode,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setTranscript("");
      setIsThinking(true);

      try {
        let yogiResponse: string;

        if (!user) {
          // Demo mode: generate local response instead of calling API
          await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 800));
          yogiResponse = getDemoResponse(text);
          setPersonality((prev) => ({
            ...prev,
            totalChats: prev.totalChats + 1,
            interests: Array.from(new Set([...prev.interests, ...text.split(/\s+/).filter((w) => w.length > 5).slice(0, 2)])).slice(0, 6),
          }));
        } else {
          const res = await authFetch("/api/agents/yogi", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: text,
              mode: messageMode,
              conversationHistory: messages.slice(-10).map((m) => ({
                role: m.role === "yogi" ? "assistant" : "user",
                content: m.content,
              })),
            }),
          });

          yogiResponse = "I'm having trouble connecting right now. Try again in a moment.";

          if (res.ok) {
            const data = await res.json();
            yogiResponse = data.data?.response || yogiResponse;

            // Update personality from response
            if (data.data?.personality) {
              setPersonality((prev) => ({ ...prev, ...data.data.personality }));
            }
          }
        }

        const yogiMsg: YogiMessage = {
          id: `yogi_${Date.now()}`,
          role: "yogi",
          content: yogiResponse,
          timestamp: new Date(),
          mode: messageMode,
        };

        setMessages((prev) => [...prev, yogiMsg]);

        // Speak the response in voice/video mode
        if ((messageMode === "voice" || messageMode === "video") && !isMuted) {
          speakResponse(yogiResponse);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "yogi",
            content: "Connection hiccup — I'm still here though. Try again?",
            timestamp: new Date(),
            mode: messageMode,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [user, authFetch, messages, isMuted]
  );

  // ---------------------------------------------------------------------------
  // Voice input
  // ---------------------------------------------------------------------------

  const startListening = useCallback(async () => {
    try {
      const { createVoiceListener } = await import("@/lib/voice");
      const listener = createVoiceListener({
        continuous: true,
        interimResults: true,
        onResult: (text, isFinal) => {
          setTranscript(text);
          if (isFinal && text.trim().length > 2) {
            setIsListening(false);
            recognitionRef.current?.stop();
            sendToYogi(text.trim(), mode === "video" ? "video" : "voice");
          }
        },
        onError: (err) => {
          console.warn("Speech recognition error:", err);
          setIsListening(false);
        },
        onEnd: () => {
          setIsListening(false);
        },
      });

      if (listener) {
        recognitionRef.current = listener;
        listener.start();
        setIsListening(true);
        setTranscript("");
      }
    } catch (err) {
      console.warn("Voice not supported:", err);
    }
  }, [mode, sendToYogi]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (transcript.trim().length > 2) {
      sendToYogi(transcript.trim(), mode === "video" ? "video" : "voice");
    }
  }, [transcript, mode, sendToYogi]);

  // ---------------------------------------------------------------------------
  // TTS
  // ---------------------------------------------------------------------------

  // Resolve voice name from current avatar selection
  const selectedVoice = Object.values(MOCK_PROFILES).find(
    (p) => p.avatarUrl === yogiAvatarUrl
  )?.voiceName;

  const speakResponse = useCallback(async (text: string) => {
    try {
      const { speak: speakFn } = await import("@/lib/voice");
      setIsSpeaking(true);
      speakFn({
        text,
        voice: selectedVoice,
        rate: 1.0,
        pitch: 1.0,
        onEnd: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  }, [selectedVoice]);

  const stopSpeaking = useCallback(async () => {
    try {
      const { stopSpeaking: stop } = await import("@/lib/voice");
      stop();
    } catch { /* ignore */ }
    setIsSpeaking(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Camera
  // ---------------------------------------------------------------------------

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraOn(true);
        setMode("video");
      } catch (err) {
        console.warn("Camera access denied:", err);
      }
    }
  }, [cameraOn]);

  // Cleanup
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recognitionRef.current?.abort();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  const handleFeedback = (msgId: string, type: "liked" | "disliked") => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback: type } : m))
    );
    setPersonality((prev) => ({
      ...prev,
      totalChats: prev.totalChats + 1,
      ...(type === "liked" ? { empathy: Math.min(10, prev.empathy + 0.2) } : {}),
    }));
  };

  // ---------------------------------------------------------------------------
  // Text send
  // ---------------------------------------------------------------------------

  const handleTextSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    sendToYogi(text, "text");
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isActive = isListening || isSpeaking || isThinking;

  return (
    <div className="flex flex-col h-full bg-white pb-16">
      {/* Header */}
      <div className="relative z-10 px-4 pt-12 pb-3 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Tappable Yogi avatar — opens avatar picker */}
            <button
              onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="relative w-10 h-10 rounded-full overflow-hidden shadow-lg shadow-purple-500/20 border-2 border-purple-400 flex-shrink-0"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={yogiAvatarUrl} alt="Yogi" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-purple-500/20 to-transparent" />
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border border-white" />
            </button>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                {yogiName}
                <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold">
                  AI
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {isThinking
                  ? "Thinking..."
                  : isListening
                    ? "Listening..."
                    : isSpeaking
                      ? "Speaking..."
                      : "Agentic AI — learns your habits"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPersonality(!showPersonality)}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
            >
              <Brain size={16} className="text-slate-500" />
            </button>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center"
            >
              {isMuted ? (
                <VolumeX size={16} className="text-slate-500" />
              ) : (
                <Volume2 size={16} className="text-slate-500" />
              )}
            </button>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mt-3">
          {(["text", "voice", "video"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                if (m !== "video" && cameraOn) {
                  streamRef.current?.getTracks().forEach((t) => t.stop());
                  setCameraOn(false);
                }
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                mode === m
                  ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {m === "text" && <MessageCircle size={13} />}
              {m === "voice" && <Mic size={13} />}
              {m === "video" && <Video size={13} />}
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Voice/Video mode — centered avatar */}
        {(mode === "voice" || mode === "video") && (
          <div className="flex flex-col items-center justify-center py-10 relative">
            {/* Camera preview (video mode) */}
            {mode === "video" && (
              <div className="absolute top-4 right-4 w-24 h-32 rounded-2xl overflow-hidden bg-slate-900 border-2 border-white shadow-lg z-20">
                {cameraOn ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirror"
                    style={{ transform: "scaleX(-1)" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <VideoOff size={16} className="text-white/40" />
                  </div>
                )}
              </div>
            )}

            {/* Yogi Avatar — photo-based animated face */}
            <YogiAvatar
              speaking={isSpeaking}
              listening={isListening}
              thinking={isThinking}
              videoMode={mode === "video"}
              avatarUrl={yogiAvatarUrl}
              name={yogiName}
            />

            {/* Status text */}
            <div className="mt-12 text-center">
              {isListening && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-emerald-600 font-medium"
                >
                  Listening...
                </motion.p>
              )}
              {transcript && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-slate-600 mt-2 max-w-xs mx-auto italic"
                >
                  &ldquo;{transcript}&rdquo;
                </motion.p>
              )}
              {isThinking && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-amber-600 font-medium"
                >
                  Processing...
                </motion.p>
              )}
              {isSpeaking && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-purple-600 font-medium"
                >
                  Speaking...
                </motion.p>
              )}
              {!isActive && (
                <p className="text-sm text-slate-400 mt-2">
                  {mode === "voice" ? "Tap the mic to start talking" : "Tap the mic or enable camera"}
                </p>
              )}
            </div>

            {/* Voice/video controls */}
            <div className="flex items-center gap-4 mt-8">
              {mode === "video" && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={toggleCamera}
                  className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    cameraOn
                      ? "bg-blue-500 shadow-lg shadow-blue-500/30"
                      : "bg-slate-200"
                  }`}
                >
                  {cameraOn ? (
                    <Video size={22} className="text-white" />
                  ) : (
                    <VideoOff size={22} className="text-slate-500" />
                  )}
                </motion.button>
              )}

              {/* Main mic button */}
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={isListening ? stopListening : startListening}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-emerald-500 shadow-xl shadow-emerald-500/40 scale-110"
                    : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/30"
                }`}
              >
                {isListening ? (
                  <MicOff size={24} className="text-white" />
                ) : (
                  <Mic size={24} className="text-white" />
                )}
              </motion.button>

              {isSpeaking && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={stopSpeaking}
                  className="w-14 h-14 rounded-full bg-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30"
                >
                  <PhoneOff size={20} className="text-white" />
                </motion.button>
              )}
            </div>
          </div>
        )}

        {/* Chat messages (all modes) */}
        <div className={`px-4 py-4 space-y-3 ${mode !== "text" ? "pt-2" : ""}`}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                {/* Avatar for Yogi */}
                {msg.role === "yogi" && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-purple-300 flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={yogiAvatarUrl} alt={yogiName} className="w-full h-full object-cover" />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-500">{yogiName}</span>
                    {msg.mode !== "text" && (
                      <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                        {msg.mode === "voice" && <Mic size={8} />}
                        {msg.mode === "video" && <Video size={8} />}
                        {msg.mode}
                      </span>
                    )}
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-br-md"
                      : "bg-slate-100 text-slate-800 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>

                {/* Feedback buttons for Yogi messages */}
                {msg.role === "yogi" && msg.id !== "welcome" && (
                  <div className="flex items-center gap-1.5 mt-1.5 ml-1">
                    <button
                      onClick={() => handleFeedback(msg.id, "liked")}
                      className={`p-1 rounded-full transition-all ${
                        msg.feedback === "liked"
                          ? "bg-emerald-100 text-emerald-600"
                          : "text-slate-300 hover:text-slate-500"
                      }`}
                    >
                      <ThumbsUp size={11} />
                    </button>
                    <button
                      onClick={() => handleFeedback(msg.id, "disliked")}
                      className={`p-1 rounded-full transition-all ${
                        msg.feedback === "disliked"
                          ? "bg-rose-100 text-rose-600"
                          : "text-slate-300 hover:text-slate-500"
                      }`}
                    >
                      <ThumbsDown size={11} />
                    </button>
                    {!isMuted && msg.mode === "text" && (
                      <button
                        onClick={() => speakResponse(msg.content)}
                        className="p-1 rounded-full text-slate-300 hover:text-slate-500 transition-all"
                      >
                        <Volume2 size={11} />
                      </button>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <p
                  className={`text-[10px] text-slate-400 mt-0.5 ${
                    msg.role === "user" ? "text-right" : ""
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </motion.div>
          ))}

          {/* Thinking indicator */}
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-slate-400">Yogi is thinking...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Personality panel overlay */}
      <AnimatePresence>
        {showPersonality && <PersonalityPanel personality={personality} />}
      </AnimatePresence>

      {/* Avatar picker overlay */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-28 left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-slate-200 p-4 z-30"
          >
            <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
              <ImagePlus size={14} className="text-purple-500" />
              Choose Your Yogi Avatar
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">Upload your photo or pick a personality</p>

            {/* Upload photo button */}
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-xs font-semibold shadow-md"
            >
              <Camera size={14} />
              Upload Your Photo
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoUpload}
              className="hidden"
            />

            {/* Pre-made avatars from mock profiles */}
            <div className="grid grid-cols-5 gap-2">
              {Object.values(MOCK_PROFILES).map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => {
                    setYogiAvatarUrl(profile.avatarUrl);
                    setYogiName(profile.displayName.split(" ")[0]);
                    setShowAvatarPicker(false);
                  }}
                  className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                    yogiAvatarUrl === profile.avatarUrl
                      ? "border-purple-500 shadow-md shadow-purple-500/20"
                      : "border-slate-200"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-1 py-0.5">
                    <span className="text-[8px] text-white font-medium">{profile.displayName.split(" ")[0]}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Reset to default */}
            <button
              onClick={() => {
                setYogiAvatarUrl(defaultAvatar);
                setYogiName("Yogi");
                setShowAvatarPicker(false);
              }}
              className="w-full mt-2 py-2 rounded-xl bg-slate-100 text-slate-500 text-xs font-medium"
            >
              Reset to Default Yogi
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text input (always visible) */}
      <div className="px-4 pb-4 pt-3 bg-white/90 backdrop-blur-xl border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextSend();
                }
              }}
              placeholder="Ask Yogi anything..."
              rows={1}
              className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 resize-none transition-colors"
            />
          </div>

          {input.trim() ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleTextSend}
              disabled={isThinking}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 disabled:opacity-50"
            >
              <Send size={17} className="text-white -rotate-45 ml-0.5" />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={isListening ? stopListening : startListening}
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                isListening
                  ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                  : "bg-slate-100"
              }`}
            >
              <Mic size={17} className={isListening ? "text-white" : "text-slate-400"} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
