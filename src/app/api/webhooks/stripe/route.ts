import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { stripeWebhookConfigured, verifyStripeSignature } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
//
// Receives Stripe webhook events. Two flows live here:
//
//   1) Ad payments (mode=payment).
//      `checkout.session.completed` with metadata.adId → flip the ad from
//      `pending_payment` → `pending_review` so the admin queue picks it up.
//
//   2) Subscription upgrades (mode=subscription) — S-243.
//      `checkout.session.completed` with metadata.plan in {"pro","business"}
//      → bump the User row's accountTier:
//          pro      → business_3 (we don't have a `pro` enum, business_3 is
//                                 the smallest business tier; per S-243 it
//                                 is the storage slot for Pro until we
//                                 introduce a real `pro` enum value)
//          business → business_7
//      Idempotent: if the user is already at-or-above the requested tier,
//      we no-op (still 200 to stop Stripe from retrying).
//
// Public route — must be in middleware's PUBLIC_PREFIXES so it bypasses the
// Bearer-token check.
// ---------------------------------------------------------------------------

interface StripeCheckoutSessionEvent {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      mode?: string;
      payment_status?: string;
      client_reference_id?: string | null;
      metadata?: Record<string, string>;
    };
  };
}

// AccountTier rank — used for the idempotency check on subscription upgrades.
// Mirrors prisma/schema.prisma's AccountTier enum.
const TIER_RANK: Record<string, number> = {
  basic: 0,
  business_3: 1,
  business_7: 2,
  business_50: 3,
  ecommerce: 4,
};

function planToAccountTier(plan: string): "business_3" | "business_7" | null {
  if (plan === "pro") return "business_3";
  if (plan === "business") return "business_7";
  return null;
}

async function handleSubscriptionCheckout(
  session: StripeCheckoutSessionEvent["data"]["object"],
): Promise<NextResponse> {
  const userId = session.client_reference_id;
  const plan = session.metadata?.plan;
  if (!userId) {
    console.warn("[stripe webhook] subscription session missing client_reference_id");
    return NextResponse.json({ success: true, data: { ignored: "missing_user_id" } });
  }
  if (!plan) {
    console.warn("[stripe webhook] subscription session missing metadata.plan");
    return NextResponse.json({ success: true, data: { ignored: "missing_plan" } });
  }
  const targetTier = planToAccountTier(plan);
  if (!targetTier) {
    console.warn(`[stripe webhook] unknown plan '${plan}' on session ${session.id}`);
    return NextResponse.json({ success: true, data: { ignored: "unknown_plan" } });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, accountTier: true },
    });
    if (!user) {
      console.warn(`[stripe webhook] subscription session references unknown user ${userId}`);
      return NextResponse.json({ success: true, data: { ignored: "user_not_found" } });
    }

    const currentRank = TIER_RANK[user.accountTier] ?? 0;
    const targetRank = TIER_RANK[targetTier] ?? 0;
    if (currentRank >= targetRank) {
      console.log(
        `[stripe webhook] user ${userId} already at tier ${user.accountTier} >= target ${targetTier}; no-op`,
      );
      return NextResponse.json({
        success: true,
        data: { userId, plan, tier: user.accountTier, noop: true, eventType: "checkout.session.completed" },
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { accountTier: targetTier },
    });
    console.log(`[stripe webhook] user ${userId} upgraded to ${targetTier} (plan=${plan})`);
    return NextResponse.json({
      success: true,
      data: { userId, plan, tier: targetTier, eventType: "checkout.session.completed" },
    });
  } catch (error) {
    console.error("[stripe webhook] subscription update failed:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Subscription tier update failed" } },
      { status: 500 },
    );
  }
}

async function handleAdPaymentCheckout(
  session: StripeCheckoutSessionEvent["data"]["object"],
): Promise<NextResponse> {
  const adId = session.metadata?.adId;
  if (!adId) {
    console.warn("[stripe webhook] checkout.session.completed missing metadata.adId");
    return NextResponse.json({ success: true, data: { ignored: "missing_metadata" } });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ success: true, data: { ignored: "not_paid" } });
  }

  try {
    // Idempotent: if the ad has already moved past pending_payment, do nothing.
    const updated = await prisma.businessAd.updateMany({
      where: {
        id: adId,
        status: "pending_payment",
        stripeCheckoutId: session.id,
      },
      data: { status: "pending_review" },
    });

    return NextResponse.json({
      success: true,
      data: { adId, updated: updated.count, eventType: "checkout.session.completed" },
    });
  } catch (error) {
    console.error("[stripe webhook] update failed:", error);
    // Return 500 so Stripe retries — but only after logging.
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "DB write failed" } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  // Read the body as raw text BEFORE parsing — signature is computed over the
  // raw bytes Stripe sent, so any reformatting (e.g. JSON.parse + stringify)
  // would invalidate it.
  const rawBody = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!stripeWebhookConfigured()) {
    // Stripe is sending us events but we haven't set the secret. Log and
    // ignore; do NOT 500 (Stripe would retry forever).
    console.warn("[stripe webhook] STRIPE_WEBHOOK_SECRET not set; ignoring event");
    return NextResponse.json({ success: true, data: { ignored: "not_configured" } });
  }

  if (!verifyStripeSignature(rawBody, sig)) {
    return NextResponse.json(
      { success: false, error: { code: "BAD_SIGNATURE", message: "Invalid Stripe signature" } },
      { status: 401 },
    );
  }

  let event: StripeCheckoutSessionEvent;
  try {
    event = JSON.parse(rawBody) as StripeCheckoutSessionEvent;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_JSON", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  // We only act on checkout.session.completed for now. Returning 200 on
  // unknown types is the right move — Stripe stops retrying once we ack.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ success: true, data: { ignored: event.type } });
  }

  const session = event.data.object;

  // S-243 — subscription mode bumps the user's accountTier. Ad-payment
  // sessions stay on the existing branch.
  if (session.mode === "subscription") {
    return handleSubscriptionCheckout(session);
  }
  return handleAdPaymentCheckout(session);
}
