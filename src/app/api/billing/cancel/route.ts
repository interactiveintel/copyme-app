// POST /api/billing/cancel — cancel the caller's Stripe subscription (S-243).
//
// Body shape (all fields optional now that we persist the IDs server-side):
//   { subscriptionId?: "sub_xxx", customerId?: "cus_xxx", when?: "now"|"period_end" }
//
// Resolution order for the subscription id:
//   1. body.subscriptionId           (caller knows it)
//   2. user.stripeSubscriptionId     (persisted by checkout webhook — C8)
//   3. body.customerId → list active subs from Stripe
//   4. user.stripeCustomerId → list active subs from Stripe
//
// On successful cancel we DON'T touch the User row's tier directly — the
// `customer.subscription.deleted` webhook does that, so both paths converge
// on a single source of truth.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  // Fall back to the persisted ids before going to Stripe — the User row is
  // authoritative for the active subscription once C8 lands.
  if (!subscriptionId) {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { stripeSubscriptionId: true, stripeCustomerId: true },
    });
    if (user?.stripeSubscriptionId) {
      subscriptionId = user.stripeSubscriptionId;
    } else {
      const customerId = body.customerId ?? user?.stripeCustomerId ?? null;
      if (customerId) {
        subscriptionId = (await listLatestActiveSubscription(stripeKey, customerId)) ?? undefined;
      }
    }
  }

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "NO_ACTIVE_SUBSCRIPTION", hint: "No subscription on file for this account." },
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
