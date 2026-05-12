// POST /api/billing/refund — EU 14-day right of withdrawal (S-244, Tier C8).
//
// EU consumers have a statutory right to a full refund within 14 days of
// purchasing a digital subscription, unless they explicitly waived it at
// checkout (handled in /api/billing/checkout via metadata.deferActivation).
//
// Flow:
//   1. Find the user's most recent paid subscription. We don't yet store the
//      Stripe customer id on the User row — until the schema change lands,
//      we gracefully degrade with 503 + a support email.
//   2. Verify the purchase date is within the 14-day window.
//   3. Call Stripe POST /v1/refunds against the payment intent / charge.
//   4. Cancel the subscription via Stripe DELETE /v1/subscriptions/<id>.
//   5. Drop the user back to the basic tier and log a breadcrumb.
//
// Idempotent: if a refund already exists for the subscription's payment, we
// return 200 with { alreadyRefunded: true } so the UI can render a calm
// "already refunded" state instead of an error.
//
// Auth: Bearer access token (same as the rest of /api/billing/*).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addBreadcrumb, reportError } from "@/lib/observability";

export const runtime = "nodejs";

// 14 days in ms — the EU statutory window.
const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// Plain-text fallback when we can't run the automated flow. Mirrors the
// support address used elsewhere (see footer copy and mailer.ts).
const SUPPORT_EMAIL = "support@copyme1.com";

interface StripeListResponse<T> {
  object: "list";
  data: T[];
  has_more: boolean;
}

interface StripeSubscription {
  id: string;
  status: string;
  created: number;
  latest_invoice?: string | { id: string; payment_intent?: string | null; charge?: string | null };
  customer: string;
}

interface StripeInvoice {
  id: string;
  payment_intent?: string | null;
  charge?: string | null;
}

interface StripeRefund {
  id: string;
  amount: number;
  status: string;
  charge?: string | null;
  payment_intent?: string | null;
}

/** Minimal x-www-form-urlencoded helper that mirrors checkout/route.ts. */
function form(params: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, v);
  return body;
}

