"use client";

// ---------------------------------------------------------------------------
// /admin/billing/refunds — refund queue audit (S-244, Tier C8).
//
// Lists recent Stripe refunds for reviewers. Until the User row carries a
// stored Stripe customer id, the user-display column shows "lookup pending"
// — the data is still useful for cross-checking against Stripe directly.
//
// Styling matches /admin/ruleof7 and /admin/moderation for visual parity.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from "react";

interface RefundRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  reason: string | null;
  userDisplayName: string | null;
  plan: string | null;
}

interface ApiBody {
  refunds: RefundRow[];
  hasMore?: boolean;
  nextCursor?: string | null;
  notes?: string[];
}

function formatAmount(amount: number, currency: string): string {
  // Stripe returns minor units. EUR/USD/GBP all use 2 decimals; the long tail
  // (JPY, KRW, etc.) is rare for our SaaS pricing — fall back to /100 anyway.
  const major = (amount / 100).toFixed(2);
  return `${major} ${currency.toUpperCase()}`;
}

export default function AdminRefundsPage() {
  const [data, setData] = useState<ApiBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRefunds = useCallback(async () => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("copyme.access");
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/billing/refunds", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) {
        setError("Not an admin.");
        return;
      }
      if (res.status === 503) {
        const body = (await res.json().catch(() => ({}))) as Partial<ApiBody>;
        setData({ refunds: body.refunds ?? [] });
        setError("Stripe is not configured — list is empty.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as ApiBody;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchRefunds();
  }, [fetchRefunds]);

  const refunds = data?.refunds ?? null;
  const total = refunds?.length ?? 0;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Refund queue</h1>
            <p className="mt-1 text-sm text-slate-500">
              Recent Stripe refunds — EU 14-day right of withdrawal (S-244).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              <span className="font-semibold tabular-nums text-slate-900">{total}</span> refund
              {total === 1 ? "" : "s"}
            </div>
            <button
              type="button"
              onClick={() => void fetchRefunds()}
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

        <table className="mt-6 w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Plan</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Refund date</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {refunds !== null && refunds.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No refunds in the recent window.
                </td>
              </tr>
            )}
            {refunds?.map((r) => (
              <tr key={r.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3 text-slate-700">
                  {r.userDisplayName ? (
                    <span className="font-medium text-slate-900">@{r.userDisplayName}</span>
                  ) : (
                    <span className="text-xs text-slate-400 italic">user lookup pending</span>
                  )}
                  <p className="mt-0.5 font-mono text-[10px] text-slate-400">{r.id}</p>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {r.plan ?? <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatAmount(r.amount, r.currency)}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-md px-2 py-0.5 font-mono text-xs ${
                      r.status === "succeeded"
                        ? "bg-emerald-100 text-emerald-800"
                        : r.status === "pending"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
            {refunds === null && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {data?.notes && data.notes.length > 0 && (
          <ul className="mt-6 list-disc list-inside text-xs text-slate-500 space-y-1">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
