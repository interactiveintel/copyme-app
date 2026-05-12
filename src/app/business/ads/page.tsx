"use client";

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Image as ImageIcon,
  Tag,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CreditCard,
  X,
  ExternalLink,
  BarChart3,
  TrendingUp,
  Eye,
} from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import AdInboxCard from "@/components/app/AdInboxCard";

// ---------------------------------------------------------------------------
// Banned-word lint patterns. Inline warnings (non-blocking) — nudge the
// advertiser away from common spammy/policy-flagged phrasing before we send
// the ad to manual review.
// ---------------------------------------------------------------------------
const BANNED_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\bguarantee[ds]?\b/i, message: "Avoid 'guarantee' — likely violates ad policy." },
  { pattern: /\bfree\s+(money|cash|bitcoin|crypto)\b/i, message: "Free-money phrasing flags as scam." },
  { pattern: /\b(click\s*here|act\s*now|limited\s*time)\b/i, message: "Spammy phrasing — rephrase." },
  { pattern: /[!?]{3,}/, message: "Excessive punctuation looks low-trust." },
  { pattern: /\b(viagra|cialis|mlm|crypto\s*pump)\b/i, message: "Restricted category." },
];

function lintText(value: string): string[] {
  if (!value) return [];
  const hits: string[] = [];
  for (const { pattern, message } of BANNED_PATTERNS) {
    if (pattern.test(value)) hits.push(message);
  }
  return hits;
}

// Suggestions for the targeting picker. Lowercase, deduped at submit.
const COMMON_INTERESTS = [
  "tech", "design", "music", "fitness", "cooking", "travel",
  "books", "movies", "gaming", "art", "photography", "yoga",
  "fashion", "food", "running", "hiking", "coffee", "wine",
  "startups", "investing", "crypto", "ai", "marketing", "writing",
];

// Rule of 7 — max 7 tags, 45 chars per tag.
const MAX_TAGS = 7;
const MAX_TAG_LEN = 45;

// ---------------------------------------------------------------------------
// /business/ads — advertiser dashboard.
//
//   - Lists the caller's ads with status badge
//   - Inline "create new ad" form
//   - "Pay" button on draft ads → POST /api/business/ads/:id/checkout →
//     redirect to Stripe URL (or shows 503 banner if Stripe not configured)
// ---------------------------------------------------------------------------

interface AdRow {
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
  status:
    | "draft"
    | "pending_payment"
    | "pending_review"
    | "approved"
    | "rejected"
    | "paused"
    | "expired";
  priceMicroUsd: number;
  impressions: number;
  clicks: number;
  rejectionReason: string | null;
  createdAt: string;
}

const STATUS_PRESENTATION: Record<
  AdRow["status"],
  { label: string; tone: "indigo" | "amber" | "rose" | "emerald" | "slate"; icon: React.ElementType }
> = {
  draft: { label: "Draft — needs payment", tone: "slate", icon: CreditCard },
  pending_payment: { label: "Awaiting payment", tone: "amber", icon: Clock },
  pending_review: { label: "In review", tone: "amber", icon: Clock },
  approved: { label: "Live", tone: "emerald", icon: CheckCircle2 },
  rejected: { label: "Rejected", tone: "rose", icon: AlertTriangle },
  paused: { label: "Paused", tone: "slate", icon: Clock },
  expired: { label: "Expired", tone: "slate", icon: Clock },
};

const TONE_CLASSES = {
  indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-50 text-slate-600 border-slate-200",
} as const;

