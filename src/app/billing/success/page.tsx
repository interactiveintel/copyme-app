"use client";

// S-243 — Post-checkout landing page.
//
// Stripe sends the buyer here once payment completes:
//   /billing/success?session_id=cs_test_xxx
//
// The actual tier flip happens server-side in the webhook handler
// (see src/app/api/webhooks/stripe/route.ts). This page is purely a
// confirmation surface — we optionally hit /api/billing/verify-session
// to read the resulting plan back from Stripe so the headline is right.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react";

interface VerifyResponse {
  plan?: "pro" | "business";
  status?: string;
}

function SuccessInner() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [planLabel, setPlanLabel] = useState<string>("your new plan");
  const [verifying, setVerifying] = useState<boolean>(true);

  useEffect(() => {
    if (!sessionId) {
      setVerifying(false);
      return;
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("copyme.access") : null;
    if (!token) {
      setVerifying(false);
      return;
    }
    fetch(`/api/billing/verify-session?session_id=${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => (r.ok ? ((await r.json()) as VerifyResponse) : null))
      .then((data) => {
        if (data?.plan === "pro") setPlanLabel("Pro");
        else if (data?.plan === "business") setPlanLabel("Business");
      })
      .catch(() => {
        // Verification is decorative — webhook does the real work.
      })
      .finally(() => setVerifying(false));
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/40 flex items-center">
      <div className="mx-auto max-w-md w-full px-4 sm:px-6 py-16">
        <div className="rounded-3xl border border-emerald-200 bg-white shadow-xl p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {verifying ? (
              <span className="inline-flex items-center gap-2 text-slate-700">
                <Loader2 size={18} className="animate-spin" /> Confirming...
              </span>
            ) : (
              <>You&rsquo;re upgraded to {planLabel}</>
            )}
          </h1>

          <p className="mt-3 text-sm text-slate-500 leading-relaxed">
            We&rsquo;re activating your benefits — they&rsquo;ll appear within a minute.
            You can keep using CopyMe right now; the new caps unlock as soon as
            our system catches the confirmation from Stripe.
          </p>

          <Link
            href="/app"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:shadow-[0_0_30px_rgba(124,58,237,0.4)] transition-shadow"
          >
            Open CopyMe <ArrowRight size={14} />
          </Link>

          {sessionId && (
            <p className="mt-6 text-[10px] text-slate-400 break-all">
              Receipt ref: {sessionId}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Need help? <Link href="/profile/billing" className="underline hover:text-slate-600">Manage subscription</Link>
        </p>
      </div>
    </main>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-slate-400" />
        </main>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
