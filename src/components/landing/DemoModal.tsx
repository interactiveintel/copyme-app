"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Users,
  Zap,
  Heart,
} from "lucide-react";

interface DemoModalProps {
  open: boolean;
  onClose: () => void;
}

const slides = [
  {
    id: 1,
    title: "Rule of 7 Messaging",
    subtitle: "Less noise. More meaning.",
    description:
      "Every conversation is limited to 7 messages per cycle and 70 words per message. This constraint sparks creativity and deeper connections.",
    icon: MessageSquare,
    color: "from-indigo-500 to-purple-600",
    phone: {
      header: "Sarah Chen",
      messages: [
        { sent: false, text: "Hey! Have you tried the new feature?" },
        { sent: true, text: "Yes! The word limit actually makes me think more carefully about what I say" },
        { sent: false, text: "Exactly. Quality over quantity" },
        { sent: true, text: "6/7 messages left this cycle" },
      ],
    },
  },
  {
    id: 2,
    title: "AI Smart Match",
    subtitle: "Find your people.",
    description:
      "Our AI analyzes interests, communication style, and values to connect you with people who truly resonate with you.",
    icon: Sparkles,
    color: "from-purple-500 to-pink-500",
    phone: {
      header: "Smart Match",
      matches: [
        { name: "Alex Rivera", match: 94, tag: "Tech & Design" },
        { name: "Mia Zhang", match: 91, tag: "Music & Travel" },
        { name: "Jordan Blake", match: 88, tag: "Fitness & AI" },
      ],
    },
  },
  {
    id: 3,
    title: "AI Chat Assistant",
    subtitle: "Your communication copilot.",
    description:
      "Get real-time suggestions to craft more thoughtful messages. The AI helps you say what you mean within the 70-word limit.",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
    phone: {
      header: "Chat with Alex",
      messages: [
        { sent: false, text: "I'd love to collaborate on that project" },
        { sent: true, text: "That sounds great! When should we start?" },
      ],
      aiSuggestion: "Suggest a specific time to show commitment",
    },
  },
  {
    id: 4,
    title: "7 Active Contacts",
    subtitle: "Curate your inner circle.",
    description:
      "Focus on the relationships that matter most. With 7 active contacts, every conversation gets the attention it deserves.",
    icon: Users,
    color: "from-emerald-500 to-teal-500",
    phone: {
      header: "Contacts",
      contacts: [
        { name: "Sarah Chen", status: "Active", unread: 2 },
        { name: "Alex Rivera", status: "Active", unread: 0 },
        { name: "Mia Zhang", status: "Active", unread: 5 },
        { name: "Jordan Blake", status: "Active", unread: 1 },
        { name: "3 slots open", status: "Available", unread: 0 },
      ],
    },
  },
  {
    id: 5,
    title: "Safe & Encrypted",
    subtitle: "Privacy by design.",
    description:
      "End-to-end encryption, AI content moderation, and zero data selling. Your conversations stay yours.",
    icon: Shield,
    color: "from-cyan-500 to-blue-500",
    phone: {
      header: "Security",
      features: [
        { label: "End-to-End Encryption", active: true },
        { label: "AI Moderation", active: true },
        { label: "No Data Selling", active: true },
        { label: "Auto-Delete Messages", active: true },
      ],
    },
  },
];