function formatUsd(micro: number) {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function StatusBadge({ status }: { status: AdRow["status"] }) {
  const p = STATUS_PRESENTATION[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${TONE_CLASSES[p.tone]}`}
    >
      <p.icon size={11} />
      {p.label}
    </span>
  );
}

function BusinessAdsInner() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const [ads, setAds] = useState<AdRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [notBusiness, setNotBusiness] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/business/ads");
      const data = await res.json();
      if (res.status === 403 && data?.error?.code === "NOT_BUSINESS") {
        setNotBusiness(true);
        return;
      }
      if (!res.ok || !data?.success) {
        setError(data?.error?.message || "Failed to load ads.");
        return;
      }
      setAds((data.data?.ads ?? []) as AdRow[]);
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [user, authFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <NotSignedInCard />
    );
  }

  if (notBusiness) {
    return <NotBusinessCard />;
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/business" className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-700 text-xs font-medium mb-2">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">Your ads</h1>
            <p className="text-xs text-slate-500 mt-1">
              {ads.length} {ads.length === 1 ? "ad" : "ads"} · live ones show up in users&apos; AD Inbox
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
          >
            <Plus size={14} /> New ad
          </button>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* Ad list */}
        <div className="space-y-3">
          {loading && ads.length === 0 ? (
            <div className="py-16 flex justify-center">
              <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : ads.length === 0 ? (
            <EmptyState onCreate={() => setShowForm(true)} />
          ) : (
            ads.map((ad) => (
              <AdCard
                key={ad.id}
                ad={ad}
                authFetch={authFetch}
                onChange={refresh}
                onError={setError}
              />
            ))
          )}
        </div>
      </div>

      {/* Create form modal */}
      <AnimatePresence>
        {showForm && (
          <CreateAdModal
            authFetch={authFetch}
            onClose={() => setShowForm(false)}
            onCreated={() => {
              setShowForm(false);
              refresh();
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

function NotSignedInCard() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900 mb-1">Sign in required</h1>
        <p className="text-xs text-slate-500 mb-4">
          Sign in to your CopyMe account, then upgrade it to a business account.
        </p>
        <Link
          href="/business"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}

function NotBusinessCard() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center">
        <h1 className="text-lg font-bold text-slate-900 mb-1">You need a business account</h1>
        <p className="text-xs text-slate-500 mb-4">
          Upgrade your CopyMe account to a business account first. It takes one click.
        </p>
        <Link
          href="/business"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
        >
          Upgrade now <ArrowRight size={14} />
        </Link>
      </div>
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="py-12 px-6 rounded-3xl bg-white border-2 border-dashed border-slate-200 text-center">
      <div className="w-12 h-12 rounded-2xl bg-purple-100 mx-auto flex items-center justify-center mb-3">
        <Tag size={20} className="text-purple-600" />
      </div>
      <p className="text-sm font-semibold text-slate-900">No ads yet</p>
      <p className="text-xs text-slate-500 mt-1">
        Create your first ad — costs $1 to launch, takes about a minute.
      </p>
      <button
        onClick={onCreate}
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
      >
        <Plus size={14} /> Create your first ad
      </button>
    </div>
  );
}

interface AnalyticsResponse {
  ad: { id: string; title: string; status: string; activatedAt: string | null; expiresAt: string | null };
  totals: { impressions: number; clicks: number; ctr: number; spendMicroUsd: number };
  series: Array<{ day: string; impressions: number; clicks: number; ctr: number }>;
  rangeDays: number;
}

function AdCard({
  ad,
  authFetch,
  onChange,
  onError,
}: {
  ad: AdRow;
  authFetch: ReturnType<typeof useAuth>["authFetch"];
  onChange: () => void;
  onError: (msg: string) => void;
}) {
  const [paying, setPaying] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await authFetch(`/api/business/ads/${ad.id}/analytics?days=14`);
      const data = await res.json();
      if (res.ok && data?.success) {
        setAnalytics(data.data as AnalyticsResponse);
      }
    } catch {
      /* leave panel empty on failure */
    } finally {
      setAnalyticsLoading(false);
    }
  }, [authFetch, ad.id]);

  const toggleAnalytics = () => {
    const next = !showAnalytics;
    setShowAnalytics(next);
    if (next && !analytics) void loadAnalytics();
  };

  const pay = async () => {
    setPaying(true);
    onError("");
    try {
      const res = await authFetch(`/api/business/ads/${ad.id}/checkout`, { method: "POST" });
      const data = await res.json();
      if (res.status === 503) {
        onError(
          "Payments are not configured on this deployment. Set STRIPE_SECRET_KEY in Vercel env vars to enable.",
        );
        return;
      }
      if (!res.ok || !data?.success) {
        onError(data?.error?.message || "Couldn't start checkout.");
        return;
      }
      // Redirect the buyer to Stripe.
      window.location.href = data.data.checkoutUrl as string;
    } catch {
      onError("Network error.");
    } finally {
      setPaying(false);
      onChange();
    }
  };

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
      <div className="flex items-start gap-4">
        {/* Image / placeholder */}
        <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {ad.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">{ad.brand}</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{ad.title}</p>
              {ad.tagline && (
                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{ad.tagline}</p>
              )}
            </div>
            <StatusBadge status={ad.status} />
          </div>

          {/* Stats row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
            <span>{formatUsd(ad.priceMicroUsd)}</span>
            <span>{ad.impressions.toLocaleString()} impressions</span>
            <span>{ad.clicks.toLocaleString()} clicks</span>
            <span>
              CTR{" "}
              <strong className="text-slate-700">
                {ad.impressions > 0
                  ? `${((ad.clicks / ad.impressions) * 100).toFixed(2)}%`
                  : "—"}
              </strong>
            </span>
            {ad.targetInterests && ad.targetInterests.length > 0 && (
              <span className="truncate">→ {ad.targetInterests.slice(0, 3).join(", ")}</span>
            )}
            <button
              onClick={toggleAnalytics}
              className="ml-auto inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
            >
              <BarChart3 size={11} />
              {showAnalytics ? "Hide details" : "Analytics"}
            </button>
          </div>

          {ad.status === "rejected" && ad.rejectionReason && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
              <strong>Reason:</strong> {ad.rejectionReason}
            </div>
          )}

          {/* Actions */}
          {ad.status === "draft" && (
            <button
              onClick={pay}
              disabled={paying}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-60"
            >
              <CreditCard size={11} />
              {paying ? "Starting checkout…" : `Pay ${formatUsd(ad.priceMicroUsd)} to submit`}
            </button>
          )}

          {ad.status === "approved" && (
            <a
              href={ad.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 hover:underline"
            >
              Preview your link <ExternalLink size={10} />
            </a>
          )}

          {/* Analytics drawer */}
          <AnimatePresence initial={false}>
            {showAnalytics && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-100"
              >
                <AnalyticsBody loading={analyticsLoading} data={analytics} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function AnalyticsBody({
  loading,
  data,
}: {
  loading: boolean;
  data: AnalyticsResponse | null;
}) {
  if (loading && !data) {
    return (
      <div className="py-6 flex justify-center">
        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!data) {
    return <p className="text-xs text-slate-500">No analytics yet.</p>;
  }
  const max = Math.max(1, ...data.series.map((d) => d.impressions));
  return (
    <div>
      {/* Top-line numbers */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Stat label="Impressions" value={data.totals.impressions.toLocaleString()} />
        <Stat label="Clicks" value={data.totals.clicks.toLocaleString()} />
        <Stat
          label="CTR"
          value={`${data.totals.ctr}%`}
          accent={data.totals.ctr > 0}
        />
      </div>

      {/* Sparkline */}
      <div className="flex items-center gap-1.5 mb-2">
        <TrendingUp size={11} className="text-slate-400" />
        <span className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
          Last {data.rangeDays} days
        </span>
      </div>
      <div className="flex items-end gap-1 h-16">
        {data.series.map((d) => {
          const h = Math.round((d.impressions / max) * 100);
          return (
            <div
              key={d.day}
              title={`${d.day}: ${d.impressions} imp, ${d.clicks} clicks (${d.ctr}% CTR)`}
              className="flex-1 min-w-[3px] rounded-sm bg-gradient-to-t from-indigo-400 to-purple-400"
              style={{ height: `${Math.max(2, h)}%`, opacity: d.impressions === 0 ? 0.15 : 1 }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-slate-400">
        <span>{data.series[0]?.day.slice(5)}</span>
        <span>{data.series[data.series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`p-2 rounded-lg border ${accent ? "bg-purple-50 border-purple-200" : "bg-slate-50 border-slate-100"}`}
    >
      <p className={`text-base font-bold tabular-nums ${accent ? "text-purple-700" : "text-slate-900"}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function CreateAdModal({
  authFetch,
  onClose,
  onCreated,
}: {
  authFetch: ReturnType<typeof useAuth>["authFetch"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [brand, setBrand] = useState("");
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Learn more");
  const [ctaUrl, setCtaUrl] = useState("");
  const [category, setCategory] = useState("for-you");
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Inline lint warnings — recompute on every keystroke. Non-blocking.
  const titleLint = useMemo(() => lintText(title), [title]);
  const taglineLint = useMemo(() => lintText(tagline), [tagline]);
  const bodyLint = useMemo(() => lintText(body), [body]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await authFetch("/api/business/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          title,
          tagline: tagline || undefined,
          body,
          imageUrl: imageUrl || undefined,
          ctaLabel,
          ctaUrl,
          category,
          targetInterests: tags,
          priceMicroUsd: 1_000_000,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        const meta = data?.error?.meta;
        setError(
          (meta && Object.values(meta).join(" · ")) ||
            data?.error?.message ||
            "Couldn't create ad.",
        );
        return;
      }
      onCreated();
    } catch {
      setError("Network error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">New ad</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center" aria-label="Close">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-0">
            {/* Form column */}
            <form onSubmit={submit} className="p-5 space-y-3 md:border-r md:border-slate-100">
              <Field label="Brand" value={brand} onChange={setBrand} placeholder="Acme Co." required />
              <Field
                label="Title"
                value={title}
                onChange={setTitle}
                placeholder="Save 30% on your first month"
                required
                lint={titleLint}
              />
              <Field
                label="Tagline (optional)"
                value={tagline}
                onChange={setTagline}
                placeholder="One short hook"
                lint={taglineLint}
              />
              <FieldArea
                label="Body copy"
                value={body}
                onChange={setBody}
                placeholder="2-4 sentences max. We'll show this in the ad inbox."
                maxLength={700}
                required
                lint={bodyLint}
              />
              <Field label="Image URL (https)" value={imageUrl} onChange={setImageUrl} placeholder="https://example.com/ad.png" />
              <div className="grid grid-cols-2 gap-3">
                <Field label="CTA label" value={ctaLabel} onChange={setCtaLabel} placeholder="Learn more" />
                <Field label="Category" value={category} onChange={setCategory} placeholder="for-you" />
              </div>
              <Field label="CTA URL (https)" value={ctaUrl} onChange={setCtaUrl} placeholder="https://your-site.com/landing" required />

              {/* Targeting picker */}
              <InterestPicker tags={tags} onChange={setTags} />

              {error && (
                <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  {error}
                </div>
              )}
            </form>

            {/* Preview column */}
            <aside className="bg-slate-50 p-5 md:sticky md:top-0 md:self-start md:max-h-[80vh] md:overflow-y-auto">
              <div className="flex items-center gap-1.5 mb-3">
                <Eye size={12} className="text-slate-400" />
                <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
                  Live preview · how readers will see it
                </p>
              </div>
              <AdInboxCard
                brand={brand}
                title={title}
                tagline={tagline}
                body={body}
                imageUrl={imageUrl}
                ctaLabel={ctaLabel}
                ctaUrl={ctaUrl}
                sharedInterests={tags}
              />
            </aside>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-full text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Save as draft"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LintWarnings({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {messages.map((m, i) => (
        <span
          key={`${i}-${m}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
        >
          <AlertTriangle size={9} className="shrink-0" />
          {m}
        </span>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  lint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  lint?: string[];
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400"
      />
      {lint && <LintWarnings messages={lint} />}
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  required,
  lint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  lint?: string[];
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
        <span>{label}</span>
        {maxLength && <span className="text-slate-400">{value.length}/{maxLength}</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        rows={4}
        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 resize-none"
      />
      {lint && <LintWarnings messages={lint} />}
    </div>
  );
}

function InterestPicker({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const atMax = tags.length >= MAX_TAGS;

  // Filter the suggestion list: omit already-selected + match prefix.
  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return COMMON_INTERESTS
      .filter((t) => !tags.includes(t))
      .filter((t) => (q.length === 0 ? true : t.startsWith(q)))
      .slice(0, 8);
  }, [draft, tags]);

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().slice(0, MAX_TAG_LEN);
    if (!t) return;
    if (tags.includes(t)) {
      setDraft("");
      return;
    }
    if (tags.length >= MAX_TAGS) return;
    onChange([...tags, t]);
    setDraft("");
  };

  const removeTag = (t: string) => {
    onChange(tags.filter((x) => x !== t));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (draft.trim().length > 0) addTag(draft);
    } else if (e.key === "Backspace" && draft.length === 0 && tags.length > 0) {
      // Quick delete: backspace on empty input pops the last tag.
      removeTag(tags[tags.length - 1]!);
    }
  };

  return (
    <div>
      <label className="text-[11px] font-semibold text-slate-500 mb-1 flex items-center justify-between">
        <span>Target interests</span>
        <span className="text-slate-400">{tags.length}/{MAX_TAGS}</span>
      </label>

      {/* Selected chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200"
            >
              {t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove ${t}`}
                className="ml-0.5 hover:text-purple-900"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Combobox input + Add button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_TAG_LEN))}
          onKeyDown={onKey}
          placeholder={atMax ? "Max 7 tags reached" : "Type an interest, then Enter…"}
          disabled={atMax}
          className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 disabled:opacity-60 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={() => addTag(draft)}
          disabled={atMax || draft.trim().length === 0}
          className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add
        </button>
      </div>

      {/* Suggestions */}
      {!atMax && suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-slate-400">
        Up to 7 tags · Rule of 7 · {MAX_TAG_LEN} chars per tag
      </p>
    </div>
  );
}

export default function BusinessAdsPage() {
  return (
    <AuthProvider>
      <BusinessAdsInner />
    </AuthProvider>
  );
}
