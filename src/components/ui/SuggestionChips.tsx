"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  loading?: boolean;
}

export default function SuggestionChips({
  suggestions,
  onSelect,
  loading = false,
}: SuggestionChipsProps) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="shrink-0 h-9 rounded-full bg-white/5 animate-pulse"
            style={{ width: `${80 + i * 20}px` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
      {suggestions.map((suggestion, i) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 400, damping: 30 }}
          onClick={() => onSelect(suggestion)}
          className="group shrink-0 relative flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white/[0.06] backdrop-blur-xl border border-white/10 text-xs text-white/70 font-medium hover:text-white transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {/* Gradient border on hover */}
          <div className="absolute inset-0 rounded-full p-[1px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-full h-full rounded-full bg-[#0F172A]/90" />
          </div>
          <Sparkles size={11} className="relative text-purple-400 shrink-0" />
          <span className="relative whitespace-nowrap">{suggestion}</span>
        </motion.button>
      ))}
    </div>
  );
}
