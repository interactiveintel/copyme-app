"use client";

// ---------------------------------------------------------------------------
// YogiInboxScreen — top-level "Yogi" tab (Tier C1 / sprint S-201).
//
// A dedicated inbox-style chat surface for talking to Yogi, our AI companion.
// Distinct from the older AgentiAIScreen voice/video kitchen-sink — this one
// is text-only, follows the Rule of 7 (70 word cap), shows example prompt
// chips on first run, and gates first use behind a privacy consent modal.
//
// Reads the existing backend at POST /api/agents/yogi (auth required, cost-
// capped at $0.10/user/day in src/lib/yogi-cost.ts). When the cap is hit the
// API returns 429 with error.code="DAILY_LIMIT" — we surface that as a
// friendly banner instead of an error toast.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AppBrand from "./AppBrand";
import WordCounter from "../ui/WordCounter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONSENT_KEY = "copyme.yogi.consented";
const RULE_OF_7_MAX_WORDS = 70;

const EXAMPLE_PROMPTS: string[] = [
  "Help me reply to Sam",
  "Suggest a Friday plan",
  "What did I forget?",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YogiBubble {
  id: string;
  role: "user" | "yogi";
  content: string;
  createdAt: number;
}

type ConsentState = "loading" | "needs-prompt" | "declined" | "accepted";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Consent modal — first-run privacy gate. Matches InstallPrompt's visual
// language (rounded-2xl card, gradient icon tile, slate body copy) but is
// rendered as a centered modal instead of a bottom chip so the user has to
// make an explicit choice before anything is sent.
// ---------------------------------------------------------------------------

interface YogiConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

function YogiConsentModal({ onAccept, onDecline }: YogiConsentModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="yogi-consent-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Card */}
      <motion.div
        initial={{ y: 12, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 12, opacity: 0, scale: 0.97 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-slate-200 p-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shrink-0">
            <Sparkles size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="yogi-consent-title"
              className="text-base font-semibold text-slate-900"
            >
              Meet Yogi
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Yogi is an AI assistant. Your messages to Yogi are sent to our
              subprocessor (Anthropic) for processing. They&apos;re never used
              to train models. You can opt out anytime in Profile &rarr;
              Privacy.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-5">
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold py-2.5 hover:bg-slate-200 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white text-sm font-semibold py-2.5 shadow-md shadow-purple-500/20"
          >
            Continue
          </button>
        </div>

        <div className="flex items-center gap-1.5 mt-4 text-[10px] text-slate-400">
          <ShieldCheck size={11} />
          <span>End-to-end encrypted in transit. Stored only for context.</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function YogiInboxScreen() {
  const { user, authFetch } = useAuth();

  const [consent, setConsent] = useState<ConsentState>("loading");
  const [bubbles, setBubbles] = useState<YogiBubble[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [capHit, setCapHit] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scrollEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // -------------------------------------------------------------------------
  // Consent: read localStorage on mount. Stays in "loading" for a tick so we
  // never flash the modal for users who already accepted.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(CONSENT_KEY);
      if (stored === "1") {
        setConsent("accepted");
      } else {
        setConsent("needs-prompt");
      }
    } catch {
      // localStorage unavailable (private mode, SSR-only) — assume needs prompt
      setConsent("needs-prompt");
    }
  }, []);

  // Auto-scroll to newest bubble.
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, sending]);

  // -------------------------------------------------------------------------
  // Live word count (memoised to avoid recomputing on every keystroke render)
  // -------------------------------------------------------------------------
  const wordCount = useMemo(() => countWords(input), [input]);
  const overCap = wordCount > RULE_OF_7_MAX_WORDS;

  // -------------------------------------------------------------------------
  // Send to /api/agents/yogi. Uses authFetch so refresh-token rotation is
  // handled automatically. Surfaces DAILY_LIMIT 429s as the cost-cap banner
  // instead of a generic error.
  // -------------------------------------------------------------------------
  const sendMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || sending || capHit) return;
      if (countWords(text) > RULE_OF_7_MAX_WORDS) return;

      const userBubble: YogiBubble = {
        id: `u_${Date.now()}`,
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      setBubbles((prev) => [...prev, userBubble]);
      setInput("");
      setSending(true);
      setErrorMessage(null);

      try {
        const history = bubbles.slice(-10).map((b) => ({
          role: b.role === "yogi" ? "assistant" : "user",
          content: b.content,
        }));

        const res = await authFetch("/api/agents/yogi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            mode: "text",
            conversationHistory: history,
          }),
        });

        // Cost cap (429 with code DAILY_LIMIT) — show banner, don't add a bubble.
        if (res.status === 429) {
          let code: string | undefined;
          try {
            const data = await res.json();
            code = data?.error?.code;
          } catch {
            /* ignore parse errors */
          }
          if (code === "DAILY_LIMIT") {
            setCapHit(true);
            return;
          }
          setErrorMessage("Yogi's getting a lot of messages. Try again in a moment.");
          return;
        }

        if (!res.ok) {
          let message = "Yogi had a hiccup. Try again.";
          try {
            const data = await res.json();
            if (typeof data?.error?.message === "string") {
              message = data.error.message;
            }
          } catch {
            /* ignore */
          }
          setErrorMessage(message);
          return;
        }

        const data = await res.json();
        const replyText: string =
          (typeof data?.data?.response === "string" && data.data.response) ||
          "I'm here, but I didn't catch that. Try again?";

        const yogiBubble: YogiBubble = {
          id: `y_${Date.now()}`,
          role: "yogi",
          content: replyText,
          createdAt: Date.now(),
        };
        setBubbles((prev) => [...prev, yogiBubble]);
      } catch {
        setErrorMessage("Connection hiccup. Check your network and try again.");
      } finally {
        setSending(false);
      }
    },
    [authFetch, bubbles, capHit, sending],
  );

  // -------------------------------------------------------------------------
  // Consent handlers
  // -------------------------------------------------------------------------
  const handleAcceptConsent = useCallback(() => {
    try {
      window.localStorage.setItem(CONSENT_KEY, "1");
    } catch {
      /* ignore */
    }
    setConsent("accepted");
    // Focus input after the modal closes so the user can start typing.
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleDeclineConsent = useCallback(() => {
    setConsent("declined");
  }, []);

  const handleReconsider = useCallback(() => {
    setConsent("needs-prompt");
  }, []);

  // -------------------------------------------------------------------------
  // Send-button handlers
  // -------------------------------------------------------------------------
  const handleSendClick = () => {
    if (overCap || sending || capHit) return;
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleExampleClick = (prompt: string) => {
    if (sending || capHit) return;
    sendMessage(prompt);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Avoid flash: render nothing chrome-heavy while consent is still loading.
  // The screen still shows the header so it doesn't look broken.
  const empty = bubbles.length === 0;

  return (
    <div className="flex flex-col h-full bg-white pb-16">
      {/* Header */}
      <header className="relative z-10 px-4 pt-10 pb-3 bg-white/90 backdrop-blur-xl border-b border-slate-200">
        <AppBrand className="mb-2" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                Yogi
                <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 text-[9px] font-bold">
                  AI
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Your AI companion</p>
            </div>
          </div>
        </div>
      </header>

      {/* Cost-cap banner */}
      <AnimatePresence>
        {capHit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-amber-50 border-b border-amber-200 overflow-hidden"
          >
            <div className="px-4 py-2.5 text-[11px] text-amber-700 leading-relaxed">
              Yogi&apos;s taking a breather &mdash; daily limit reached. Resets
              at midnight UTC.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error banner (transient) */}
      <AnimatePresence>
        {errorMessage && !capHit && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-rose-50 border-b border-rose-200 overflow-hidden"
          >
            <div className="px-4 py-2.5 flex items-start gap-2">
              <p className="flex-1 text-[11px] text-rose-700 leading-relaxed">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Dismiss"
                className="text-rose-400 hover:text-rose-700 -mt-0.5"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main scrolling area */}
      <div className="flex-1 overflow-y-auto">
        {consent === "declined" ? (
          // Consent declined — prominent re-enable CTA. v4.15.9 (F5):
          // Joze Kralj reported "Yogi is not active" in his May 18
          // feedback. Root cause was this state — he likely tapped
          // Decline on first run and the previous "Review consent"
          // pill was too small/pale to find. Rebuilt with a primary
          // gradient CTA + clearer copy so the path back to active is
          // obvious.
          <div className="h-full flex flex-col items-center justify-center px-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center"
            >
              <Sparkles size={28} className="text-purple-500" />
            </motion.div>
            <h2 className="text-base font-bold text-slate-900 mt-4">
              Enable Yogi to chat
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-xs">
              Yogi is paused until you opt in. Your messages stay private —
              processed by Anthropic, never used for training.
            </p>
            <button
              type="button"
              onClick={handleReconsider}
              className="mt-6 px-6 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-md shadow-purple-500/30 hover:shadow-lg hover:shadow-purple-500/40 transition-shadow"
            >
              Enable Yogi
            </button>
            <p className="mt-3 text-[11px] text-slate-400">
              You can change your mind anytime in Profile &rarr; Privacy.
            </p>
          </div>
        ) : empty ? (
          // First-run hint + example prompt chips.
          <div className="px-4 py-8 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
            >
              <Sparkles size={28} className="text-white" />
            </motion.div>
            <h2 className="text-base font-bold text-slate-900 mt-4">
              Say hi to Yogi
            </h2>
            <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
              {user?.displayName
                ? `Hey ${user.displayName.split(" ")[0]} — `
                : ""}
              Yogi adapts to how you write. Try a starter, or just say
              what&apos;s on your mind.
            </p>

            <div className="flex flex-col items-stretch gap-2 mt-6 w-full max-w-xs">
              {EXAMPLE_PROMPTS.map((prompt, i) => (
                <motion.button
                  key={prompt}
                  type="button"
                  onClick={() => handleExampleClick(prompt)}
                  disabled={sending || capHit || consent !== "accepted"}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * (i + 1) }}
                  whileTap={{ scale: 0.98 }}
                  className="group relative flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-left text-xs font-medium text-slate-700 hover:border-purple-300 hover:bg-purple-50/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles size={13} className="text-purple-400 shrink-0" />
                  <span className="flex-1">{prompt}</span>
                </motion.button>
              ))}
            </div>
          </div>
        ) : (
          // Active thread.
          <div className="px-4 py-4 space-y-3">
            {bubbles.map((b, i) => {
              const showLabel =
                i === 0 || bubbles[i - 1]?.role !== b.role;
              const isUser = b.role === "user";
              return (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2`}
                >
                  <div
                    className={`max-w-[80%] ${isUser ? "items-end" : "items-start"}`}
                  >
                    {showLabel && (
                      <p
                        className={`text-[10px] font-semibold mb-1 ${
                          isUser
                            ? "text-right text-purple-400"
                            : "text-purple-500"
                        }`}
                      >
                        {isUser ? "You" : "Yogi"}
                      </p>
                    )}
                    <div
                      className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isUser
                          ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-br-md"
                          : "bg-slate-100 text-slate-800 rounded-bl-md"
                      }`}
                    >
                      {b.content}
                    </div>
                    <p
                      className={`text-[10px] text-slate-400 mt-0.5 ${
                        isUser ? "text-right" : ""
                      }`}
                    >
                      {formatTime(b.createdAt)}
                    </p>
                  </div>
                </motion.div>
              );
            })}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 rounded-bl-md">
                  <div className="flex gap-1">
                    <span
                      className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                      style={{ animationDelay: "0ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                      style={{ animationDelay: "150ms" }}
                    />
                    <span
                      className="w-2 h-2 rounded-full bg-purple-400 animate-bounce"
                      style={{ animationDelay: "300ms" }}
                    />
                  </div>
                  <span className="text-xs text-slate-400">
                    Yogi is thinking...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={scrollEndRef} />
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 pt-3 bg-white/95 backdrop-blur-xl border-t border-slate-200">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending || capHit || consent !== "accepted"}
              placeholder={
                consent === "declined"
                  ? "Yogi is paused"
                  : capHit
                    ? "Daily limit reached — resets at midnight UTC"
                    : "Ask Yogi anything..."
              }
              rows={1}
              aria-label="Message Yogi"
              className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 pr-2 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-purple-500/40 resize-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            />
          </div>

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={handleSendClick}
            disabled={
              !input.trim() ||
              sending ||
              capHit ||
              overCap ||
              consent !== "accepted"
            }
            aria-label="Send message"
            className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:shadow-none"
          >
            <Send size={17} className="text-white -rotate-45 ml-0.5" />
          </motion.button>
        </div>

        {/* Word counter / Rule of 7 */}
        <div className="flex items-center justify-between mt-2 px-1">
          <span className="text-[10px] text-slate-400">
            {overCap ? (
              <span className="text-rose-500 font-semibold">
                Over the Rule of 7 cap
              </span>
            ) : (
              <>Enter to send</>
            )}
          </span>
          <WordCounter text={input} maxWords={RULE_OF_7_MAX_WORDS} />
        </div>
      </div>

      {/* Consent modal — first-run only. AnimatePresence handles enter/exit. */}
      <AnimatePresence>
        {consent === "needs-prompt" && (
          <YogiConsentModal
            onAccept={handleAcceptConsent}
            onDecline={handleDeclineConsent}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
