"use client";

// ---------------------------------------------------------------------------
// /admin/moderation — reviewer console (Tier B3).
//
// Two stacked tables: open UserReports on top, active AccountSuspensions
// below. Reviewer can suspend (soft/hard) or dismiss a report, and lift a
// suspension. Polls every 30s. Modeled on /admin/ruleof7 for visual parity.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";

interface ReportRow {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; displayName: string };
  reported: { id: string; displayName: string };
}

interface SuspensionRow {
  id: string;
  userId: string;
  level: string;
  reason: string;
  details: string | null;
  startedAt: string;
  escalatesAt: string | null;
  liftedAt: string | null;
  appealUrl: string | null;
}

function authHeaders(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("copyme.access");
  if (!token) return null;
  return { Authorization: `Bearer ${token}` };
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ModerationConsole() {
  const [reports, setReports] = useState<ReportRow[] | null>(null);
  const [suspensions, setSuspensions] = useState<SuspensionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const headers = authHeaders();
    if (!headers) {
      setError("Not signed in.");
      return;
    }
    setRefreshing(true);
    try {
      const [reportsRes, suspRes] = await Promise.all([
        fetch("/api/admin/reports", { headers }),
        fetch("/api/admin/suspensions", { headers }),
      ]);
      if (reportsRes.status === 403 || suspRes.status === 403) {
        setError("Not an admin.");
        return;
      }
      if (!reportsRes.ok) throw new Error(`reports HTTP ${reportsRes.status}`);
      if (!suspRes.ok) throw new Error(`suspensions HTTP ${suspRes.status}`);
      const reportsBody = (await reportsRes.json()) as { reports: ReportRow[] };
      const suspBody = (await suspRes.json()) as { suspensions: SuspensionRow[] };
      setReports(reportsBody.reports ?? []);
      setSuspensions(suspBody.suspensions ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
    const id = window.setInterval(() => {
      void fetchAll();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  async function suspend(report: ReportRow, level: "soft" | "hard") {
    const headers = authHeaders();
    if (!headers) return;
    const reason = window.prompt(
      `Suspend @${report.reported.displayName} (${level}) — reason?`,
      report.reason,
    );
    if (!reason) return;
    setBusyId(report.id);
    try {
      const res = await fetch("/api/admin/suspensions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: report.reported.id,
          level,
          reason,
          details: report.details ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Resolve the originating report so it leaves the queue.
      await fetch(`/api/admin/reports/${report.id}`, { method: "PATCH", headers });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(report: ReportRow) {
    const headers = authHeaders();
    if (!headers) return;
    if (!window.confirm(`Dismiss report against @${report.reported.displayName}?`)) return;
    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  async function lift(suspension: SuspensionRow) {
    const headers = authHeaders();
    if (!headers) return;
    if (!window.confirm(`Lift ${suspension.level} suspension?`)) return;
    setBusyId(suspension.id);
    try {
      const res = await fetch("/api/admin/suspensions", {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ id: suspension.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  const openCount = reports?.length ?? 0;
  const activeCount = suspensions?.length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Moderation queue</h1>
            <p className="text-sm text-slate-500 mt-1">
              Open reports and active suspensions. Auto-refreshes every 30s.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              <span className="font-semibold tabular-nums text-slate-900">{openCount}</span> open ·{" "}
              <span className="font-semibold tabular-nums text-slate-900">{activeCount}</span>{" "}
              suspended
            </div>
            <button
              type="button"
              onClick={() => void fetchAll()}
              disabled={refreshing}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Open reports
          </h2>
          <table className="mt-2 w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Reporter</th>
                <th className="text-left px-4 py-2">Reported</th>
                <th className="text-left px-4 py-2">Reason</th>
                <th className="text-left px-4 py-2">Age</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {reports !== null && reports.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    No open reports.
                  </td>
                </tr>
              )}
              {reports?.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-700">@{r.reporter.displayName}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    @{r.reported.displayName}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {r.reason}
                    </span>
                    {r.details && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{ageLabel(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => void suspend(r, "soft")}
                        disabled={busyId === r.id}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Suspend (soft)
                      </button>
                      <button
                        type="button"
                        onClick={() => void suspend(r, "hard")}
                        disabled={busyId === r.id}
                        className="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                      >
                        Suspend (hard)
                      </button>
                      <button
                        type="button"
                        onClick={() => void dismiss(r)}
                        disabled={busyId === r.id}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {reports === null && !error && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Active suspensions
          </h2>
          <table className="mt-2 w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Level</th>
                <th className="text-left px-4 py-2">Reason</th>
                <th className="text-left px-4 py-2">Started</th>
                <th className="text-left px-4 py-2">Escalates</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {suspensions !== null && suspensions.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    No active suspensions.
                  </td>
                </tr>
              )}
              {suspensions?.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">
                    {s.userId.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs ${
                        s.level === "hard"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {s.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {s.reason}
                    {s.details && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{s.details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{ageLabel(s.startedAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {s.escalatesAt
                      ? new Date(s.escalatesAt).toLocaleDateString()
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => void lift(s)}
                      disabled={busyId === s.id}
                      className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Lift
                    </button>
                  </td>
                </tr>
              ))}
              {suspensions === null && !error && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
