"use client";

// ---------------------------------------------------------------------------
// SurveyInboxCard — recipient view of a single survey (Tier C5, S-222).
//
// Designed to be inserted into the inbox feed. The card is self-contained:
// it owns answer-draft state, validation, and the post-submit collapsed
// "thanks" pill (which auto-dismisses after ~5s).
//
// Submission is delegated to `onSubmit` so the parent can plug it into
// whatever auth/idempotency wrapper it owns. The parent is also responsible
// for refreshing its data after onSubmit resolves so the card disappears
// from the feed (the local "thanks" pill is just a smooth handoff while
// the parent refetches).
// ---------------------------------------------------------------------------

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ClipboardList, Check, X } from "lucide-react";

export interface SurveyCardQuestion {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
}

export interface SurveyCardSurvey {
  id: string;
  title: string;
  description?: string | null;
  questions: SurveyCardQuestion[];
}

export interface SurveyInboxCardProps {
  survey: SurveyCardSurvey;
  onSubmit: (answers: Record<string, string | string[]>) => Promise<void>;
  onSkip?: () => void;
}

const TEXT_MAX = 200;
const THANKS_DISPLAY_MS = 5_000;

export default function SurveyInboxCard({
  survey,
  onSubmit,
  onSkip,
}: SurveyInboxCardProps) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Two-phase post-submit: show the "thanks" pill briefly, then unmount.
  const [thanks, setThanks] = useState(false);
  const [hidden, setHidden] = useState(false);

  // After thanks appears, auto-hide so the parent can re-render without us.
  useEffect(() => {
    if (!thanks) return;
    const t = window.setTimeout(() => setHidden(true), THANKS_DISPLAY_MS);
    return () => window.clearTimeout(t);
  }, [thanks]);

  function setSingle(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }

  function toggleMulti(qid: string, value: string) {
    setAnswers((prev) => {
      const cur = prev[qid];
      const list = Array.isArray(cur) ? cur : [];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [qid]: next };
    });
  }

  function setText(qid: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qid]: value.slice(0, TEXT_MAX) }));
  }

  function validate(): string | null {
    for (const q of survey.questions) {
      const a = answers[q.id];
      if (q.type === "single" && !a) return `Pick an answer for "${q.prompt}".`;
      if (q.type === "multi" && (!Array.isArray(a) || a.length === 0))
        return `Pick at least one option for "${q.prompt}".`;
      if (q.type === "text" && (!a || (typeof a === "string" && !a.trim())))
        return `Answer "${q.prompt}".`;
    }
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(answers);
      setThanks(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't submit.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSkip() {
    if (onSkip) {
      onSkip();
    } else {
      // No parent handler — collapse locally so the user can dismiss it.
      setHidden(true);
    }
  }

  if (hidden) return null;

  return (
    <AnimatePresence mode="wait">
      {thanks ? (
        <motion.div
          key="thanks"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, height: 0, marginBottom: 0 }}
          className="mx-4 mb-3 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 inline-flex items-center gap-2 self-start"
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check size={12} className="text-white" />
          </div>
          <p className="text-xs font-medium text-emerald-700">
            Thanks for participating
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="card"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="mx-4 mb-3 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden flex"
        >
          {/* Gradient accent stripe */}
          <div className="w-1.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500 shrink-0" />

          <div className="flex-1 min-w-0 p-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <ClipboardList size={14} className="text-purple-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-purple-600">
                    Survey
                  </p>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {survey.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSkip}
                aria-label="Skip survey"
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 shrink-0"
              >
                <X size={12} />
              </button>
            </div>

            {survey.description && (
              <p className="text-xs text-slate-500 leading-relaxed mb-4">
                {survey.description}
              </p>
            )}

            {/* Questions */}
            <div className="space-y-4">
              {survey.questions.map((q, idx) => (
                <div key={q.id}>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Q{idx + 1}
                  </p>
                  <p className="text-sm text-slate-900 mb-2">{q.prompt}</p>

                  {q.type === "single" && Array.isArray(q.options) && (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => {
                        const checked = answers[q.id] === opt;
                        return (
                          <label
                            key={opt}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                              checked
                                ? "bg-purple-50 border-purple-300"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q_${q.id}`}
                              checked={checked}
                              onChange={() => setSingle(q.id, opt)}
                              className="w-3.5 h-3.5 accent-purple-600"
                            />
                            <span className="text-xs text-slate-700">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "multi" && Array.isArray(q.options) && (
                    <div className="space-y-1.5">
                      {q.options.map((opt) => {
                        const list = Array.isArray(answers[q.id])
                          ? (answers[q.id] as string[])
                          : [];
                        const checked = list.includes(opt);
                        return (
                          <label
                            key={opt}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                              checked
                                ? "bg-purple-50 border-purple-300"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMulti(q.id, opt)}
                              className="w-3.5 h-3.5 accent-purple-600"
                            />
                            <span className="text-xs text-slate-700">{opt}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {q.type === "text" && (
                    <div>
                      <textarea
                        value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                        onChange={(e) => setText(q.id, e.target.value)}
                        maxLength={TEXT_MAX}
                        rows={2}
                        placeholder="Type your answer…"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 resize-none"
                      />
                      <p className="mt-0.5 text-[10px] text-slate-400 text-right">
                        {(typeof answers[q.id] === "string" ? (answers[q.id] as string).length : 0)}
                        /{TEXT_MAX}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleSkip}
                disabled={submitting}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-4 py-1.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
