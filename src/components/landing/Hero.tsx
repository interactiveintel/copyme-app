"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Shield,
  Sparkles,
  Zap,
  Users,
  CheckCheck,
  Heart,
  Smile,
  Mic,
  Plus,
  Bell,
  Wifi,
  Signal,
  BatteryFull,
} from "lucide-react";
import DownloadButton from "./DownloadButton";
import DemoModal from "./DemoModal";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.3 },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

const stats = [
  { icon: Users, label: "10M+ Target Users", color: "text-accent-pink" },
  { icon: Sparkles, label: "Rule of 7", color: "text-secondary" },
  { icon: Zap, label: "AI-Powered", color: "text-accent-amber" },
  { icon: Shield, label: "End-to-End Encrypted", color: "text-accent-emerald" },
];

interface HeroProps {
  /**
   * Optional translation lookup. When omitted, falls back to the original
   * English copy that was hard-coded before S-254 — keeps the root `/` page
   * behaviour byte-identical for the English audience.
   */
  t?: (key: string) => string;
}

export default function Hero({ t }: HeroProps = {}) {
  const [showDemo, setShowDemo] = useState(false);
  const heroH1 = t ? t("hero.h1") : "Your World's chart of Communication";
  const subheadLead = t ? t("hero.subhead.lead") : "Rule of 7";
  const subheadBody = t
    ? t("hero.subhead.body")
    : "A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact";
  const ctaSignup = t ? t("cta.signup") : "Sign Up Free";
  const ctaDemo = t ? t("cta.demo") : "Watch the Demo";

  return (
    <>
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      {/* Floating Gradient Orbs */}
      <div className="orb w-[500px] h-[500px] bg-primary/15 top-[-10%] left-[-10%] animate-float" />
      <div className="orb w-[400px] h-[400px] bg-secondary/10 top-[20%] right-[-5%] animate-float-delayed" />
      <div className="orb w-[350px] h-[350px] bg-accent-pink/10 bottom-[5%] left-[20%] animate-float-slow" />
      <div className="orb w-[250px] h-[250px] bg-accent-cyan/10 top-[50%] left-[50%] animate-float" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="text-center lg:text-left"
          >
            {/* Eyebrow Badge */}
            <motion.div variants={item} className="inline-block mb-6">
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wider text-slate-700 gradient-border">
                <span className="relative z-10 flex items-center gap-2 px-1">
                  <Sparkles size={14} className="text-accent-amber" />
                  THE FUTURE OF COMMUNICATION
                </span>
              </span>
            </motion.div>

            {/* Primary headline — per Feedback 3 / S-010, "Communication That
                Matters" stays as H1; only "Copies" was struck. */}
            <motion.h1
              variants={item}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight text-slate-900"
            >
              Communication That{" "}
              <span className="gradient-text">Matters</span>
            </motion.h1>

            {/* Second-tier headline (S-010) — Joze's new framing sits below the
                primary, above the Rule-of-7 subhead paragraph. Maps to the
                i18n `hero.h1` key (the translated marquee). */}
            <motion.h2
              variants={item}
              className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-slate-700"
            >
              {heroH1}
            </motion.h2>

            {/* Subheadline */}
            <motion.p
              variants={item}
              className="mt-6 text-lg sm:text-xl text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              <span className="font-semibold text-slate-700">{subheadLead}</span> — {subheadBody}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={item}
              className="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              <a
                href="/app"
                className="group relative inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_40px_rgba(124,58,237,0.5)]"
              >
                {ctaSignup}
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </a>
              <button
                onClick={() => {
                  // Unlock browser speech synthesis with user gesture
                  if (typeof window !== "undefined" && window.speechSynthesis) {
                    const silent = new SpeechSynthesisUtterance("");
                    silent.volume = 0;
                    window.speechSynthesis.speak(silent);
                  }
                  setShowDemo(true);
                }}
                className="group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-slate-700 border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-purple-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
                  <Play size={12} className="text-white ml-0.5" />
                </span>
                {ctaDemo}
              </button>
              <DownloadButton variant="hero" />
            </motion.div>

            {/* Stats Bar */}
            <motion.div
              variants={item}
              className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col items-center lg:items-start gap-1.5 p-3 rounded-xl bg-white shadow-sm border border-slate-100"
                >
                  <stat.icon size={18} className={stat.color} />
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                    {stat.label}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Right — Phone Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 60, rotateY: -10 }}
            animate={{ opacity: 1, x: 0, rotateY: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
            className="hidden lg:flex justify-center"
          >
            <PhonePreview />
          </motion.div>
        </div>
      </div>

    </section>
    <DemoModal open={showDemo} onClose={() => setShowDemo(false)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// PhonePreview — animated CopyMe-branded chat mockup for the Hero.
//
// Designed to feel "alive" so the hero doesn't read as a flat screenshot:
//   - status bar with live signal/wifi/battery icons
//   - app header with the CopyMe wordmark on the top left, smart-match badge,
//     and notification dot
//   - contact row with avatar, name, online pulse, "typing…" line
//   - chat bubbles fade + slide in sequentially via framer-motion stagger
//   - emoji reactions pop on the brand-coloured bubbles
//   - blue read-receipt double-tick on every sent message
//   - AI-suggestion chip (Yogi) shimmers in below the latest received line
//   - Rule-of-7 footer shows live "5/7 messages · 64/70 words" counter
//   - send button has a soft pulsing halo so the eye keeps returning to CTA
// ---------------------------------------------------------------------------

interface BubbleData {
  id: number;
  sent: boolean;
  text: string;
  delay: number;
  reactions?: string[];
  /** Use the secondary -> pink gradient instead of primary -> secondary. */
  altGradient?: boolean;
}

const HERO_BUBBLES: BubbleData[] = [
  { id: 1, sent: false, text: "Hey! Have you tried CopyMe yet?", delay: 0.6 },
  { id: 2, sent: true, text: "Just signed up! The Rule of 7 is genius", delay: 1.0, reactions: ["🔥"] },
  { id: 3, sent: false, text: "Right? Less noise, more connection", delay: 1.6, reactions: ["💜"] },
  { id: 4, sent: true, text: "The AI features are incredible too", delay: 2.2, altGradient: true },
];

function PhonePreview() {
  return (
    <div className="relative">
      {/* Glow behind phone */}
      <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-primary/30 via-secondary/20 to-accent-pink/30 blur-3xl scale-110 animate-pulse-glow" />

      {/* Floating brand-coloured orbs around the device */}
      <motion.div
        className="absolute -top-6 -left-6 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary opacity-80 shadow-xl shadow-primary/30"
        animate={{ y: [0, -8, 0], rotate: [0, 6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="w-full h-full flex items-center justify-center text-white">
          <Sparkles size={18} />
        </div>
      </motion.div>
      <motion.div
        className="absolute -bottom-4 -right-4 w-10 h-10 rounded-full bg-gradient-to-br from-accent-pink to-secondary opacity-80 shadow-xl shadow-accent-pink/30 flex items-center justify-center text-white"
        animate={{ y: [0, 6, 0], rotate: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      >
        <Heart size={14} />
      </motion.div>

      {/* Phone frame */}
      <div className="relative w-[290px] h-[600px] rounded-[2.75rem] border-[3px] border-slate-900/10 bg-white overflow-hidden shadow-[0_30px_80px_-20px_rgba(79,70,229,0.4)]">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-slate-900 rounded-b-2xl z-20" />

        {/* Status bar */}
        <div className="flex justify-between items-center px-6 pt-2.5 pb-1 text-[10px] text-slate-500">
          <span className="font-semibold tabular-nums">9:41</span>
          <div className="flex items-center gap-1">
            <Signal size={10} className="text-slate-500" />
            <Wifi size={10} className="text-slate-500" />
            <BatteryFull size={12} className="text-slate-500" />
          </div>
        </div>

        {/* App header — CopyMe wordmark + nav */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
          <div className="inline-flex items-center gap-0.5 select-none">
            <span className="text-base font-extrabold tracking-tight text-slate-900">Copy</span>
            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Me
            </span>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              className="relative w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center"
              whileHover={{ scale: 1.08 }}
            >
              <Bell size={12} className="text-slate-600" />
              <motion.span
                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-accent-pink ring-2 ring-white"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary via-secondary to-accent-pink flex items-center justify-center shadow-sm">
              <Sparkles size={11} className="text-white" />
            </div>
          </div>
        </div>

        {/* Contact row */}
        <div className="px-4 py-2.5 flex items-center gap-3 bg-gradient-to-r from-indigo-50/60 via-purple-50/60 to-pink-50/60">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-accent-pink flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
              SC
            </div>
            <motion.span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-accent-emerald ring-2 ring-white"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-slate-900 leading-tight">Sarah Chen</div>
            <div className="text-[10px] text-accent-emerald font-medium leading-tight">Online · typing…</div>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-purple-100 text-purple-700 tracking-wide">
              92% MATCH
            </span>
          </div>
        </div>

        {/* Chat thread */}
        <div className="px-4 pt-3 pb-2 space-y-2.5 overflow-hidden" style={{ minHeight: "320px" }}>
          {HERO_BUBBLES.map((b) => (
            <ChatBubble key={b.id} bubble={b} />
          ))}

          {/* Typing indicator */}
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.8, duration: 0.4 }}
          >
            <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-slate-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce-subtle" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce-subtle" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce-subtle" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>

          {/* Yogi AI suggestion chip */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 3.2, duration: 0.45, ease: "easeOut" }}
            className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 border border-purple-200 shadow-sm"
          >
            <Sparkles size={10} className="text-purple-600" />
            <span className="text-[10px] font-semibold text-slate-700">
              Yogi suggests: <span className="text-purple-600">&ldquo;Want to grab coffee Friday?&rdquo;</span>
            </span>
          </motion.div>
        </div>

        {/* Input bar */}
        <div className="absolute bottom-0 left-0 right-0 px-3 pt-2 pb-3 bg-white border-t border-slate-100">
          {/* Rule-of-7 counter */}
          <div className="flex items-center justify-between px-1 mb-1.5">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <motion.div
                  key={i}
                  className={`h-1 rounded-full ${
                    i < 5 ? "bg-gradient-to-r from-primary to-accent-pink" : "bg-slate-200"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: 10 }}
                  transition={{ delay: 0.6 + i * 0.08, duration: 0.4 }}
                />
              ))}
              <span className="ml-1.5 text-[9px] font-semibold text-slate-500 tabular-nums">5 / 7</span>
            </div>
            <span className="text-[9px] font-semibold text-slate-400 tabular-nums">64 / 70 words</span>
          </div>

          {/* Input row */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <Plus size={14} className="text-slate-500" />
            </div>
            <div className="flex-1 h-9 rounded-full bg-slate-100 px-3 flex items-center justify-between">
              <span className="text-[10px] text-slate-500">Type a message…</span>
              <Smile size={12} className="text-slate-400" />
            </div>
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
              <Mic size={13} className="text-slate-500" />
            </div>
            <motion.div
              className="relative w-9 h-9 rounded-full bg-gradient-to-r from-primary via-secondary to-accent-pink flex items-center justify-center shadow-md shadow-primary/30"
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ArrowRight size={14} className="text-white" />
              <motion.span
                className="absolute inset-0 rounded-full border-2 border-primary/40"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ bubble }: { bubble: BubbleData }) {
  const sentGradient = bubble.altGradient
    ? "bg-gradient-to-r from-secondary to-accent-pink"
    : "bg-gradient-to-r from-primary to-secondary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: bubble.delay, duration: 0.4, ease: "easeOut" }}
      className={`flex ${bubble.sent ? "justify-end" : "justify-start"}`}
    >
      <div className="relative max-w-[75%]">
        <div
          className={
            bubble.sent
              ? `px-3 py-2 rounded-2xl rounded-br-md ${sentGradient} text-[11px] text-white leading-snug shadow-sm shadow-primary/20`
              : "px-3 py-2 rounded-2xl rounded-bl-md bg-slate-100 text-[11px] text-slate-800 leading-snug"
          }
        >
          {bubble.text}
        </div>

        {/* Read receipts on sent bubbles */}
        {bubble.sent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: bubble.delay + 0.5, duration: 0.3 }}
            className="absolute -bottom-1 right-1 flex items-center gap-0.5"
          >
            <CheckCheck size={10} className="text-primary" />
          </motion.div>
        )}

        {/* Reactions */}
        {bubble.reactions && bubble.reactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: bubble.delay + 0.4,
              duration: 0.35,
              type: "spring",
              stiffness: 300,
              damping: 18,
            }}
            className={`absolute -bottom-2 ${
              bubble.sent ? "right-2" : "left-2"
            } px-1.5 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm text-[10px] leading-none`}
          >
            {bubble.reactions.join(" ")}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
