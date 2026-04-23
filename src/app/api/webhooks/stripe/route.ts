import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { stripeWebhookConfigured, verifyStripeSignature } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// POST /api/webhooks/stripe
//
// Receives Stripe webhook events. We only act on `checkout.session.completed`
// — that's our signal that the ad's $1 payment cleared. We then flip the
// ad from `pending_payment` → `pending_review` so the admin queue picks it
// up. Approval (separate human step in /admin/ads) flips it to `approved`
// and stamps `activatedAt`.
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
      payment_status?: string;
      metadata?: Record<string, string>;
    };
  };
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

  // We only handle the one event type for now. Returning 200 on unknown
  // types is the right move — Stripe stops retrying once we ack.
  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ success: true, data: { ignored: event.type } });
  }

  const session = event.data.object;
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
      data: { adId, updated: updated.count, eventType: event.type },
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
