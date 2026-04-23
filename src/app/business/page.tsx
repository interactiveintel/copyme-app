"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Briefcase, Sparkles, Target, ShieldCheck, ArrowRight, LogIn, Check } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// /business — landing + onboarding for advertisers.
//
// CopyMe doesn't have a separate business auth flow; an existing user
// "puts on the advertiser hat" by hitting POST /api/business/upgrade
// which flips profileType=legal_entity. From there they're routed to
// /business/ads to create their first ad.
// ---------------------------------------------------------------------------

interface MeShape {
  id: string;
  displayName: string;
  profileType: string;
  accountTier: string;
}

function BusinessLandingInner() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MeShape | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const res = await authFetch("/api/users/me");
      if (!res.ok) return;
      const data = await res.json();
      setMe(data?.data ?? null);
    } catch {
      /* ignore */
    }
  }, [user, authFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const upgrade = async () => {
    setError("");
    setUpgrading(true);
    try {
      const res = await authFetch("/api/business/upgrade", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "Upgrade failed.");
        return;
      }
      router.push("/business/ads");
    } catch {
      setError("Network error.");
    } finally {
      setUpgrading(false);
    }
  };

  const isBusiness = me?.profileType === "legal_entity";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/40 to-pink-50/30">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        {/* Logo */}
        <Link href="/" className="inline-flex items-center gap-0.5 mb-12">
          <span className="text-2xl font-bold text-slate-900">Copy</span>
          <span className="text-2xl font-bold bg-gradient-to-r from-[#7C3AED] to-[#EC4899] bg-clip-text text-transparent">
            Me
          </span>
          <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900 text-white">
            BUSINESS
          </span>
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold mb-5">
            <Sparkles size={12} />
            Reach the Rule-of-7 audience
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-tight max-w-2xl">
            Advertise to people who actually read.
          </h1>
          <p className="mt-4 text-base text-slate-500 max-w-xl leading-relaxed">
            CopyMe users have agreed to a 70-word cap on every message. They opt in to your
            ad — and they read it. Targeting is interest-based, ads are AI-curated, and
            every dollar buys real attention.
          </p>
        </motion.div>

        {/* Three pillars */}
        <div className="grid sm:grid-cols-3 gap-3 mb-12">
          {[
            {
              icon: Target,
              title: "Targeted by interest",
              body: "Choose up to 7 interest tags. We only serve the ad to users with at least one match.",
            },
            {
              icon: Sparkles,
              title: "AI-curated placement",
              body: "Yogi reasons over the user's profile to surface your ad in the right context.",
            },
            {
              icon: ShieldCheck,
              title: "Human-reviewed",
              body: "Every ad is reviewed by a human before going live. No malware, no scams, no surprises.",
            },
          ].map((p) => (
            <div key={p.title} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mb-3">
                <p.icon size={16} className="text-white" />
              </div>
              <p className="text-sm font-semibold text-slate-900">{p.title}</p>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>

        {/* CTA card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200 shadow-xl"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shrink-0">
              <Briefcase size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-slate-900">
                {isBusiness ? "You're set up." : "Ready to start?"}
              </h2>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                {authLoading
                  ? "Checking your account…"
                  : !user
                  ? "Sign in with a CopyMe account, then upgrade it to a business account here. We'll route you to the ad uploader."
                  : isBusiness
                  ? "Your account is already a business account. Head to your ads dashboard."
                  : "We'll flip your CopyMe account into a business account — same email, same login. From there you can create and pay for your first ad."}
              </p>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="text-xs text-rose-700">{error}</p>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {!user ? (
                  <Link
                    href="/app"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  >
                    <LogIn size={14} /> Sign in
                  </Link>
                ) : isBusiness ? (
                  <Link
                    href="/business/ads"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  >
                    <Check size={14} /> Open ads dashboard
                  </Link>
                ) : (
                  <button
                    onClick={upgrade}
                    disabled={upgrading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-60"
                  >
                    {upgrading ? "Upgrading…" : "Upgrade my account"}
                    {!upgrading && <ArrowRight size={14} />}
                  </button>
                )}
              </div>

              <p className="mt-4 text-[11px] text-slate-400">
                A starter ad is $1. You can review, pause, or delete it any time.
                See the <Link href="/terms" className="underline">terms</Link> and{" "}
                <Link href="/privacy" className="underline">privacy policy</Link>.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

export default function BusinessLanding() {
  return (
    <AuthProvider>
      <BusinessLandingInner />
    </AuthProvider>
  );
}
