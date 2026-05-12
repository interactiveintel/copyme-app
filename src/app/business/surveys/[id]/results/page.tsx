"use client";

// ---------------------------------------------------------------------------
// /business/surveys/[id]/results — aggregated results dashboard (Tier C5, S-223).
//
// Calls GET /api/surveys/:id/results. Two response shapes:
//   - { pending: true, have, needed, message }   → pre-k7 gate card
//   - { total, tallies }                         → render bar charts
//
// Survey question metadata comes from GET /api/surveys (the caller's list)
// since the results endpoint only returns tallies, not the prompts.
// We resolve `id` from the route params; bad uuids fall through to a clean
// "not found" card instead of a server error.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  BarChart3,
  AlertCircle,
} from "lucide-react";

interface QuestionMeta {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
}

interface SurveyMeta {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionMeta[];
  status: string;
}

interface PendingShape {
  pending: true;
  have: number;
  needed: number;
  message: string;
}

interface ResultsShape {
  total: number;
  tallies: Record<string, Record<string, number>>;
}

type ApiShape =
  | PendingShape
  | ResultsShape
  | { error: string };

function authHeaders(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("copyme.access");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function isPending(x: ApiShape): x is PendingShape {
  return (x as PendingShape).pending === true;
}
function isResults(x: ApiShape): x is ResultsShape {
  return typeof (x as ResultsShape).total === "number";
}

export default function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 15 wraps route params in a promise — `use()` unwraps it on the client.
  const { id } = use(params);

  const [survey, setSurvey] = useState<SurveyMeta | null>(null);
  const [data, setData] = useState<ApiShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }
    try {
      // Fetch the results AND the survey metadata (for question prompts).
      // The results endpoint returns tallies keyed by question id only.
      const [resultsRes, listRes] = await Promise.all([
        fetch(`/api/surveys/${encodeURIComponent(id)}/results`, { headers }),
        fetch("/api/surveys", { headers }),
      ]);

      // 404 from the results endpoint means: bad id, deleted, or not yours.
      // Surface a graceful "not found" state rather than dumping an error.
      if (resultsRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (resultsRes.status === 401 || listRes.status === 401) {
        setError("Not signed in.");
        return;
      }
      if (!resultsRes.ok) {
        const body = await resultsRes.json().catch(() => ({}));
        if (body?.error === "NOT_FOUND") {
          setNotFound(true);
          return;
        }
        throw new Error(`results HTTP ${resultsRes.status}`);
      }

      const resultsBody = (await resultsRes.json()) as ApiShape;
      setData(resultsBody);

      if (listRes.ok) {
        const listBody = (await listRes.json()) as { surveys: SurveyMeta[] };
        const found = (listBody.surveys ?? []).find((s) => s.id === id);
        if (found) {
          setSurvey({
            ...found,
            questions: Array.isArray(found.questions) ? found.questions : [],
          });
        }
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {/* Header */}
        <Link
          href="/business/surveys"
          className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-700 text-xs font-medium mb-3"
        >
          <ArrowLeft size={12} /> Back to surveys
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
            <BarChart3 size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 truncate">
              {survey?.title ?? "Results"}
            </h1>
            {data && isResults(data) && (
              <p className="text-xs text-slate-500 mt-0.5">
                Total responses: <strong className="text-slate-700">{data.total}</strong>
              </p>
            )}
          </div>
        </div>

        {survey?.description && (
          <p className="text-sm text-slate-500 mb-6">{survey.description}</p>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {notFound && <NotFoundCard />}

        {!notFound && !data && !error && (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!notFound && data && isPending(data) && (
          <PendingCard pending={data} />
        )}

        {!notFound && data && isResults(data) && (
          <div className="space-y-4">
            {survey ? (
              survey.questions.map((q) => (
                <QuestionResults
                  key={q.id}
                  question={q}
                  total={data.total}
                  tally={data.tallies[q.id] ?? {}}
                />
              ))
            ) : (
              // No survey metadata — fall back to raw tallies so we still
              // render something useful (e.g. survey list call failed).
              Object.entries(data.tallies).map(([qid, tally]) => (
                <QuestionResults
                  key={qid}
                  question={{ id: qid, prompt: qid, type: "single" }}
                  total={data.total}
                  tally={tally}
                />
              ))
            )}
            {Object.keys(data.tallies).length === 0 && (
              <div className="py-12 px-6 rounded-3xl bg-white border border-slate-200 text-center">
                <p className="text-sm text-slate-500">
                  Responses received, but no answers were recorded yet.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NotFoundCard() {
  return (
    <div className="py-12 px-6 rounded-3xl bg-white border border-slate-200 text-center">
      <div className="w-12 h-12 rounded-2xl bg-rose-100 mx-auto flex items-center justify-center mb-3">
        <AlertCircle size={20} className="text-rose-600" />
      </div>
      <p className="text-sm font-semibold text-slate-900">Survey not found</p>
      <p className="text-xs text-slate-500 mt-1">
        The survey may have been deleted, or this id doesn&apos;t belong to your
        account.
      </p>
      <Link
        href="/business/surveys"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
      >
        Back to surveys
      </Link>
    </div>
  );
}

function PendingCard({ pending }: { pending: PendingShape }) {
  const remaining = Math.max(0, pending.needed - pending.have);
  return (
    <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center shrink-0">
          <ShieldCheck size={20} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-900">
            {remaining === 0
              ? "Ready to unlock"
              : `Need ${remaining} more ${remaining === 1 ? "response" : "responses"} to unlock results`}
          </h2>
          <p className="mt-1 text-sm text-slate-500 leading-relaxed">
            {pending.message}
          </p>

          {/* Progress bar — pending.have / pending.needed */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>Progress</span>
              <span className="font-semibold text-slate-700 tabular-nums">
                {pending.have} / {pending.needed}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all"
                style={{
                  width: `${Math.min(100, (pending.have / Math.max(1, pending.needed)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionResults({
  question,
  total,
  tally,
}: {
  question: QuestionMeta;
  total: number;
  tally: Record<string, number>;
}) {
  // Sort options by count desc so the strongest signal sits up top.
  // For single/multi we anchor to the canonical option list when present
  // so zero-vote options still appear (it's load-bearing data).
  const knownOptions = Array.isArray(question.options)
    ? question.options
    : null;
  const entries: Array<[string, number]> = knownOptions
    ? knownOptions.map((opt) => [opt, tally[opt] ?? 0])
    : Object.entries(tally);
  entries.sort((a, b) => b[1] - a[1]);

  // For multi questions the `total` is responses, not answers — the sum of
  // counts can exceed total. Use the larger of the two as the bar denominator
  // so widths stay sensible.
  const sumCounts = entries.reduce((acc, [, n]) => acc + n, 0);
  const denom = Math.max(1, total, sumCounts);

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="text-sm font-semibold text-slate-900">{question.prompt}</p>
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 capitalize">
          {question.type}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">No responses for this question.</p>
      ) : question.type === "text" ? (
        // Free-text answers: show frequency table since we don't render every
        // raw quote (PII risk + screen real estate). Identical strings cluster.
        <div className="space-y-2">
          {entries.slice(0, 10).map(([value, count]) => (
            <div
              key={value}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="text-slate-700 truncate">{value}</span>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-semibold tabular-nums">
                {count}
              </span>
            </div>
          ))}
          {entries.length > 10 && (
            <p className="text-[11px] text-slate-400 mt-2">
              + {entries.length - 10} more unique answers
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(([option, count]) => {
            const pct = (count / denom) * 100;
            const pctLabel = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={option}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-slate-700 truncate">{option}</span>
                  <span className="shrink-0 text-slate-500 tabular-nums">
                    {count} · {pctLabel}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
