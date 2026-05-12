// POST /api/billing/cancel — cancel the caller's Stripe subscription (S-243).
//
// Body shape (one of the two):
//   { subscriptionId: "sub_xxx" }
//   { customerId: "cus_xxx" }   // we'll resolve the most-recent active sub
//
// Note: the User row doesn't carry stripeCustomerId today (no schema
// changes per the sprint plan). The frontend reads the id from a Customer
// Portal session or asks the user to copy it; for now this endpoint just
// proxies the cancel call so the wiring is in place. The webhook will
// eventually downgrade `accountTier` back to `basic` when Stripe sends
// `customer.subscription.deleted` (a follow-up task).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

interface CancelBody {
  subscriptionId?: string;
  customerId?: string;
  /** "now" (default) deletes immediately, "period_end" cancels at term. */
  when?: "now" | "period_end";
}

async function listLatestActiveSubscription(
  stripeKey: string,
  customerId: string,
): Promise<string | null> {
  const url =
    `https://api.stripe.com/v1/subscriptions?customer=${encodeURIComponent(customerId)}` +
    `&status=active&limit=1`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${stripeKey}` } });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: Array<{ id: string }> };
  return data.data?.[0]?.id ?? null;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as CancelBody;
  let subscriptionId = body.subscriptionId;

  if (!subscriptionId && body.customerId) {
    subscriptionId = (await listLatestActiveSubscription(stripeKey, body.customerId)) ?? undefined;
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "NO_ACTIVE_SUBSCRIPTION", hint: "Pass subscriptionId or customerId" },
      { status: 400 },
    );
  }

  // "period_end" is just a flag-update; "now" requires a DELETE.
  const when = body.when ?? "now";

  if (when === "period_end") {
    const params = new URLSearchParams({ cancel_at_period_end: "true" });
    const res = await fetch(
      `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "STRIPE_ERROR", detail: text.slice(0, 200) },
        { status: 502 },
      );
    }
    return NextResponse.json({ subscriptionId, scheduled: "period_end" });
  }

  // when === "now"
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${stripeKey}` } },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "STRIPE_ERROR", detail: text.slice(0, 200) },
      { status: 502 },
    );
  }

  // Tier flip back to "basic" is handled by the webhook on
  // customer.subscription.deleted (follow-up task).
  return NextResponse.json({ subscriptionId, canceled: true });
}
