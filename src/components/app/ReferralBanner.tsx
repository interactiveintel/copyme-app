"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gift, Copy, Share2, Check } from "lucide-react";
import GlassCard from "../ui/GlassCard";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// ReferralBanner — Tier C9 / S-246
//
// Surfaces the rule-of-7 referral promo in the in-app profile. Fetches its
// own data from /api/users/me/referral/share. Hides itself entirely for
// users already on a paid plan (no upsell to existing customers).
// ---------------------------------------------------------------------------

interface ShareData {
  code: string;
  deepLink: string;
  shareText: string;
  qualifyingReferrals: number;
  needed: number;
  freeDaysGranted: number;
  earnedAt: string | null;
}

function isPaidTier(tier: string | undefined | null): boolean {
  if (!tier) return false;
  const t = tier.toLowerCase();
  // AccountTier enum has: basic | business_3 | business_7 | business_50 |
  // ecommerce. Plus the legacy "premium" string used in mock/demo data.
  // Anything that isn't free-tier "basic" is treated as a paid customer for
  // the purposes of this upsell.
  return t !== "basic" && t.length > 0;
}

function formatEarnedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReferralBanner() {
  const { user, authFetch } = useAuth();
  const [data, setData] = useState<ShareData | null>(null);
  const [accountTier, setAccountTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        // Pull share data + account tier in parallel. Tier comes from
        // /api/users/me because the AuthUser cached on the client doesn't
        // include it post-signup.
        const [shareRes, meRes] = await Promise.all([
          authFetch("/api/users/me/referral/share"),
          authFetch("/api/users/me"),
        ]);
        if (shareRes.ok) {
          const json = (await shareRes.json()) as ShareData;
          if (!cancelled) setData(json);
        }
        if (meRes.ok) {
          const me = await meRes.json();
          if (!cancelled) setAccountTier(me?.data?.accountTier ?? null);
        }
      } catch {
        // Network error — silently hide the banner; nothing critical broken.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authFetch]);

  // Demo mode (no auth) or still loading or no data — render nothing.
  if (!user || loading || !data) return null;

  // Hide entirely for paid users — no upsell to existing customers.
  if (isPaidTier(accountTier ?? user.accountTier)) return null;

  // Already earned: collapse into a small confirmation pill.
  if (data.freeDaysGranted > 0) {
    const earnedLabel = formatEarnedAt(data.earnedAt);
    return (
      <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
        <Check size={14} className="text-emerald-600 shrink-0" />
        <p className="text-xs text-emerald-700">
          You earned {data.freeDaysGranted} free days of Pro
          {earnedLabel ? ` · ${earnedLabel}` : ""}
        </p>
      </div>
    );
  }

  const filled = Math.min(data.qualifyingReferrals, data.needed);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setShareError("Couldn't copy. Try selecting and copying manually.");
    }
  };

  const handleShare = async () => {
    setShareError(null);
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "CopyMe",
          text: data.shareText,
          url: data.deepLink,
        });
        return;
      } catch (err) {
        // User dismissed the sheet — that's fine, no error.
        if ((err as Error)?.name === "AbortError") return;
        // Fall through to copy fallback.
      }
    }
    await handleCopy();
  };

  return (
    <GlassCard gradient>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={16} className="text-pink-500" />
          <span className="text-sm font-semibold text-slate-900">
            Refer 7 friends, get 7 days Pro free
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-1">
          {Array.from({ length: data.needed }).map((_, i) => {
            const isFilled = i < filled;
            return (
              <motion.div
                key={i}
                initial={false}
                animate={{ scale: isFilled ? 1 : 0.85 }}
                className={
                  "h-2 flex-1 rounded-full " +
                  (isFilled
                    ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                    : "bg-slate-200")
                }
              />
            );
          })}
        </div>
        <p className="text-[11px] text-slate-500 mb-3">
          {filled}/{data.needed} friends invited
        </p>

        {/* Share link + copy */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <p className="text-xs font-mono text-slate-700 truncate">{data.deepLink}</p>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy share link"
            className="shrink-0 w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            {copied ? (
              <Check size={14} className="text-emerald-600" />
            ) : (
              <Copy size={14} className="text-slate-500" />
            )}
          </button>
        </div>

        {/* Native share */}
        <button
          type="button"
          onClick={handleShare}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
        >
          <Share2 size={14} />
          Share invite
        </button>

        {shareError && (
          <p className="mt-2 text-[11px] text-rose-600">{shareError}</p>
        )}
      </div>
    </GlassCard>
  );
}
