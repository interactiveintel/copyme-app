"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  MessageSquare,
  UserPlus,
  TrendingUp,
  ShieldCheck,
  LogIn,
  RefreshCw,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// /admin/metrics
//
// Investor-grade top-level dashboard. Reads from GET /api/admin/metrics.
// Access gated client-side by rendering a "sign in" prompt when there is
// no access token, then enforced server-side by the ADMIN_USER_IDS env-var
// gate in the API route. Neither side is the final authority — the API
// is.
// ---------------------------------------------------------------------------

interface MetricsShape {
  asOf: string;
  users: {
    total: number;
    signupsLast24h: number;
    signupsLast7d: number;
    signupsLast30d: number;
    emailVerified: number;
  };
  activity: { dau: number; wau: number; mau: number };
  messages: { totalLast24h: number; totalLast7d: number; totalEver: number };
  contacts: { total: number; addedLast7d: number };
  funnel: { signups: number; sentFirstMessage: number; conversionPct: number };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-2 text-slate-500">
        <Icon size={14} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-3xl font-bold text-slate-900 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  );
}

function AdminMetricsInner() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<MetricsShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/admin/metrics");
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in to view metrics.");
        return;
      }
      if (res.status === 403) {
        setError("This account is not on the admin allow-list. Ask an admin to add your user ID to ADMIN_USER_IDS.");
        return;
      }
      if (!res.ok || !data.success) {
        setError(data?.error?.message || "Failed to load metrics.");
        return;
      }
      setMetrics(data.data as MetricsShape);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (!authLoading && user) refresh();
  }, [authLoading, user, refresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 p-4">
        <div className="max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-100 flex items-center justify-center mb-3">
            <ShieldCheck size={20} className="text-purple-600" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Admin metrics</h1>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with an admin account to view DAU, WAU, and funnel metrics.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          >
            <LogIn size={14} /> Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Metrics</h1>
            <p className="text-xs text-slate-500 mt-1">
              {metrics?.asOf
                ? `As of ${new Date(metrics.asOf).toLocaleString()}`
                : "Investor-grade top-level dashboard"}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {!metrics && !error && loading && (
          <div className="py-20 flex justify-center">
            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {metrics && (
          <>
            {/* Activity */}
            <section className="mb-10">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Activity
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon={Activity} label="DAU" value={metrics.activity.dau} sub="active in last 24h (sent a message)" />
                <StatCard icon={Activity} label="WAU" value={metrics.activity.wau} sub="active in last 7 days" />
                <StatCard icon={Activity} label="MAU" value={metrics.activity.mau} sub="active in last 30 days" />
              </div>
            </section>

            {/* Users */}
            <section className="mb-10">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Users
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Total signups" value={metrics.users.total} />
                <StatCard icon={UserPlus} label="Last 24h" value={metrics.users.signupsLast24h} />
                <StatCard icon={UserPlus} label="Last 7 days" value={metrics.users.signupsLast7d} />
                <StatCard icon={UserPlus} label="Last 30 days" value={metrics.users.signupsLast30d} />
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatCard
                  icon={ShieldCheck}
                  label="Email verified"
                  value={metrics.users.emailVerified}
                  sub={
                    metrics.users.total > 0
                      ? `${Math.round((metrics.users.emailVerified / metrics.users.total) * 100)}% of total`
                      : undefined
                  }
                />
              </div>
            </section>

            {/* Funnel */}
            <section className="mb-10">
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Funnel: Signup → First message
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <StatCard icon={Users} label="Signups" value={metrics.funnel.signups} />
                <StatCard icon={MessageSquare} label="Sent first message" value={metrics.funnel.sentFirstMessage} />
                <StatCard
                  icon={TrendingUp}
                  label="Conversion"
                  value={`${metrics.funnel.conversionPct}%`}
                  sub="sent ≥ 1 message / total signups"
                />
              </div>
            </section>

            {/* Messages & Contacts */}
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Volume
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={MessageSquare} label="Messages 24h" value={metrics.messages.totalLast24h} />
                <StatCard icon={MessageSquare} label="Messages 7d" value={metrics.messages.totalLast7d} />
                <StatCard icon={MessageSquare} label="Messages ever" value={metrics.messages.totalEver} />
                <StatCard
                  icon={Users}
                  label="Contacts total"
                  value={metrics.contacts.total}
                  sub={`+${metrics.contacts.addedLast7d} in last 7d`}
                />
              </div>
            </section>
          </>
        )}

        <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400">
          Access gated by <code className="font-mono">ADMIN_USER_IDS</code> env var.
          PostHog events (signup, first_message, cycle_completed, contact_added,
          yogi_chat_started) are emitted in parallel when{" "}
          <code className="font-mono">POSTHOG_API_KEY</code> is set.
        </div>
      </div>
    </div>
  );
}

export default function AdminMetricsPage() {
  return (
    <AuthProvider>
      <AdminMetricsInner />
    </AuthProvider>
  );
}
