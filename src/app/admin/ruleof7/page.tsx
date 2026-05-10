"use client";

import { useEffect, useState } from "react";

interface Counter {
  kind: string;
  tier: string;
  count: number;
  lastAt: string;
}

export default function RuleOf7Dashboard() {
  const [data, setData] = useState<{ counters: Counter[]; notes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
    if (!token) {
      setError("Not signed in.");
      return;
    }
    fetch("/api/admin/ruleof7", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900">Rule of 7 — cap-hit dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          How often each Rule-of-7 cap is biting. If any cap reads near zero, the
          constraint is decorative — investigate.
        </p>

        {error && <p className="mt-6 text-rose-600 text-sm">{error}</p>}

        {data && (
          <>
            <table className="mt-6 w-full bg-white rounded-xl border border-slate-200 overflow-hidden">
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="text-left px-4 py-2">Cap</th>
                  <th className="text-left px-4 py-2">Tier</th>
                  <th className="text-right px-4 py-2">Hits</th>
                  <th className="text-right px-4 py-2">Last hit</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {data.counters.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                      No cap hits since this process started.
                    </td>
                  </tr>
                )}
                {data.counters.map((c) => (
                  <tr key={`${c.kind}|${c.tier}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono">{c.kind}</td>
                    <td className="px-4 py-2 text-slate-600">{c.tier}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{c.count}</td>
                    <td className="px-4 py-2 text-right text-slate-500 text-xs">
                      {new Date(c.lastAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-6 list-disc list-inside text-xs text-slate-500 space-y-1">
              {data.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
