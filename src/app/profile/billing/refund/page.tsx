"use client";

// ---------------------------------------------------------------------------
// /profile/billing/refund — EU 14-day right of withdrawal (S-244, Tier C8).
//
// Lives on a dedicated route so the C7 agent's /profile/billing/page.tsx
// (subscription summary + portal link) and this page can ship in parallel
// without merge conflicts.
// ---------------------------------------------------------------------------

import { useState } from "react";
import Link from "next/link";

interface RefundResult {
  ok?: boolean;
  alreadyRefunded?: boolean;
  partial?: boolean;
  error?: string;
  message?: string;
  refund?: { id: string; amount: number; status: string };
  supportEmail?: string;
}

export default function RefundPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RefundResult | null>(null);
  const [signedOut, setSignedOut] = useState(false);

  async function requestRefund() {
    setResult(null);
    const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
    if (!token) {
      setSignedOut(true);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/billing/refund", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as RefundResult;
      // 503 with REFUND_LOOKUP_UNAVAILABLE is a known degraded state — surface
      // the support email so the user has a clear next step.
      setResult({ ...body, ok: res.ok && Boolean(body.ok) });
    } catch (e) {
      setResult({ error: "NETWORK", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto">
        <nav className="text-xs text-slate-500 mb-2">
          <Link href="/profile/billing" className="hover:text-slate-700">
            Billing
          </Link>
          <span className="mx-1">/</span>
          <span className="text-slate-700">Refund</span>
        </nav>
        <h1 className="text-2xl font-bold text-slate-900">Refund within 14 days</h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          EU consumers have a statutory right to a full refund within 14 days of
          purchase. Use the button below — refund is automatic, no questions
          asked.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {signedOut && (
            <p className="text-sm text-slate-600">
              You&apos;re not signed in. Please sign in to manage refunds.
            </p>
          )}

          {!signedOut && (
            <>
              <button
                type="button"
                onClick={() => void requestRefund()}
                disabled={busy}
                className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busy ? "Requesting refund…" : "Request refund"}
              </button>

              {result && (
                <div className="mt-4 text-sm">
                  {result.ok && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800">
                      Refund issued
                      {result.refund?.amount
                        ? ` (${(result.refund.amount / 100).toFixed(2)})`
                        : ""}
                      . Your subscription has been cancelled and your account
                      tier is back to basic.
                    </p>
                  )}
                  {result.alreadyRefunded && (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-slate-700">
                      This subscription was already refunded — nothing more to
                      do.
                    </p>
                  )}
                  {result.partial && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800">
                      Refund issued but the subscription cancel step failed.
                      Support has been notified —{" "}
                      <a
                        className="underline"
                        href={`mailto:${result.supportEmail ?? "support@copyme1.com"}`}
                      >
                        contact support
                      </a>{" "}
                      if you don&apos;t see the cancellation reflected within
                      24 hours.
                    </p>
                  )}
                  {!result.ok && !result.alreadyRefunded && !result.partial && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-rose-700">
                      {result.error === "OUT_OF_WINDOW" ? (
                        <p>
                          The 14-day refund window has expired for this
                          subscription. You can still cancel future renewals
                          from the billing portal.
                        </p>
                      ) : result.error === "NO_SUBSCRIPTION" ? (
                        <p>
                          You don&apos;t have a recent purchase eligible for
                          refund.
                        </p>
                      ) : result.error === "REFUND_LOOKUP_UNAVAILABLE" ? (
                        <p>
                          {result.message}{" "}
                          <a
                            className="underline"
                            href={`mailto:${result.supportEmail ?? "support@copyme1.com"}`}
                          >
                            Email support
                          </a>{" "}
                          and we&apos;ll process the refund manually within one
                          business day.
                        </p>
                      ) : (
                        <p>
                          {result.message ?? result.error ?? "Refund failed."}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Empty state — if you don&apos;t see a refund eligible message after
          requesting, you don&apos;t have a recent purchase eligible for
          refund.
        </p>
      </div>
    </main>
  );
}
