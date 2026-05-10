"use client";

import { CornerDownRight, X } from "lucide-react";

// Reply quote (S-127). No "forward" — the platform deliberately omits
// forward chains as a Rule-of-7 hygiene choice.

export interface QuotedReplyProps {
  /** When set, render the active "you're replying to …" banner above composer. */
  active?: { id: string; from: string; preview: string };
  onClear?: () => void;
}

export function QuotedReplyBanner({ active, onClear }: QuotedReplyProps) {
  if (!active) return null;
  return (
    <div className="mx-3 mt-2 mb-1 rounded-xl border-l-4 border-primary bg-purple-50/80 px-3 py-2 flex items-start gap-2">
      <CornerDownRight size={14} className="text-primary mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-primary">
          Replying to {active.from}
        </div>
        <div className="text-xs text-slate-600 truncate">{active.preview}</div>
      </div>
      <button
        type="button"
        onClick={onClear}
        aria-label="Cancel reply"
        className="text-slate-400 hover:text-slate-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

/** Quoted snippet rendered inside a bubble. Tapping scrolls to the original. */
export function QuotedSnippet({
  from,
  preview,
  onJump,
}: {
  from: string;
  preview: string;
  onJump?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="block w-full text-left rounded-lg border-l-2 border-white/60 bg-white/15 px-2 py-1 mb-1 hover:bg-white/25"
    >
      <div className="text-[10px] font-semibold opacity-80">{from}</div>
      <div className="text-[11px] line-clamp-2 opacity-90">{preview}</div>
    </button>
  );
}
