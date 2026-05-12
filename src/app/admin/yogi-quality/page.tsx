"use client";

import { useEffect, useState } from "react";

interface SeriesPoint {
  day: string;
  activeUsers: number;
  calls: number;
  costUsd: number;
  costPerUser: number;
}

interface YogiQualityResponse {
  series: SeriesPoint[];
  totals: {
    callsLast30: number;
    costUsdLast30: number;
  };
  notes: string[];
}

function formatUsd(value: number, fractionDigits = 2): string {
  return `$${value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

interface ChartProps {
  series: SeriesPoint[];
}

function CostTrendChart({ series }: ChartProps) {
  const width = 800;
  const height = 200;
  const paddingX = 24;
  const paddingY = 16;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const maxCost = series.reduce((m, p) => (p.costPerUser > m ? p.costPerUser : m), 0);
  const allZero = maxCost === 0;

  if (allZero) {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
        No Yogi activity in the last 30 days yet.
      </div>
    );
  }

  const denomX = series.length > 1 ? series.length - 1 : 1;
  const points = series.map((p, i) => {
    const x = paddingX + (i / denomX) * innerWidth;
    const y = paddingY + innerHeight - (p.costPerUser / maxCost) * innerHeight;
    return { x, y, point: p };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = [
    `M ${points[0].x} ${paddingY + innerHeight}`,
    ...points.map((p) => `L ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${paddingY + innerHeight}`,
    "Z",
  ].join(" ");

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-700">30-day cost / user trend</h2>
        <span className="text-xs text-slate-400">peak {formatUsd(maxCost, 4)}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        width="100%"
        height={height}
        className="mt-3"
        role="img"
        aria-label="Cost per user over the last 30 days"
      >
        <defs>
          <linearGradient id="yogi-quality-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="yogi-quality-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#yogi-quality-area)" />
        <polyline
          points={polylinePoints}
          fill="none"
          stroke="url(#yogi-quality-stroke)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p) => (
          <circle key={p.point.day} cx={p.x} cy={p.y} r={3.5} fill="#fff" stroke="#6366f1" strokeWidth={1.5}>
            <title>{`${p.point.day} — ${formatUsd(p.point.costPerUser, 4)} / user`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{series[0]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}

interface SummaryTilesProps {
  data: YogiQualityResponse;
}

function SummaryTiles({ data }: SummaryTilesProps) {
  const days = data.series.length;
  const totalActiveUsers = data.series.reduce((a, s) => a + s.activeUsers, 0);
  const avgActiveUsers = days > 0 ? totalActiveUsers / days : 0;
  const avgCostPerDau = totalActiveUsers > 0 ? data.totals.costUsdLast30 / totalActiveUsers : 0;

  const tiles: Array<{ label: string; value: string; sub: string }> = [
    {
      label: "Total calls (30d)",
      value: formatNumber(data.totals.callsLast30),
      sub: "Yogi API calls in last 30 days",
    },
    {
      label: "Total cost (30d)",
      value: formatUsd(data.totals.costUsdLast30, 2),
      sub: "Sum of model spend",
    },
    {
      label: "Avg active users / day",
      value: avgActiveUsers.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
      sub: `${formatNumber(totalActiveUsers)} user-days total`,
    },
    {
      label: "Avg cost / DAU",
      value: formatUsd(avgCostPerDau, 4),
      sub: "Cost ÷ sum(activeUsers)",
    },
  ];

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">{t.label}</div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">{t.value}</div>
          <div className="mt-1 text-[11px] text-slate-400">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}

interface DayTableProps {
  series: SeriesPoint[];
}

function DayTable({ series }: DayTableProps) {
  const reversed = [...series].reverse();
  return (
    <table className="mt-4 w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th className="px-4 py-2 text-left">Day</th>
          <th className="px-4 py-2 text-right">Active users</th>
          <th className="px-4 py-2 text-right">Calls</th>
          <th className="px-4 py-2 text-right">Cost (USD)</th>
          <th className="px-4 py-2 text-right">Cost / user</th>
        </tr>
      </thead>
      <tbody className="text-sm">
        {reversed.map((s) => (
          <tr key={s.day} className="border-t border-slate-100">
            <td className="px-4 py-2 font-mono text-slate-700">{s.day}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatNumber(s.activeUsers)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatNumber(s.calls)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatUsd(s.costUsd, 4)}</td>
            <td className="px-4 py-2 text-right tabular-nums">{formatUsd(s.costPerUser, 4)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function YogiQualityDashboard() {
  const [data, setData] = useState<YogiQualityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [tableOpen, setTableOpen] = useState<boolean>(false);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
      if (!token) {
        if (!cancelled) {
          setError("Not signed in.");
          setData(null);
        }
        return;
      }
      if (!cancelled) setLoading(true);
      try {
        const r = await fetch("/api/admin/yogi-quality", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (r.status === 403) {
          throw new Error("Not an admin.");
        }
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`);
        }
        const json = (await r.json()) as YogiQualityResponse;
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastFetched(new Date());
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function refresh() {
    const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setLoading(true);
    try {
      const r = await fetch("/api/admin/yogi-quality", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.status === 403) throw new Error("Not an admin.");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = (await r.json()) as YogiQualityResponse;
      setData(json);
      setError(null);
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Yogi quality dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              AI cost, throughput, and refusal/accept signals.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={refresh}
              disabled={loading}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {lastFetched && (
              <span className="text-[10px] text-slate-400">
                Updated {lastFetched.toLocaleTimeString()} · auto every 30s
              </span>
            )}
          </div>
        </div>

        {error && <p className="mt-6 text-sm text-rose-600">{error}</p>}

        {data && (
          <>
            <SummaryTiles data={data} />
            <CostTrendChart series={data.series} />

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setTableOpen((v) => !v)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                {tableOpen ? "Hide table" : "Show table"}
              </button>
              {tableOpen && <DayTable series={data.series} />}
            </div>

            {data.notes.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h2>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-slate-500">
                  {data.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
