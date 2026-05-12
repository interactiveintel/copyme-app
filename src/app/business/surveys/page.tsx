"use client";

// ---------------------------------------------------------------------------
// /business/surveys — list of the caller's surveys (Tier C5).
//
// Auth pattern: localStorage `copyme.access` bearer token, mirroring
// /admin/ruleof7 + /admin/moderation. Calls GET /api/surveys.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardList, BarChart3, Clock, CheckCircle2 } from "lucide-react";

interface QuestionShape {
  id: string;
  prompt: string;
  type: "single" | "multi" | "text";
  options?: string[];
}

interface SurveyRow {
  id: string;
  title: string;
  description: string | null;
  questions: QuestionShape[];
  targetInterests: string[] | null;
  status: string;
  createdAt: string;
}

function authHeaders(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("copyme.access");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
        isActive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-slate-50 text-slate-600 border-slate-200"
      }`}
    >
      {isActive ? <CheckCircle2 size={10} /> : <Clock size={10} />}
      {status}
    </span>
  );
}

export default function BusinessSurveysListPage() {
  const [surveys, setSurveys] = useState<SurveyRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setError("Not signed in.");
      setSurveys([]);
      return;
    }
    try {
      const res = await fetch("/api/surveys", { headers });
      if (res.status === 401) {
        setError("Not signed in.");
        setSurveys([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { surveys: SurveyRow[] };
      // Coerce Json fields to typed shapes — Prisma returns them as
      // `JsonValue` so the cast happens at the network seam, once.
      setSurveys(
        (data.surveys ?? []).map((s) => ({
          ...s,
          questions: Array.isArray(s.questions) ? s.questions : [],
          targetInterests: Array.isArray(s.targetInterests) ? s.targetInterests : null,
        })),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/business"
              className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-700 text-xs font-medium mb-2"
            >
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Your surveys</h1>
            <p className="text-xs text-slate-500 mt-1">
              Ask up to 7 questions per survey. Results unlock at 7 responses
              (k-anonymity).
            </p>
          </div>
          <Link
            href="/business/surveys/create"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          >
            <Plus size={14} /> New survey
          </Link>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* List */}
        <div className="space-y-3">
          {surveys === null && !error && (
            <div className="py-16 flex justify-center">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {surveys !== null && surveys.length === 0 && !error && (
            <div className="py-12 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 mx-auto flex items-center justify-center mb-3">
                <ClipboardList size={20} className="text-purple-600" />
              </div>
              <p className="text-sm font-semibold text-slate-900">
                No surveys yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Create your first survey — ask up to 7 questions, target up to 7
                interests, take about a minute.
              </p>
              <Link
                href="/business/surveys/create"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
              >
                <Plus size={14} /> Create your first survey
              </Link>
            </div>
          )}

          {surveys?.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {s.title}
                    </p>
                    <StatusBadge status={s.status} />
                  </div>
                  {s.description && (
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                      {s.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                    <span>
                      {s.questions.length}{" "}
                      {s.questions.length === 1 ? "question" : "questions"}
                    </span>
                    {/* Response count — shown after we hit results.
                        Backend gates total count at k=7 anyway, so a placeholder
                        here is honest. */}
                    <span className="text-slate-400">— responses</span>
                    {s.targetInterests && s.targetInterests.length > 0 && (
                      <span className="truncate">
                        → {s.targetInterests.slice(0, 3).join(", ")}
                        {s.targetInterests.length > 3 ? "…" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/business/surveys/${s.id}/results`}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100"
                >
                  <BarChart3 size={11} />
                  Results
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
