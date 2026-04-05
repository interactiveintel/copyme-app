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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgentiMessage {
  id: string;
  role: "user" | "agenti";
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
// Animated AI Avatar
// ---------------------------------------------------------------------------

function AIAvatar({
  speaking,
  listening,
  thinking,
  videoMode,
}: {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  videoMode: boolean;
}) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer pulse rings */}
      {(speaking || listening) && (
        <>
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className={`absolute w-40 h-40 rounded-full ${
              speaking
                ? "bg-purple-500/20"
                : "bg-emerald-500/20"
            }`}
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0, 0.2] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
            className={`absolute w-36 h-36 rounded-full ${
              speaking
                ? "bg-purple-500/15"
                : "bg-emerald-500/15"
            }`}
          />
        </>
      )}

      {/* Main avatar circle */}
      <motion.div
        animate={
          thinking
            ? { scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }
            : speaking
              ? { scale: [1, 1.08, 1] }
              : { scale: 1 }
        }
        transition={{ duration: thinking ? 1.5 : 0.8, repeat: Infinity }}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center shadow-2xl ${
          videoMode
            ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600"
            : "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
        }`}
      >
        {/* Inner glow */}
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/20 to-transparent" />

        {/* Icon */}
        {thinking ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Brain size={36} className="text-white" />
          </motion.div>
        ) : speaking ? (
          <Volume2 size={36} className="text-white" />
        ) : listening ? (
          <Mic size={36} className="text-white" />
        ) : (
          <Sparkles size={36} className="text-white" />
        )}

        {/* Status indicator */}
        <div
          className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
            speaking
              ? "bg-purple-500"
              : listening
                ? "bg-emerald-500"
                : thinking
                  ? "bg-amber-500"
                  : "bg-slate-400"
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
        </div>
      </motion.div>

      {/* Sound wave bars when speaking */}
      {speaking && (
        <div className="absolute -bottom-8 flex items-end gap-[3px]">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [4, 8 + Math.random() * 16, 4],
              }}
              transition={{
                duration: 0.4 + Math.random() * 0.3,
                repeat: Infinity,
                delay: i * 0.05,
              }}
              className="w-[3px] rounded-full bg-gradient-to-t from-purple-500 to-pink-400"
            />
          ))}
        </div>
      )}

      {/* Waveform when listening */}
      {listening && (
        <div className="absolute -bottom-8 flex items-end gap-[3px]">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{
                height: [4, 6 + Math.random() * 12, 4],
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
        Agenti Personality Profile
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
            {personality.totalChats} conversations — Agenti learns more each time
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AgentiAIScreen() {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState<"text" | "voice" | "video">("text");
  const [messages, setMessages] = useState<AgentiMessage[]>([
    {
      id: "welcome",
      role: "agenti",
      content:
        "Hey! I'm Agenti — your personal AI companion. I learn your communication style and adapt to you over time. You can type, talk, or even video chat with me. What's on your mind?",
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Send message to Agenti API
  // ---------------------------------------------------------------------------

  const sendToAgenti = useCallback(
    async (text: string, messageMode: "text" | "voice" | "video") => {
      const userMsg: AgentiMessage = {
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
        const res = await authFetch("/api/agents/agenti", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            mode: messageMode,
            conversationHistory: messages.slice(-10).map((m) => ({
              role: m.role === "agenti" ? "assistant" : "user",
              content: m.content,
            })),
          }),
        });

        let agentiResponse = "I'm having trouble connecting right now. Try again in a moment.";

        if (res.ok) {
          const data = await res.json();
          agentiResponse = data.data?.response || agentiResponse;

          // Update personality from response
          if (data.data?.personality) {
            setPersonality((prev) => ({ ...prev, ...data.data.personality }));
          }
        }

        const agentiMsg: AgentiMessage = {
          id: `agenti_${Date.now()}`,
          role: "agenti",
          content: agentiResponse,
          timestamp: new Date(),
          mode: messageMode,
        };

        setMessages((prev) => [...prev, agentiMsg]);

        // Speak the response in voice/video mode
        if ((messageMode === "voice" || messageMode === "video") && !isMuted) {
          speakResponse(agentiResponse);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: "agenti",
            content: "Connection hiccup — I'm still here though. Try again?",
            timestamp: new Date(),
            mode: messageMode,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [authFetch, messages, isMuted]
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
            sendToAgenti(text.trim(), mode === "video" ? "video" : "voice");
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
  }, [mode, sendToAgenti]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (transcript.trim().length > 2) {
      sendToAgenti(transcript.trim(), mode === "video" ? "video" : "voice");
    }
  }, [transcript, mode, sendToAgenti]);

  // ---------------------------------------------------------------------------
  // TTS
  // ---------------------------------------------------------------------------

  const speakResponse = useCallback(async (text: string) => {
    try {
      const { speak: speakFn } = await import("@/lib/voice");
      setIsSpeaking(true);
      speakFn({
        text,
        rate: 1.0,
        pitch: 1.0,
        onEnd: () => setIsSpeaking(false),
      });
    } catch {
      setIsSpeaking(false);
    }
  }, []);

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
    sendToAgenti(text, "text");
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                Agenti AI
                <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold">
                  BETA
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {isThinking
                  ? "Thinking..."
                  : isListening
                    ? "Listening..."
                    : isSpeaking
                      ? "Speaking..."
                      : "Your personal AI companion"}
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

            {/* AI Avatar */}
            <AIAvatar
              speaking={isSpeaking}
              listening={isListening}
              thinking={isThinking}
              videoMode={mode === "video"}
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
                {/* Avatar for Agenti */}
                {msg.role === "agenti" && (
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                      <Sparkles size={9} className="text-white" />
                    </div>
                    <span className="text-[10px] font-semibold text-purple-500">Agenti</span>
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

                {/* Feedback buttons for Agenti messages */}
                {msg.role === "agenti" && msg.id !== "welcome" && (
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
                <span className="text-xs text-slate-400">Agenti is thinking...</span>
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
              placeholder="Ask Agenti anything..."
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
