"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Clock,
  RefreshCw,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

interface AdmAd {
  id: string;
  brand: string;
  title: string;
  tagline: string | null;
  body: string;
  imageUrl: string | null;
  ctaLabel: string;
  ctaUrl: string;
  category: string;
  targetInterests: string[] | null;
  status: string;
  priceMicroUsd: number;
  createdAt: string;
  owner: { id: string; displayName: string };
}

const TABS = [
  { id: "pending_review", label: "Pending review" },
  { id: "approved", label: "Live" },
  { id: "rejected", label: "Rejected" },
  { id: "all", label: "All" },
];

function AdminAdsInner() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<string>("pending_review");
  const [ads, setAds] = useState<AdmAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(`/api/admin/ads?status=${tab}`);
      const data = await res.json();
      if (res.status === 401) {
        setError("Sign in.");
        return;
      }
      if (res.status === 403) {
        setError(
          "This account is not on the admin allow-list. Add your user UUID to ADMIN_USER_IDS in Vercel env vars.",
        );
        return;
      }
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "Failed to load ads.");
        return;
      }
      setAds((data.data?.ads ?? []) as AdmAd[]);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch, tab]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const moderate = async (adId: string, action: "approve" | "reject" | "pause" | "resume", reason?: string) => {
    setActionId(adId);
    setError("");
    try {
      const res = await authFetch(`/api/admin/ads/${adId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || `Failed to ${action}.`);
        return;
      }
      await refresh();
    } catch {
      setError("Network error.");
    } finally {
      setActionId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center">
          <ShieldCheck size={20} className="text-purple-600 mx-auto mb-2" />
          <h1 className="text-lg font-bold text-slate-900">Sign in</h1>
          <p className="text-xs text-slate-500 mt-1">Admins only.</p>
          <Link
            href="/app"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin/metrics" className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-700 text-xs font-medium mb-2">
              ← Metrics
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Ad moderation</h1>
            <p className="text-xs text-slate-500 mt-1">
              Review and approve advertiser submissions.
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-slate-700 border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tab === t.id
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {ads.length === 0 && !loading && !error && (
          <div className="py-16 text-center text-sm text-slate-500">No ads in this list.</div>
        )}

        <div className="space-y-3">
          {ads.map((ad) => (
            <motion.div
              key={ad.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {ad.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  ) : (
                    <Clock size={20} className="text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-slate-500">
                    {ad.brand} · by {ad.owner.displayName}
                  </p>
                  <p className="text-base font-semibold text-slate-900">{ad.title}</p>
                  {ad.tagline && (
                    <p className="text-xs text-slate-500 mt-0.5">{ad.tagline}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-700 leading-relaxed line-clamp-3">
                    {ad.body}
                  </p>

                  <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
                    <a
                      href={ad.ctaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-purple-600 hover:underline"
                    >
                      {ad.ctaLabel} <ExternalLink size={10} />
                    </a>
                    <span>·</span>
                    <span>{ad.category}</span>
                    {ad.targetInterests && ad.targetInterests.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">{ad.targetInterests.join(", ")}</span>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {ad.status === "pending_review" && (
                      <>
                        <button
                          disabled={actionId === ad.id}
                          onClick={() => moderate(ad.id, "approve")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60"
                        >
                          <CheckCircle2 size={11} /> Approve
                        </button>
                        <button
                          disabled={actionId === ad.id}
                          onClick={() => {
                            const reason = window.prompt("Reason for rejection (optional):") ?? "";
                            void moderate(ad.id, "reject", reason);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-60"
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      </>
                    )}
                    {ad.status === "approved" && (
                      <button
                        disabled={actionId === ad.id}
                        onClick={() => moderate(ad.id, "pause")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Pause
                      </button>
                    )}
                    {ad.status === "paused" && (
                      <button
                        disabled={actionId === ad.id}
                        onClick={() => moderate(ad.id, "resume")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                      >
                        Resume
                      </button>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400">
                      ${(ad.priceMicroUsd / 1_000_000).toFixed(2)} · {new Date(ad.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </main>
  );
}

export default function AdminAdsPage() {
  return (
    <AuthProvider>
      <AdminAdsInner />
    </AuthProvider>
  );
}
