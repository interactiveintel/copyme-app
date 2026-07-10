// ---------------------------------------------------------------------------
// Stripe checkout — env-gated.
//
// Direct fetch to Stripe's REST API rather than installing the Stripe SDK.
// Same pattern as src/lib/mailer.ts (Resend) and src/lib/push.ts (web push):
// keep the dependency surface minimal and degrade to a clear 503 when not
// configured.
//
// Required env vars (Vercel → Production):
//   STRIPE_SECRET_KEY        sk_live_... or sk_test_... (test mode is fine)
//   STRIPE_WEBHOOK_SECRET    whsec_... — used to verify webhook signatures
//   NEXT_PUBLIC_APP_URL      base URL for success/cancel redirects (optional;
//                            falls back to https://copyme1.com)
// ---------------------------------------------------------------------------

import { createHmac, timingSafeEqual } from "crypto";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

// Exported (v4.16.33) so the subscription checkout route uses the same
// absolute-URL fallback as the rest of the billing lib. Stripe rejects
// relative success/cancel URLs, so an empty NEXT_PUBLIC_APP_URL must
// still resolve to a real host.
export function appBase(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "https://copyme1.com";
}

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export interface CreateCheckoutInput {
  /** Description shown to the buyer on Stripe's checkout page. */
  productName: string;
  /** Cost in micro-USD (we store all money as micro-USD internally). */
  amountMicroUsd: number;
  /** Free-form metadata stored on the Stripe Session and echoed back in the webhook. */
  metadata: Record<string, string>;
  /** Where Stripe sends the buyer after success. We append ?session_id=... */
  successPath: string;
  cancelPath: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/**
 * Create a Stripe Checkout Session for a one-time payment. Returns the
 * URL we redirect the buyer to.
 */
export async function createCheckoutSession(input: CreateCheckoutInput): Promise<CheckoutSession> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY not set)");
  }
  // Stripe API takes whole-cents. Convert micro-USD → cents (truncate down,
  // never overcharge a fractional cent).
  const cents = Math.max(50, Math.floor(input.amountMicroUsd / 10_000));

  const base = appBase();
  // Build x-www-form-urlencoded body — Stripe expects nested params via
  // bracket notation (e.g. line_items[0][quantity]).
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("payment_method_types[0]", "card");
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(cents));
  body.set("line_items[0][price_data][product_data][name]", input.productName);
  body.set("success_url", `${base}${input.successPath}?session_id={CHECKOUT_SESSION_ID}`);
  body.set("cancel_url", `${base}${input.cancelPath}`);
  for (const [k, v] of Object.entries(input.metadata)) {
    body.set(`metadata[${k}]`, v);
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe checkout failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

// ---------------------------------------------------------------------------
// Webhook signature verification (Stripe uses HMAC-SHA256 with timestamp).
//
// The Stripe-Signature header looks like:
//     t=1492774577,v1=5257a869e...,v0=...
// We verify by signing `${t}.${rawBody}` with the webhook secret and
// constant-time comparing to the v1 value.
// ---------------------------------------------------------------------------

const WEBHOOK_TOLERANCE_SECS = 300;

export function verifyStripeSignature(rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return false;

  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const idx = p.indexOf("=");
      return idx > 0 ? [p.slice(0, idx), p.slice(idx + 1)] : [p, ""];
    }),
  );
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  // Replay protection — reject signatures older than 5 minutes.
  const ts = Number(t);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > WEBHOOK_TOLERANCE_SECS) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  // timingSafeEqual requires equal-length buffers; bail early on mismatch.
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}
