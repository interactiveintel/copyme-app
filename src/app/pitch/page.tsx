"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Users,
  Activity,
  TrendingUp,
  MessageSquare,
  Target,
  Briefcase,
  Download,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

// ---------------------------------------------------------------------------
// /pitch — public investor data room.
//
// Previously password-gated; the gate was removed by user request so investors
// can land directly on the live numbers. Still client-rendered so the page
// always reflects the latest call to /api/pitch/metrics (no ISR cache).
// ---------------------------------------------------------------------------

interface RetentionRow {
  cohortSize: number;
  retained: number;
  pct: number;
}

interface PitchMetrics {
  asOf: string;
  users: { total: number; signupsLast24h: number; signupsLast7d: number; signupsLast30d: number; emailVerified: number };
  activity: { dau: number; wau: number; mau: number };
  retention: { d1: RetentionRow; d7: RetentionRow; d30: RetentionRow };
  funnel: { signups: number; sentFirstMessage: number; conversionPct: number };
  messages: { totalLast24h: number; totalLast7d: number; totalEver: number };
  contacts: { total: number; addedLast7d: number };
  yogi: {
    activeUsers30d: number;
    totalCallsLast30d: number;
    inputTokensLast30d: number;
    outputTokensLast30d: number;
    costLast30dUsd: number;
    costPerUserUsd: number;
  };
  ads: { approved: number; revenueUsd: number; impressions: number; clicks: number; ctrPct: number };
}

export default function PitchPage() {
  const [data, setData] = useState<PitchMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pitch/metrics");
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setError(json?.error?.message ?? "Failed to load metrics.");
        return;
      }
      setData(json.data as PitchMetrics);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMetrics();
  }, [fetchMetrics]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
          <div>
            <Link href="/" className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-700 text-xs font-medium mb-2">
              ← Public site
            </Link>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-slate-900">Investor data room</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">LIVE</span>
            </div>
            {data && (
              <p className="text-xs text-slate-500 mt-1">
                As of {new Date(data.asOf).toLocaleString()} · refreshes on every load
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void fetchMetrics()}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <a
              href="/api/pitch/export"
              download="copyme-metrics.json"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800"
            >
              <Download size={12} /> Export 30d JSON
            </a>
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">{error}</div>
        )}

        {!data ? (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Top KPIs */}
            <Section title="Reach" icon={Activity}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Total signups" value={data.users.total.toLocaleString()} />
                <Stat label="DAU" value={data.activity.dau.toLocaleString()} sub="active in last 24h" />
                <Stat label="WAU" value={data.activity.wau.toLocaleString()} sub="active in last 7d" />
                <Stat label="MAU" value={data.activity.mau.toLocaleString()} sub="active in last 30d" />
              </div>
            </Section>

            {/* Retention */}
            <Section title="Retention" icon={TrendingUp}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <RetentionTile label="D1" data={data.retention.d1} />
                <RetentionTile label="D7" data={data.retention.d7} />
                <RetentionTile label="D30" data={data.retention.d30} />
              </div>
            </Section>

            {/* Funnel */}
            <Section title="Signup → first message" icon={Target}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Stat label="Signups" value={data.funnel.signups.toLocaleString()} />
                <Stat label="Sent first message" value={data.funnel.sentFirstMessage.toLocaleString()} />
                <Stat label="Conversion" value={`${data.funnel.conversionPct}%`} accent />
              </div>
            </Section>

            {/* Volume */}
            <Section title="Volume" icon={MessageSquare}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Messages 24h" value={data.messages.totalLast24h.toLocaleString()} />
                <Stat label="Messages 7d" value={data.messages.totalLast7d.toLocaleString()} />
                <Stat label="Messages ever" value={data.messages.totalEver.toLocaleString()} />
                <Stat label="Contacts" value={data.contacts.total.toLocaleString()} sub={`+${data.contacts.addedLast7d} in last 7d`} />
              </div>
            </Section>

            {/* Yogi */}
            <Section title="Yogi (AI)" icon={Sparkles}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Active users (30d)" value={data.yogi.activeUsers30d.toLocaleString()} />
                <Stat label="Calls (30d)" value={data.yogi.totalCallsLast30d.toLocaleString()} />
                <Stat label="Cost (30d)" value={`$${data.yogi.costLast30dUsd.toFixed(2)}`} />
                <Stat
                  label="Cost / user / mo"
                  value={`$${data.yogi.costPerUserUsd.toFixed(2)}`}
                  accent={data.yogi.costPerUserUsd > 0 && data.yogi.costPerUserUsd < 0.05}
                  sub="target < $0.05"
                />
              </div>
            </Section>

            {/* B2B */}
            <Section title="B2B ad marketplace" icon={Briefcase}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Approved ads" value={data.ads.approved.toLocaleString()} />
                <Stat label="Revenue" value={`$${data.ads.revenueUsd.toFixed(2)}`} accent={data.ads.revenueUsd > 0} />
                <Stat label="Impressions" value={data.ads.impressions.toLocaleString()} />
                <Stat label="CTR" value={`${data.ads.ctrPct}%`} />
              </div>
            </Section>

            {/* Quality */}
            <Section title="Quality of signup" icon={ShieldCheck}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Stat
                  label="Email verified"
                  value={data.users.emailVerified.toLocaleString()}
                  sub={
                    data.users.total > 0
                      ? `${Math.round((data.users.emailVerified / data.users.total) * 100)}% of total`
                      : ""
                  }
                />
                <Stat
                  label="Recent signups (last 7d)"
                  value={data.users.signupsLast7d.toLocaleString()}
                  sub={`${data.users.signupsLast24h} in last 24h`}
                />
              </div>
            </Section>

            <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-500 leading-relaxed max-w-3xl">
              <p className="font-semibold mb-1">About these numbers</p>
              <p>
                All figures are computed live from production Postgres (Neon) at request time. No
                pre-aggregation, no sampling. Retention cohorts are users created in the corresponding
                day window who sent ≥ 1 message in the last 24 hours. Yogi cost is summed from per-day
                token usage at Anthropic&apos;s posted pricing. Ad revenue is the sum of paid + approved
                ad prices. Numbers refresh on every page load and on Refresh.
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-slate-500" />
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-5 rounded-2xl border shadow-sm ${
        accent
          ? "bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-400">{sub}</div>}
    </motion.div>
  );
}

function RetentionTile({ label, data }: { label: string; data: RetentionRow }) {
  const accent = data.pct > 0;
  return (
    <Stat
      label={label}
      value={`${data.pct}%`}
      sub={`${data.retained} of ${data.cohortSize} cohort`}
      accent={accent}
    />
  );
}
