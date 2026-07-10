// POST /api/billing/checkout — start a Stripe subscription checkout (S-243).
// Body: { plan: "pro" | "business", period: "monthly" | "annual",
//          waiveCancellation?: boolean (EU 14-day right) }

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { appBase } from "@/lib/stripe";

export const runtime = "nodejs";

const PRICE_TABLE: Record<string, string | undefined> = {
  "pro:monthly":      process.env.STRIPE_PRICE_PRO_MONTHLY,
  "pro:annual":       process.env.STRIPE_PRICE_PRO_ANNUAL,
  "business:monthly": process.env.STRIPE_PRICE_BUSINESS_MONTHLY,
  "business:annual":  process.env.STRIPE_PRICE_BUSINESS_ANNUAL,
};

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  const { plan, period, waiveCancellation, countryIso2 } = await req.json();
  const key = `${plan}:${period}`;
  const priceId = PRICE_TABLE[key];
  if (!priceId) {
    return NextResponse.json({ error: "PLAN_NOT_AVAILABLE" }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
  }

  // EU: 14-day right of withdrawal. If the user is in the EU and *hasn't*
  // explicitly waived (S-244), we annotate the session metadata so the
  // webhook handler defers activation until day 14.
  const isEu = ["at","be","bg","hr","cy","cz","dk","ee","fi","fr","de","gr","hu",
    "ie","it","lv","lt","lu","mt","nl","pl","pt","ro","sk","si","es","se"]
    .includes(String(countryIso2 ?? "").toLowerCase());
  const deferActivation = isEu && !waiveCancellation;

  // v4.16.33: absolute URLs via the shared appBase() fallback. Stripe
  // 400s on relative URLs, so an empty NEXT_PUBLIC_APP_URL used to make
  // session creation fail with a 502 before checkout even opened.
  const base = appBase();

  const params = new URLSearchParams();
  params.append("mode", "subscription");
  params.append("line_items[0][price]", priceId);
  params.append("line_items[0][quantity]", "1");
  params.append("client_reference_id", auth.userId);
  params.append("success_url", `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${base}/pricing?canceled=1`);
  params.append("metadata[plan]", plan);
  params.append("metadata[period]", period);
  params.append("metadata[deferActivation]", String(deferActivation));
  // v4.16.33: Stripe Tax hard-fails session creation (→502) unless Tax
  // is configured on the account (origin address + registrations). Gate
  // it behind an env flag so checkout works out of the box; flip
  // STRIPE_AUTOMATIC_TAX=1 once Tax is set up in the dashboard.
  if (process.env.STRIPE_AUTOMATIC_TAX === "1" || process.env.STRIPE_AUTOMATIC_TAX === "true") {
    params.append("automatic_tax[enabled]", "true");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return NextResponse.json({ error: "STRIPE_ERROR", detail: text.slice(0, 200) }, { status: 502 });
  }
  const session = await res.json();
  // Touch user row so the dashboard knows a checkout is in flight.
  await prisma.user.update({
    where: { id: auth.userId },
    data: { lastActivityAt: new Date() },
  }).catch(() => undefined);

  return NextResponse.json({ url: session.url, sessionId: session.id });
}