export default function DemoModal({ open, onClose }: DemoModalProps) {
  const [current, setCurrent] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % slides.length);
  }, []);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    if (!open || !autoplay) return;
    const timer = setInterval(next, 4000);
    return () => clearInterval(timer);
  }, [open, autoplay, next]);

  useEffect(() => {
    if (!open) {
      setCurrent(0);
      setAutoplay(true);
    }
  }, [open]);

  const slide = slides[current];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-white rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors"
            >
              <X size={16} className="text-slate-600" />
            </button>

            <div className="grid md:grid-cols-2 min-h-[480px]">
              {/* Left — Info */}
              <div className="p-8 md:p-10 flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div
                      className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br ${slide.color} mb-5`}
                    >
                      <slide.icon size={22} className="text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                      {slide.title}
                    </h3>
                    <p className="text-sm font-medium text-purple-500 mb-3">
                      {slide.subtitle}
                    </p>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      {slide.description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="mt-8 flex items-center gap-4">
                  <button
                    onClick={() => {
                      setAutoplay(false);
                      prev();
                    }}
                    className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                  >
                    <ChevronLeft size={16} className="text-slate-600" />
                  </button>

                  {/* Dots */}
                  <div className="flex gap-2">
                    {slides.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setAutoplay(false);
                          setCurrent(i);
                        }}
                        className={`h-2 rounded-full transition-all duration-300 ${
                          i === current
                            ? "w-6 bg-gradient-to-r from-indigo-500 to-purple-500"
                            : "w-2 bg-slate-200 hover:bg-slate-300"
                        }`}
                      />
                    ))}
                  </div>

                  <button
                    onClick={() => {
                      setAutoplay(false);
                      next();
                    }}
                    className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
                  >
                    <ChevronRight size={16} className="text-slate-600" />
                  </button>

                  <span className="text-xs text-slate-400 ml-auto">
                    {current + 1}/{slides.length}
                  </span>
                </div>

                {/* Try it CTA */}
                <a
                  href="/app"
                  className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow w-fit"
                >
                  Try CopyMe Now
                  <ArrowRight size={14} />
                </a>
              </div>

              {/* Right — Phone mockup */}
              <div
                className={`hidden md:flex items-center justify-center bg-gradient-to-br ${slide.color} p-10 relative overflow-hidden`}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-10 left-10 w-32 h-32 rounded-full border-2 border-white" />
                  <div className="absolute bottom-20 right-10 w-24 h-24 rounded-full border-2 border-white" />
                  <div className="absolute top-1/2 left-1/2 w-40 h-40 rounded-full border-2 border-white -translate-x-1/2 -translate-y-1/2" />
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -30 }}
                    transition={{ duration: 0.4 }}
                    className="relative"
                  >
                    {/* Phone frame */}
                    <div className="w-[240px] h-[480px] rounded-[2rem] border-2 border-white/20 bg-white overflow-hidden shadow-2xl">
                      {/* Notch */}
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-black rounded-b-xl z-10" />

                      {/* Screen content */}
                      <div className="pt-7 h-full flex flex-col">
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full bg-gradient-to-br ${slide.color} flex items-center justify-center`}
                          >
                            <slide.icon size={12} className="text-white" />
                          </div>
                          <span className="text-xs font-semibold text-slate-900">
                            {slide.phone.header}
                          </span>
                        </div>

                        {/* Body */}
                        <div className="flex-1 p-4 space-y-2 overflow-hidden">
                          {/* Messages slide */}
                          {"messages" in slide.phone &&
                            slide.phone.messages.map((msg, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.3 }}
                                className={`flex ${msg.sent ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[80%] px-3 py-2 rounded-xl text-[10px] leading-relaxed ${
                                    msg.sent
                                      ? `bg-gradient-to-r ${slide.color} text-white rounded-br-sm`
                                      : "bg-slate-100 text-slate-700 rounded-bl-sm"
                                  }`}
                                >
                                  {msg.text}
                                </div>
                              </motion.div>
                            ))}

                          {/* AI suggestion */}
                          {"aiSuggestion" in slide.phone && (
                            <motion.div
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 1 }}
                              className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <Sparkles size={10} className="text-amber-500" />
                                <span className="text-[9px] font-semibold text-amber-600">
                                  AI Suggestion
                                </span>
                              </div>
                              <p className="text-[9px] text-amber-700">
                                {slide.phone.aiSuggestion}
                              </p>
                            </motion.div>
                          )}

                          {/* Matches slide */}
                          {"matches" in slide.phone &&
                            slide.phone.matches.map((m, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.3 }}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div
                                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${slide.color} flex items-center justify-center shrink-0`}
                                >
                                  <span className="text-[9px] font-bold text-white">
                                    {m.name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[10px] font-semibold text-slate-900">
                                    {m.name}
                                  </p>
                                  <p className="text-[8px] text-slate-400">{m.tag}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart size={8} className="text-pink-500" />
                                  <span className="text-[9px] font-bold text-purple-600">
                                    {m.match}%
                                  </span>
                                </div>
                              </motion.div>
                            ))}

                          {/* Contacts slide */}
                          {"contacts" in slide.phone &&
                            slide.phone.contacts.map((c, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.2 }}
                                className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div
                                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                                    c.status === "Available"
                                      ? "bg-slate-200 border-2 border-dashed border-slate-300"
                                      : `bg-gradient-to-br ${slide.color}`
                                  }`}
                                >
                                  {c.status === "Available" ? (
                                    <span className="text-[10px] text-slate-400">+</span>
                                  ) : (
                                    <span className="text-[8px] font-bold text-white">
                                      {c.name
                                        .split(" ")
                                        .map((n) => n[0])
                                        .join("")}
                                    </span>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="text-[10px] font-medium text-slate-900">
                                    {c.name}
                                  </p>
                                </div>
                                {c.unread > 0 && (
                                  <span className="w-4 h-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-[8px] font-bold text-white flex items-center justify-center">
                                    {c.unread}
                                  </span>
                                )}
                              </motion.div>
                            ))}

                          {/* Features slide */}
                          {"features" in slide.phone &&
                            slide.phone.features.map((f, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.25 }}
                                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                                  <Shield size={10} className="text-emerald-600" />
                                </div>
                                <p className="text-[10px] font-medium text-slate-700 flex-1">
                                  {f.label}
                                </p>
                                <div className="w-8 h-4 rounded-full bg-emerald-500 flex items-end justify-end p-0.5">
                                  <div className="w-3 h-3 rounded-full bg-white" />
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </div>
                    </div>
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
