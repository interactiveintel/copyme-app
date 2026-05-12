"use client";

// ---------------------------------------------------------------------------
// /business/surveys/create — survey builder (Tier C5, S-221).
//
// Caps mirror the API:
//   - title ≤ 120 chars
//   - description ≤ 500 chars
//   - up to 7 questions, each with prompt ≤ 200 chars
//   - up to 7 options per single/multi question
//   - up to 7 target-interest tags
//
// On submit POSTs to /api/surveys with the bearer token from
// localStorage `copyme.access`, then routes back to /business/surveys.
// Server-side error codes (TOO_MANY_QUESTIONS, TOO_MANY_TAGS, BAD_BODY)
// are surfaced inline.
// ---------------------------------------------------------------------------

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X, ArrowLeft, ListChecks } from "lucide-react";

const MAX_QUESTIONS = 7;
const MAX_OPTIONS = 7;
const MAX_TAGS = 7;
const TITLE_MAX = 120;
const DESCRIPTION_MAX = 500;
const PROMPT_MAX = 200;

type QType = "single" | "multi" | "text";

interface QDraft {
  // `key` is local-only — used for React's reconciliation across reorders.
  // The id we send to the server is generated at submit time.
  key: string;
  prompt: string;
  type: QType;
  options: string[];
}

function newKey(): string {
  // Browser-only path; this page is "use client" so crypto.randomUUID exists.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `q_${Math.random().toString(36).slice(2)}`;
}

function freshQuestion(): QDraft {
  return { key: newKey(), prompt: "", type: "single", options: ["", ""] };
}

const ERROR_LABEL: Record<string, string> = {
  TOO_MANY_QUESTIONS: "Too many questions — limit is 7.",
  TOO_MANY_TAGS: "Too many target interests — limit is 7.",
  BAD_BODY: "Some required fields are missing or malformed.",
  UNAUTH: "You're signed out — refresh and sign in again.",
};

