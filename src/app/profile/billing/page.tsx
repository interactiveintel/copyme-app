"use client";

// S-243 — Profile › Billing.
//
// Auth-gated page that:
//   * Shows the user's current plan (read from /api/users/me)
//   * "Manage subscription" → POST /api/billing/portal, redirect to Stripe
//   * "Downgrade to Free"   → POST /api/billing/cancel
//
// Auth pattern matches /admin/ruleof7: `localStorage.copyme.access`.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, ArrowRight, Loader2, AlertTriangle } from "lucide-react";

interface MeResponse {
  success: boolean;
  data?: { id: string; displayName: string; accountTier: string };
}

type PlanLabel = "Free" | "Pro" | "Business" | "Enterprise";

function planLabelFromDb(dbTier: string | undefined | null): PlanLabel {
  if (!dbTier) return "Free";
  if (dbTier === "ecommerce") return "Enterprise";
  if (dbTier === "business_3") return "Pro";
  if (dbTier.startsWith("business")) return "Business";
  return "Free";
}

export default function ProfileBillingPage() {
  const router = useRouter();
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"portal" | "cancel" | null>(null);
  // Stripe customer id is currently NOT persisted on the User row (no schema
  // changes per the sprint plan). The Manage / Cancel actions therefore ask
  // the user for it inline. Once we add `stripeCustomerId` we can drop this.
  const [customerId, setCustomerId] = useState<string>("");

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
    if (!token) {
      router.replace("/signup?next=/profile/billing");
      return;
    }
    fetch("/api/users/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/signup?next=/profile/billing");
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as MeResponse;
      })
      .then((data) => {
        if (!data) return;
        setTier(data.data?.accountTier ?? "basic");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [router]);

  async function openPortal() {
    setError(null);
    if (!customerId) {
      setError("Enter your Stripe customer id (cus_...) to open the portal.");
      return;
    }
    const token = localStorage.getItem("copyme.access");
    if (!token) {
      router.replace("/signup?next=/profile/billing");
      return;
    }
    setBusy("portal");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerId }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Portal failed: ${res.status} ${text.slice(0, 120)}`);
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Stripe did not return a portal URL.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open portal");
      setBusy(null);
    }
  }

  async function downgradeToFree() {
    setError(null);
    if (!customerId) {
      setError("Enter your Stripe customer id to cancel your subscription.");
      return;
    }
    if (!window.confirm("Cancel your paid plan and return to Free? This takes effect immediately.")) {
      return;
    }
    const token = localStorage.getItem("copyme.access");
    if (!token) {
      router.replace("/signup?next=/profile/billing");
      return;
    }
    setBusy("cancel");
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customerId, when: "now" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Cancel failed: ${res.status} ${text.slice(0, 120)}`);
      }
      // Optimistic UI — webhook will catch up server-side.
      setTier("basic");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setBusy(null);
    }
  }

  const plan = planLabelFromDb(tier);
  const onPaid = plan === "Pro" || plan === "Business" || plan === "Enterprise";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/40">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="mb-8">
          <Link href="/app" className="text-xs text-slate-500 hover:text-slate-700">
            &larr; Back to CopyMe
          </Link>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your subscription, payment method, and invoices.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <Loader2 size={20} className="animate-spin mx-auto text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">Loading your account...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Current plan card */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white flex items-center justify-center">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Current plan</p>
                    <p className="text-xl font-bold text-slate-900">{plan}</p>
                  </div>
                </div>
                {!onPaid && (
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                  >
                    Upgrade <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Manage subscription */}
            <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Manage subscription</h2>
              <p className="mt-1 text-sm text-slate-500">
                Update payment method, change plan, or download invoices in Stripe&rsquo;s
                customer portal.
              </p>

              <label className="mt-4 block text-xs font-medium text-slate-600">
                Stripe customer id
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value.trim())}
                placeholder="cus_..."
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                Look this up on a Stripe receipt email — we&rsquo;ll auto-link it once we
                ship customer-id storage in a follow-up task.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-wait"
                >
                  {busy === "portal" ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Opening...
                    </>
                  ) : (
                    <>
                      Manage subscription <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Downgrade */}
            {onPaid && (
              <div className="rounded-3xl border border-slate-200 bg-white shadow-sm p-6">
                <h2 className="text-lg font-semibold text-slate-900">Downgrade to Free</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cancels your paid subscription. Your contacts and message history stay,
                  but you&rsquo;ll be subject to the Free tier&rsquo;s caps (7 contacts, 70-word
                  messages, 7 messages retained per contact).
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={downgradeToFree}
                    disabled={busy !== null}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-rose-700 border border-rose-200 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-wait"
                  >
                    {busy === "cancel" ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Canceling...
                      </>
                    ) : (
                      "Downgrade to Free"
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
