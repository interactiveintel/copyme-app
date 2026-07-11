// GET /api/cron/messages-retention — v4.16.3 (Tier F6b).
//
// Nightly per-pair sweep that hard-deletes 1:1 messages older than
// the pair's effective retention window. Per-send pruning in
// /api/messages/send only fires when SOMEONE sends a new message,
// so idle conversations on paid tiers would otherwise hold messages
// past their advertised window. This sweep closes that gap.
//
// Strategy (per-pair, max-policy-wins):
//   1. Pull every user's tier in one query (small table).
//   2. SELECT DISTINCT pair (sender, receiver) across the messages
//      table (ordered as LEAST, GREATEST so each pair appears once).
//   3. For each pair, compute the effective policy =
//      max(retentionPolicy(a), retentionPolicy(b)).
//   4. Skip count-mode pairs (Basic↔Basic) — per-send already enforces.
//   5. For time-mode pairs, deleteMany where createdAt < cutoff.
//
// Cost: O(distinct pairs) Prisma calls per night. At early-stage
// scale (low hundreds of pairs) this is fine. If we cross ~5k pairs
// it's worth batching pairs of the same policy into a single query.
//
// Auth: identical pattern to /api/cron/calls-retention — Bearer
// CRON_SECRET OR x-vercel-cron header. NODE_ENV !== production
// disables auth so local tests can hit it directly.

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  retentionPolicy,
  maxRetention,
  cutoffFor,
} from "@/lib/messages-retention";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isCronAuthorized(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  // v4.16.34: dropped the spoofable `x-vercel-cron: 1` fallback — this
  // cron deletes messages past the retention window. Vercel sends
  // Bearer CRON_SECRET (checked above).
  return false;
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN" } },
      { status: 403 },
    );
  }

  try {
    // Load every user's tier into a Map for O(1) lookup per pair.
    const users = await prisma.user.findMany({
      select: { id: true, accountTier: true },
    });
    const tierByUser = new Map<string, string>(
      users.map((u) => [u.id, u.accountTier]),
    );

    // Distinct 1:1 pairs across the messages table. Ordering
    // (LEAST, GREATEST) collapses (A→B) and (B→A) into one row so
    // we don't double-process. Group messages (receiverId NULL) are
    // out of scope here — group retention is a separate concern.
    const pairs = await prisma.$queryRaw<Array<{ a: string; b: string }>>`
      SELECT DISTINCT
        LEAST(sender_id, receiver_id)    AS a,
        GREATEST(sender_id, receiver_id) AS b
      FROM messages
      WHERE receiver_id IS NOT NULL
    `;

    let totalDeleted = 0;
    let pairsSwept = 0;
    let pairsTouched = 0;

    for (const { a, b } of pairs) {
      const policyA = retentionPolicy(tierByUser.get(a));
      const policyB = retentionPolicy(tierByUser.get(b));
      const effective = maxRetention(policyA, policyB);
      // Basic↔Basic is enforced per-send. Skip here.
      if (effective.mode !== "time") continue;
      pairsSwept += 1;

      const cutoff = cutoffFor(effective)!;
      const result = await prisma.message.deleteMany({
        where: {
          createdAt: { lt: cutoff },
          OR: [
            { senderId: a, receiverId: b },
            { senderId: b, receiverId: a },
          ],
        },
      });
      if (result.count > 0) {
        pairsTouched += 1;
        totalDeleted += result.count;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalDeleted,
        pairsScanned: pairs.length,
        pairsSwept,
        pairsTouched,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      { status: 500 },
    );
  }
}
