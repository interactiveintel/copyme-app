"use client";

// SmartReplyChips — three AI-generated reply chips above the chat composer
// (sprint S-207 / Tier C2). Hits POST /api/agents/yogi/smart-replies whenever
// a fresh inbound message arrives; degrades gracefully on error so the
// composer keeps working even if Yogi is down.

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface SmartReplyChipsProps {
  /** Most recent inbound (received) message text — null when none. */
  inboundMessage: string | null;
  /** Last few thread messages for context. The component itself slices to
   *  the most recent 7 (Rule of 7) before sending. */
  threadContext: string[];
  /** Suppress fetching + rendering. */
  disabled?: boolean;
  /** Called when the user taps a chip. The parent should drop the text into
   *  the composer; this component never auto-sends. */
  onPick: (reply: string) => void;
}

/**
 * Count whitespace-separated tokens. Short messages ("hi", "ok", "lol") don't
 * benefit from AI replies and burn tokens for no gain.
 */
function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function SmartReplyChips({
  inboundMessage,
  threadContext,
  disabled = false,
  onPick,
}: SmartReplyChipsProps) {
  const { authFetch } = useAuth();
  const [replies, setReplies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  // Track the last inbound message we fetched for so we don't re-hit the
  // endpoint when the parent re-renders with the same value.
  const lastFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip rules — keep this list mirrored with the render-side guards below.
    if (disabled) return;
    if (!inboundMessage) return;
    if (wordCount(inboundMessage) < 4) return;
    if (lastFetchedRef.current === inboundMessage) return;

    lastFetchedRef.current = inboundMessage;

    let cancelled = false;
    setLoading(true);
    setErrored(false);
    setReplies([]);

    (async () => {
      try {
        const res = await authFetch("/api/agents/yogi/smart-replies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inboundMessage,
            // Rule of 7 echoed on the client even though the server also
            // truncates — keeps the request payload small.
            threadContext: threadContext.slice(-7),
          }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setErrored(true);
          return;
        }
        const data = (await res.json()) as { replies?: unknown };
        if (cancelled) return;
        const arr = Array.isArray(data.replies)
          ? data.replies.filter((r): r is string => typeof r === "string" && r.trim().length > 0)
          : [];
        if (arr.length === 0) {
          setErrored(true);
          return;
        }
        setReplies(arr.slice(0, 3));
      } catch {
        if (!cancelled) setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inboundMessage, threadContext, disabled, authFetch]);

  // Hide entirely when there's nothing useful to show. The composer below
  // continues to work — that's the graceful-degradation contract.
  if (disabled) return null;
  if (!inboundMessage) return null;
  if (wordCount(inboundMessage) < 4) return null;
  if (errored) return null;
  if (!loading && replies.length === 0) return null;

  return (
    <div
      className="mb-2 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none"
      style={{ scrollbarWidth: "none" }}
      role="list"
      aria-label="Smart reply suggestions"
    >
      {loading
        ? [0, 1, 2].map((i) => (
            <div
              key={`skel-${i}`}
              className="h-7 w-32 shrink-0 animate-pulse rounded-full bg-slate-200"
              aria-hidden="true"
            />
          ))
        : replies.map((reply, i) => (
            <button
              key={`${reply}-${i}`}
              type="button"
              onClick={() => onPick(reply)}
              role="listitem"
              className="group inline-flex h-7 shrink-0 max-w-[16rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs text-slate-700 transition-all hover:border-transparent hover:bg-gradient-to-r hover:from-indigo-50 hover:via-purple-50 hover:to-pink-50 hover:text-slate-900 hover:shadow-sm active:scale-[0.98]"
              title={reply}
            >
              <Sparkles size={11} className="shrink-0 text-purple-500" />
              <span className="truncate">{reply}</span>
            </button>
          ))}
    </div>
  );
}
