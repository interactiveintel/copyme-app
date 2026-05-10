// POST /api/billing/portal — Stripe Customer Portal session (S-243).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  const { customerId } = await req.json();
  if (!customerId) return NextResponse.json({ error: "MISSING_CUSTOMER" }, { status: 400 });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return NextResponse.json({ error: "STRIPE_NOT_CONFIGURED" }, { status: 503 });

  const params = new URLSearchParams({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/profile/billing`,
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
