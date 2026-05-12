// GET /api/admin/billing/refunds — refund queue audit list (S-244, Tier C8).
//
// Pulls the most recent refunds from Stripe and joins them by Stripe customer
// id back to the local User row. Until the User model carries a stored Stripe
// customer id (no schema change permitted in this sprint), the join column
// is empty and rows render with a "user lookup pending" placeholder — that
// is intentional, the UI handles the null case.
//
// Admin-gated via the same allowlist as /api/admin/{ruleof7,reports}.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { reportError } from "@/lib/observability";

export const runtime = "nodejs";

interface StripeRefund {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  charge: string | null;
  payment_intent: string | null;
  reason: string | null;
}

interface StripeListResponse<T> {
  object: "list";
  data: T[];
  has_more: boolean;
}

export interface RefundRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  reason: string | null;
  /** Local user display name; null when the join can't be resolved. */
  userDisplayName: string | null;
  /** Plan label if we can derive it (currently null — needs customerId join). */
  plan: string | null;
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    // Same shape as other 503s; keep the UI calm.
    return NextResponse.json(
      { error: "STRIPE_NOT_CONFIGURED", refunds: [] },
      { status: 503 },
    );
  }

  // Stripe pagination cursor — we accept ?starting_after=re_xxx for "next page".
  const startingAfter = req.nextUrl.searchParams.get("starting_after");
  const qs = new URLSearchParams({ limit: "100" });
  if (startingAfter) qs.set("starting_after", startingAfter);

  let listRes: Response;
  try {
    listRes = await fetch(`https://api.stripe.com/v1/refunds?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
  } catch (e) {
    reportError(e, { context: "admin.refunds.list_fetch" });
    return NextResponse.json({ error: "STRIPE_NETWORK", refunds: [] }, { status: 502 });
  }

  if (!listRes.ok) {
    const text = await listRes.text().catch(() => "");
    reportError(new Error("stripe.refunds_list_failed"), {
      context: "admin.refunds.list",
      status: listRes.status,
      detail: text.slice(0, 200),
    });
    return NextResponse.json(
      { error: "STRIPE_ERROR", detail: text.slice(0, 200), refunds: [] },
      { status: 502 },
    );
  }

  const list = (await listRes.json()) as StripeListResponse<StripeRefund>;

  // The User row currently has no `stripeCustomerId` column, so we can't
  // resolve display names yet. Render Stripe's view + a "user lookup
  // pending" placeholder. When the schema migration lands, the join would
  // hang off `prisma.user.findMany({ where: { stripeCustomerId: { in: [...] } } })`
  // and populate userDisplayName / plan inline.
  const refunds: RefundRow[] = list.data.map((r) => ({
    id: r.id,
    amount: r.amount,
    currency: r.currency,
    status: r.status,
    createdAt: new Date(r.created * 1000).toISOString(),
    reason: r.reason,
    userDisplayName: null,
    plan: null,
  }));

  return NextResponse.json({
    refunds,
    hasMore: list.has_more,
    nextCursor: list.has_more && refunds.length > 0 ? refunds[refunds.length - 1].id : null,
    notes: [
      "User lookup is pending: a future schema migration will store stripeCustomerId on User.",
      "Stripe pagination: pass ?starting_after=<refund_id> for the next page.",
    ],
  });
}
