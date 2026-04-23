import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { createCheckoutSession, isStripeConfigured } from "@/lib/stripe";

// ---------------------------------------------------------------------------
// POST /api/business/ads/:id/checkout
//
// Creates a Stripe Checkout Session for the given ad. Caller must own the
// ad. On success, returns the Stripe Checkout URL — the client redirects
// the buyer there. Stripe webhook (POST /api/webhooks/stripe) flips the ad
// to `pending_review` once payment succeeds.
//
// Returns 503 with NOT_CONFIGURED when STRIPE_SECRET_KEY is unset, so the
// /business UI can hide the "Pay" button or show a clear message.
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "Payments are not configured on this deployment.",
        },
      },
      { status: 503 },
    );
  }

  const { id: adId } = await params;
  if (!adId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "ad id required" } },
      { status: 400 },
    );
  }

  try {
    const ad = await prisma.businessAd.findUnique({ where: { id: adId } });
    if (!ad) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Ad not found" } },
        { status: 404 },
      );
    }
    if (ad.ownerId !== auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not your ad" } },
        { status: 403 },
      );
    }
    if (ad.status !== "draft") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_STATE",
            message: `Ad is in status '${ad.status}', not 'draft'. Cannot start checkout.`,
          },
        },
        { status: 409 },
      );
    }

    const session = await createCheckoutSession({
      productName: `CopyMe ad: ${ad.title}`,
      amountMicroUsd: ad.priceMicroUsd,
      metadata: { adId: ad.id, ownerId: ad.ownerId },
      successPath: "/business/ads",
      cancelPath: "/business/ads",
    });

    // Stash the Stripe session id + flip status so we can correlate the webhook.
    await prisma.businessAd.update({
      where: { id: ad.id },
      data: { stripeCheckoutId: session.id, status: "pending_payment" },
    });

    return NextResponse.json({
      success: true,
      data: { checkoutUrl: session.url, sessionId: session.id },
    });
  } catch (error) {
    console.error("[ads/checkout] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to start checkout. Try again in a moment.",
        },
      },
      { status: 500 },
    );
  }
}
