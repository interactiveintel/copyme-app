"use client";

import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ArrowRight, Mic, Plus, Smile } from "lucide-react";
import { LIMITS } from "@/lib/ruleOf7";

// ---------------------------------------------------------------------------
// Composer — sticky message input with live word counter (S-112 + S-123).
//
// Counter rules (matching the hero PhonePreview mock):
//   amber at 60+, red at 70, hard-stop at 70 — the textarea silently
//   prevents typing more once the cap is reached. Pasting more than 70 is
//   trimmed to 70 with a one-time toast (S-123 AC).
//
// `wordCount` matches the server-side algorithm in `lib/ruleOf7.ts`:
//   `text.trim().split(/\s+/).filter(Boolean).length`.
// Emojis count as 1 word; URLs count as 1.
// ---------------------------------------------------------------------------

const MAX_WORDS = LIMITS.BASIC.maxMessageWords;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface ComposerProps {
  onSend: (text: string) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  /** Override word cap (used by Pro tier — S-241). */
  maxWords?: number;
}

export default function Composer({
  onSend,
  disabled,
  placeholder = "Type a message…",
  maxWords = MAX_WORDS,
}: ComposerProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [trimToast, setTrimToast] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const words = useMemo(() => countWords(text), [text]);
  const tone = words >= maxWords ? "red" : words >= maxWords - 10 ? "amber" : "neutral";

  const trimToWords = useCallback(
    (s: string) => {
      const tokens = s.split(/(\s+)/);
      let count = 0;
      const out: string[] = [];
      for (const tok of tokens) {
        if (/^\s+$/.test(tok)) {
          out.push(tok);
          continue;
        }
        if (tok.length === 0) continue;
        if (count >= maxWords) break;
        out.push(tok);
        count++;
      }
      return out.join("").trimEnd();
    },
    [maxWords],
  );

  const handleChange = (next: string) => {
    if (countWords(next) > maxWords) {
      setText(trimToWords(next));
      setTrimToast(true);
      window.setTimeout(() => setTrimToast(false), 2500);
    } else {
      setText(next);
    }
  };

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = `${Math.min(taRef.current.scrollHeight, 160)}px`;
    }
  }, [text]);

  const send = async () => {
    if (busy || disabled || words === 0 || words > maxWords) return;
    setBusy(true);
    try {
      await onSend(text);
      setText("");
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  return (
    <div className="bg-white border-t border-slate-100">
      {/* Word counter row */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="text-[11px] text-slate-400">
          {disabled ? "Conversation read-only" : "Press Enter to send"}
        </div>
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            tone === "red"
              ? "text-rose-600"
              : tone === "amber"
              ? "text-amber-600"
              : "text-slate-400"
          }`}
          aria-live="polite"
        >
          {words} / {maxWords} words
        </span>
      </div>

      <div className="flex items-end gap-2 px-3 pb-3">
        <button
          type="button"
          aria-label="Add attachment"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
        >
          <Plus size={16} />
        </button>
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
          <textarea
            ref={taRef}
            value={text}
            placeholder={placeholder}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={onKey}
            disabled={disabled || busy}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          {trimToast && (
            <div className="text-[11px] text-amber-600 mt-1">
              Trimmed to {maxWords} words to fit the Rule of 7.
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Voice clip"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
        >
          <Mic size={16} />
        </button>
        <button
          type="button"
          aria-label="Emoji"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"
        >
          <Smile size={16} />
        </button>
        <button
          type="button"
          onClick={send}
          disabled={busy || disabled || words === 0}
          aria-label="Send"
          className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center shadow-md shadow-primary/30 disabled:opacity-50"
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