async function stripeFetch(
  path: string,
  init: { method: "GET" | "POST" | "DELETE"; body?: URLSearchParams; key: string },
): Promise<Response> {
  const url = `https://api.stripe.com/v1/${path}`;
  return fetch(url, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${init.key}`,
      ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: init.body?.toString(),
  });
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  // Look up the user — we need their tier (to drop back to basic) and,
  // ideally, a stored Stripe customer id. Until the schema change ships,
  // we don't have customerId on the User row, so we gracefully degrade.
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, accountTier: true },
  });
  if (!user) {
    return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 });
  }

  // The User model does not currently store a Stripe customer id (no schema
  // change is permitted in this sprint — see prisma/schema.prisma). Without
  // it we can't safely look up the right subscription on Stripe, so we
  // degrade with a clear 503 directing the user to support.
  const customerId: string | null = null;
  if (!customerId) {
    return NextResponse.json(
      {
        error: "REFUND_LOOKUP_UNAVAILABLE",
        message:
          "Refund flow requires Stripe customer ID lookup, not yet stored on User row — manual support@copyme1.com.",
        supportEmail: SUPPORT_EMAIL,
      },
      { status: 503 },
    );
  }

  // ---- Below is unreachable until the User row carries `stripeCustomerId`,
  // ---- but we wire the full flow so the moment that field is added the
  // ---- endpoint is functional. The shape mirrors what S-244's spec asks for.

  // 1. Find the most recent subscription for this customer.
  const subsRes = await stripeFetch(
    `subscriptions?customer=${encodeURIComponent(customerId as string)}&limit=1&status=all`,
    { method: "GET", key: stripeKey },
  );
  if (!subsRes.ok) {
    const text = await subsRes.text().catch(() => "");
    reportError(new Error("stripe.subscriptions_list_failed"), {
      context: "billing.refund",
      status: subsRes.status,
      detail: text.slice(0, 200),
    });
    return NextResponse.json({ error: "STRIPE_ERROR", detail: text.slice(0, 200) }, { status: 502 });
  }
  const subs = (await subsRes.json()) as StripeListResponse<StripeSubscription>;
  const sub = subs.data[0];
  if (!sub) {
    return NextResponse.json(
      { error: "NO_SUBSCRIPTION", message: "No paid subscription found for this account." },
      { status: 404 },
    );
  }

  // 2. Window check — Stripe `created` is unix seconds.
  const purchaseMs = sub.created * 1000;
  const ageMs = Date.now() - purchaseMs;
  if (ageMs > REFUND_WINDOW_MS) {
    return NextResponse.json(
      {
        error: "OUT_OF_WINDOW",
        message: "The 14-day refund window has expired for this subscription.",
        purchasedAt: new Date(purchaseMs).toISOString(),
      },
      { status: 400 },
    );
  }

  // Resolve the payment intent / charge from the latest invoice. Stripe
  // returns either an inline object (when expanded) or a string id, so we
  // tolerate both — cheaper than always sending `expand[]`.
  let paymentIntentId: string | null = null;
  let chargeId: string | null = null;
  if (sub.latest_invoice && typeof sub.latest_invoice === "object") {
    paymentIntentId = sub.latest_invoice.payment_intent ?? null;
    chargeId = sub.latest_invoice.charge ?? null;
  } else if (typeof sub.latest_invoice === "string") {
    const invRes = await stripeFetch(`invoices/${sub.latest_invoice}`, {
      method: "GET",
      key: stripeKey,
    });
    if (invRes.ok) {
      const inv = (await invRes.json()) as StripeInvoice;
      paymentIntentId = inv.payment_intent ?? null;
      chargeId = inv.charge ?? null;
    }
  }

  if (!paymentIntentId && !chargeId) {
    return NextResponse.json(
      { error: "NO_PAYMENT", message: "Could not locate the original payment to refund." },
      { status: 400 },
    );
  }

  // 2.5. Idempotency — if Stripe already shows a refund for this charge /
  // payment intent, treat the request as a no-op success. This protects
  // against double-clicks and webhook retries.
  const refundLookupQs = paymentIntentId
    ? `payment_intent=${encodeURIComponent(paymentIntentId)}`
    : `charge=${encodeURIComponent(chargeId as string)}`;
  const existingRes = await stripeFetch(`refunds?${refundLookupQs}&limit=1`, {
    method: "GET",
    key: stripeKey,
  });
  if (existingRes.ok) {
    const existing = (await existingRes.json()) as StripeListResponse<StripeRefund>;
    if (existing.data.length > 0) {
      return NextResponse.json({ alreadyRefunded: true, refund: existing.data[0] });
    }
  }

  // 3. Issue the refund. Prefer payment_intent — it's the modern Stripe
  // pointer and survives Charge → PaymentIntent migration cleanly.
  const refundBody = form(
    paymentIntentId ? { payment_intent: paymentIntentId } : { charge: chargeId as string },
  );
  const refundRes = await stripeFetch("refunds", {
    method: "POST",
    body: refundBody,
    key: stripeKey,
  });
  if (!refundRes.ok) {
    const text = await refundRes.text().catch(() => "");
    reportError(new Error("stripe.refund_failed"), {
      context: "billing.refund",
      status: refundRes.status,
      detail: text.slice(0, 200),
    });
    return NextResponse.json({ error: "STRIPE_ERROR", detail: text.slice(0, 200) }, { status: 502 });
  }
  const refund = (await refundRes.json()) as StripeRefund;

  // 4. Cancel the subscription. Stripe's REST DELETE is the equivalent of
  // SDK `stripe.subscriptions.del()` — immediate cancellation.
  const cancelRes = await stripeFetch(`subscriptions/${sub.id}`, {
    method: "DELETE",
    key: stripeKey,
  });
  if (!cancelRes.ok) {
    // Refund already went through; surface the cancel failure but don't
    // pretend the whole flow rolled back.
    const text = await cancelRes.text().catch(() => "");
    reportError(new Error("stripe.subscription_cancel_failed"), {
      context: "billing.refund",
      status: cancelRes.status,
      detail: text.slice(0, 200),
      refundId: refund.id,
    });
    return NextResponse.json(
      {
        partial: true,
        refund,
        error: "CANCEL_FAILED",
        message: "Refund issued but failed to cancel the subscription. Support has been notified.",
      },
      { status: 502 },
    );
  }

  // 5. Drop the user back to basic + breadcrumb.
  await prisma.user.update({
    where: { id: user.id },
    data: { accountTier: "basic" },
  }).catch((e) => reportError(e, { context: "billing.refund.tier_reset", userId: user.id }));

  addBreadcrumb("billing.refund_completed", {
    userId: user.id,
    subscriptionId: sub.id,
    refundId: refund.id,
    amountCents: refund.amount,
  });

  return NextResponse.json({
    ok: true,
    refund,
    subscriptionId: sub.id,
    purchasedAt: new Date(purchaseMs).toISOString(),
  });
}