export default function CreateSurveyPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QDraft[]>([freshQuestion()]);
  const [tagsRaw, setTagsRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targetInterests = useMemo(
    () =>
      tagsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, MAX_TAGS),
    [tagsRaw],
  );

  const canAddQuestion = questions.length < MAX_QUESTIONS;

  function addQuestion() {
    if (!canAddQuestion) return;
    setQuestions((prev) => [...prev, freshQuestion()]);
  }

  function removeQuestion(key: string) {
    setQuestions((prev) =>
      prev.length > 1 ? prev.filter((q) => q.key !== key) : prev,
    );
  }

  function updateQuestion(key: string, patch: Partial<QDraft>) {
    setQuestions((prev) =>
      prev.map((q) => (q.key === key ? { ...q, ...patch } : q)),
    );
  }

  function addOption(key: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key && q.options.length < MAX_OPTIONS
          ? { ...q, options: [...q.options, ""] }
          : q,
      ),
    );
  }

  function removeOption(key: string, idx: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? {
              ...q,
              options:
                q.options.length > 1
                  ? q.options.filter((_, i) => i !== idx)
                  : q.options,
            }
          : q,
      ),
    );
  }

  function updateOption(key: string, idx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.key === key
          ? { ...q, options: q.options.map((o, i) => (i === idx ? value : o)) }
          : q,
      ),
    );
  }

  // Quick client-side validation. Mirrors what the server checks but
  // surfaces problems immediately so we never make a doomed request.
  function validate(): string | null {
    if (!title.trim()) return "Add a title.";
    if (title.length > TITLE_MAX) return `Title must be ≤ ${TITLE_MAX} chars.`;
    if (description.length > DESCRIPTION_MAX)
      return `Description must be ≤ ${DESCRIPTION_MAX} chars.`;
    if (questions.length === 0) return "Add at least one question.";
    if (questions.length > MAX_QUESTIONS)
      return `Too many questions — limit is ${MAX_QUESTIONS}.`;
    for (const q of questions) {
      if (!q.prompt.trim()) return "Every question needs a prompt.";
      if (q.prompt.length > PROMPT_MAX)
        return `Question prompts must be ≤ ${PROMPT_MAX} chars.`;
      if (q.type !== "text") {
        const opts = q.options.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2)
          return `"${q.prompt.slice(0, 30)}…" needs at least 2 options.`;
        if (opts.length > MAX_OPTIONS)
          return `"${q.prompt.slice(0, 30)}…" has too many options (limit ${MAX_OPTIONS}).`;
      }
    }
    if (targetInterests.length > MAX_TAGS)
      return `Too many target interests — limit is ${MAX_TAGS}.`;
    return null;
  }

  async function submit() {
    setError(null);
    const err = validate();
    if (err) {
      setError(err);
      return;
    }

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("copyme.access")
        : null;
    if (!token) {
      setError("Not signed in.");
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      questions: questions.map((q) => ({
        id: q.key,
        prompt: q.prompt.trim(),
        type: q.type,
        options:
          q.type === "text"
            ? undefined
            : q.options.map((o) => o.trim()).filter(Boolean),
      })),
      targetInterests,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = (data?.error as string | undefined) ?? "";
        setError(ERROR_LABEL[code] ?? `Couldn't create survey (${res.status}).`);
        return;
      }
      router.push("/business/surveys");
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        {/* Header */}
        <Link
          href="/business/surveys"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 text-xs font-medium mb-3"
        >
          <ArrowLeft size={12} /> Back to surveys
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <ListChecks size={18} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">New survey</h1>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          Up to 7 questions, 7 target interests. Recipients see your survey in
          their inbox; results unlock at 7 responses for k-anonymity.
        </p>

        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Top-level fields */}
        <div className="space-y-4 mb-6">
          <Field
            label="Title"
            value={title}
            onChange={setTitle}
            maxLength={TITLE_MAX}
            placeholder="What should we build next?"
            required
          />
          <FieldArea
            label="Description (optional)"
            value={description}
            onChange={setDescription}
            maxLength={DESCRIPTION_MAX}
            placeholder="One short paragraph of context for respondents."
          />
        </div>

        {/* Questions */}
        <div className="space-y-3 mb-6">
          {questions.map((q, idx) => (
            <QuestionEditor
              key={q.key}
              index={idx}
              total={questions.length}
              question={q}
              onChange={(patch) => updateQuestion(q.key, patch)}
              onRemove={() => removeQuestion(q.key)}
              onAddOption={() => addOption(q.key)}
              onRemoveOption={(i) => removeOption(q.key, i)}
              onChangeOption={(i, v) => updateOption(q.key, i, v)}
            />
          ))}

          <button
            type="button"
            onClick={addQuestion}
            disabled={!canAddQuestion}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-slate-300 text-sm font-medium text-slate-600 hover:border-purple-400 hover:text-purple-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            {canAddQuestion
              ? "Add question"
              : `Maximum ${MAX_QUESTIONS} questions reached`}
          </button>
        </div>

        {/* Target interests */}
        <div className="mb-8">
          <Field
            label={`Target interests (comma-separated, up to ${MAX_TAGS})`}
            value={tagsRaw}
            onChange={setTagsRaw}
            placeholder="ai, photography, coffee"
          />
          {targetInterests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {targetInterests.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-200"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-slate-400">
            Leave empty to surface to everyone with matching interests later.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <Link
            href="/business/surveys"
            className="px-4 py-2 rounded-full text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create survey"}
          </button>
        </div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuestionEditor({
  index,
  total,
  question,
  onChange,
  onRemove,
  onAddOption,
  onRemoveOption,
  onChangeOption,
}: {
  index: number;
  total: number;
  question: QDraft;
  onChange: (patch: Partial<QDraft>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onRemoveOption: (idx: number) => void;
  onChangeOption: (idx: number, value: string) => void;
}) {
  const showOptions = question.type !== "text";
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Question {index + 1}
        </span>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="text-[11px] text-slate-400 hover:text-rose-600 inline-flex items-center gap-1"
          >
            <X size={11} /> Remove
          </button>
        )}
      </div>

      <Field
        label="Prompt"
        value={question.prompt}
        onChange={(v) => onChange({ prompt: v })}
        maxLength={PROMPT_MAX}
        placeholder="What do you want to ask?"
        required
      />

      <div className="mt-3">
        <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
          Type
        </label>
        <div className="inline-flex p-1 rounded-full bg-slate-100">
          {(["single", "multi", "text"] as QType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ type: t })}
              className={`px-3 py-1 rounded-full text-[11px] font-semibold capitalize ${
                question.type === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t === "single"
                ? "Single choice"
                : t === "multi"
                ? "Multi choice"
                : "Free text"}
            </button>
          ))}
        </div>
      </div>

      {showOptions && (
        <div className="mt-4">
          <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
            Options ({question.options.length}/{MAX_OPTIONS})
          </label>
          <div className="space-y-2">
            {question.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => onChangeOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
                />
                {question.options.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveOption(i)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                    aria-label={`Remove option ${i + 1}`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {question.options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={onAddOption}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:text-purple-700"
              >
                <Plus size={11} /> Add option
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {maxLength && (
          <span className="text-slate-400">
            {value.length}/{maxLength}
          </span>
        )}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
      />
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {maxLength && (
          <span className="text-slate-400">
            {value.length}/{maxLength}
          </span>
        )}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 resize-none"
      />
    </div>
  );
}
