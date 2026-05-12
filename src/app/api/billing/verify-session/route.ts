// GET /api/billing/verify-session?session_id=cs_xxx — S-243.
//
// Reads a Checkout Session from Stripe and returns the resulting plan
// (pulled from session.metadata.plan, set by /api/billing/checkout).
// This is a read-only "what did I just buy?" lookup for the success
// page — the actual tier flip happens in the webhook handler.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "MISSING_SESSION_ID" }, { status: 400 });
  }
  // Cheap shape guard so we never forward garbage to Stripe.
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
    return NextResponse.json({ error: "BAD_SESSION_ID" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "STRIPE_ERROR", detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  const session = (await res.json()) as {
    id: string;
    mode?: string;
    payment_status?: string;
    status?: string;
    client_reference_id?: string | null;
    metadata?: Record<string, string>;
  };

  // Defense in depth: ensure the session belongs to the calling user.
  // (The webhook is the source of truth; this just protects /verify-session
  // from being a generic Stripe-metadata oracle.)
  if (session.client_reference_id && session.client_reference_id !== auth.userId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json({
    sessionId: session.id,
    mode: session.mode ?? null,
    status: session.status ?? null,
    paymentStatus: session.payment_status ?? null,
    plan: session.metadata?.plan ?? null,
    period: session.metadata?.period ?? null,
  });
}
