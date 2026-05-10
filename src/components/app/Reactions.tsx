"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// 7 emoji palette (S-126). Honors the constraint principle by limiting the
// reaction set to seven options instead of an open-ended emoji picker.
export const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "💜"] as const;

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionsProps {
  /** Existing reactions to render below the bubble. */
  current: ReactionEmoji[];
  /** Fired when the user picks a reaction (or removes their own). */
  onPick: (emoji: ReactionEmoji) => void;
  align?: "left" | "right";
}

export default function Reactions({ current, onPick, align = "right" }: ReactionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative inline-flex items-center ${align === "right" ? "justify-end" : "justify-start"}`}>
      {current.length > 0 && (
        <div
          className="px-1.5 py-0.5 rounded-full bg-white border border-slate-200 shadow-sm text-[12px] leading-none"
          aria-label="Existing reactions"
        >
          {current.join(" ")}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="React"
        aria-haspopup="true"
        className="ml-1 w-6 h-6 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 inline-flex items-center justify-center text-[12px]"
      >
        +
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            role="menu"
            className="absolute bottom-full mb-2 right-0 px-2 py-1 rounded-full bg-white border border-slate-200 shadow-lg flex items-center gap-1"
          >
            {REACTION_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(e);
                  setOpen(false);
                }}
                className="text-lg w-7 h-7 rounded-full hover:bg-slate-100 inline-flex items-center justify-center"
                aria-label={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
