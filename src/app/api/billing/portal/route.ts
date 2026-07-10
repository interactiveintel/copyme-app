// POST /api/billing/portal — Stripe Customer Portal session (S-243).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appBase } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  // v4.16.33: resolve the Stripe customer id server-side from the signed-in
  // user. Previously the client had to POST a `cus_...` id — which the
  // billing page made the user hand-TYPE, so "Manage subscription"
  // dead-ended for every real user. The webhook persists stripeCustomerId
  // on upgrade, so we look it up here.
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { stripeCustomerId: true },
  });
  const customerId = user?.stripeCustomerId;
  if (!customerId) {
    // No Stripe customer means they've never subscribed.
    return NextResponse.json({ error: "NO_SUBSCRIPTION" }, { status: 404 });
  }

  const params = new URLSearchParams({
    customer: customerId,
    return_url: `${appBase()}/profile/billing`,
  });
  const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) return NextResponse.json({ error: "STRIPE_ERROR" }, { status: 502 });
  const session = await res.json();
  return NextResponse.json({ url: session.url });
}
