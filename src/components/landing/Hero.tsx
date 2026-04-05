"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Play, Shield, Sparkles, Zap, Users } from "lucide-react";
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

export default function Hero() {
  const [showDemo, setShowDemo] = useState(false);

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

            {/* Headline */}
            <motion.h1
              variants={item}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight tracking-tight text-slate-900"
            >
              Communication That{" "}
              <span className="gradient-text">Copies</span>{" "}
              Your World
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              variants={item}
              className="mt-6 text-lg sm:text-xl text-slate-500 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Built on the Rule of 7 — a revolutionary constraint system that
              replaces noise with meaning. Seven messages. Seventy words. Infinite
              impact.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              variants={item}
              className="mt-10 flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              <a
                href="#cta"
                className="group relative inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white gradient-bg-animated transition-shadow hover:shadow-[0_0_40px_rgba(124,58,237,0.5)]"
              >
                Start Free
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-1"
                />
              </a>
              <button
                onClick={() => setShowDemo(true)}
                className="group inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-slate-700 border border-slate-200 bg-white transition-all hover:bg-slate-50 hover:border-purple-200 shadow-sm"
              >
                <span className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm shadow-purple-500/20 group-hover:shadow-purple-500/40 transition-shadow">
                  <Play size={12} className="text-white ml-0.5" />
                </span>
                Watch the Demo
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
            <div className="relative">
              {/* Glow behind phone */}
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-br from-primary/30 via-secondary/20 to-accent-pink/30 blur-3xl scale-110" />

              {/* Phone frame */}
              <div className="relative w-[280px] h-[560px] rounded-[2.5rem] border-2 border-white/20 bg-navy-light/90 backdrop-blur-xl overflow-hidden shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 bg-navy rounded-b-2xl z-10" />

                {/* Status bar */}
                <div className="flex justify-between items-center px-6 pt-8 pb-2 text-[10px] text-slate-400">
                  <span>9:41</span>
                  <div className="flex gap-1">
                    <div className="w-3 h-1.5 bg-white/40 rounded-sm" />
                    <div className="w-3 h-1.5 bg-white/40 rounded-sm" />
                    <div className="w-3 h-1.5 bg-white/40 rounded-sm" />
                  </div>
                </div>

                {/* Chat Header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent-pink" />
                  <div>
                    <div className="text-xs font-semibold text-white">Sarah Chen</div>
                    <div className="text-[10px] text-accent-emerald">Online</div>
                  </div>
                </div>

                {/* Chat Messages */}
                <div className="px-4 py-3 space-y-3 flex-1">
                  {/* Received */}
                  <div className="flex justify-start">
                    <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-bl-md bg-navy-lighter text-[11px] text-slate-200">
                      Hey! Have you tried CopyMe yet?
                    </div>
                  </div>

                  {/* Sent */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-br-md bg-gradient-to-r from-primary to-secondary text-[11px] text-white">
                      Just signed up! The Rule of 7 is genius
                    </div>
                  </div>

                  {/* Received */}
                  <div className="flex justify-start">
                    <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-bl-md bg-navy-lighter text-[11px] text-slate-200">
                      Right? Less noise, more connection
                    </div>
                  </div>

                  {/* Sent */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] px-3 py-2 rounded-2xl rounded-br-md bg-gradient-to-r from-secondary to-accent-pink text-[11px] text-white">
                      The AI features are incredible too
                    </div>
                  </div>

                  {/* Typing indicator */}
                  <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-2xl rounded-bl-md bg-navy-lighter flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce-subtle" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce-subtle" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce-subtle" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>

                {/* Input bar */}
                <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-white/10 bg-navy/80 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-8 rounded-full bg-navy-lighter border border-white/10 px-3 flex items-center">
                      <span className="text-[10px] text-slate-500">Type a message...</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                      <ArrowRight size={14} className="text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

    </section>
    <DemoModal open={showDemo} onClose={() => setShowDemo(false)} />
    </>
  );
}
