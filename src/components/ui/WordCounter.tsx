"use client";

import { motion, AnimatePresence } from "framer-motion";

interface WordCounterProps {
  text: string;
  maxWords?: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export default function WordCounter({ text, maxWords = 70 }: WordCounterProps) {
  const count = countWords(text);
  const ratio = count / maxWords;

  let colorClass = "text-slate-500";
  if (ratio > 0.93) {
    colorClass = "text-red-400 font-bold";
  } else if (ratio > 0.71) {
    colorClass = "text-amber-400";
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={count}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        className={`text-xs tabular-nums transition-colors duration-200 ${colorClass}`}
      >
        {count}/{maxWords} words
      </motion.span>
    </AnimatePresence>
  );
}
