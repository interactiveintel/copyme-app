"use client";

import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface AIBadgeProps {
  variant?: "inline" | "floating";
  className?: string;
  label?: string;
}

export default function AIBadge({
  variant = "inline",
  className = "",
  label = "AI",
}: AIBadgeProps) {
  if (variant === "floating") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`absolute top-2 right-2 z-10 ${className}`}
      >
        <div className="relative">
          {/* Pulsing glow */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-30 blur-md animate-pulse-glow" />
          <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
            <Sparkles size={12} className="text-white" />
            <span className="text-[11px] font-bold text-white tracking-wide">
              {label}
            </span>
            {/* Shimmer overlay */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // inline variant
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      {/* Shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-shimmer" />
      <Sparkles size={10} className="relative text-white" />
      <span className="relative text-white">{label}</span>
      {/* Subtle pulsing glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-20 blur-sm animate-pulse-glow" />
    </motion.span>
  );
}
