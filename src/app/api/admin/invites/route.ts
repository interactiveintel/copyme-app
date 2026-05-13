// /api/admin/invites — admin-gated mint + list of beta invite codes.
//
// POST: mint one or many codes in a single call. Useful for "give me 70
//       codes for the beta cohort" — returns the array of codes the admin
//       can paste into Notion / a CSV / wherever the team coordinates.
// GET:  list recent codes with their redemption counts. No pagination
//       yet — beta scale doesn't need it.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { mintInviteCode } from "@/lib/invite-code";

export const runtime = "nodejs";

interface MintBody {
  /** How many codes to mint in this call. 1–200. */
  count?: number;
  /** Per-code maxUses (1 = single-use). 1–500. */
  maxUses?: number;
  /** ISO date string. Omit for never-expires. */
  expiresAt?: string;
  /** Optional human-readable note attached to every minted code. */
  note?: string;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as MintBody;
  const count = Math.min(200, Math.max(1, Math.floor(body.count ?? 1)));
  const maxUses = Math.min(500, Math.max(1, Math.floor(body.maxUses ?? 1)));
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "INVALID_EXPIRES_AT" }, { status: 400 });
  }
  const note = body.note?.slice(0, 120) ?? null;

  const codes: Array<{ id: string; code: string }> = [];
  for (let i = 0; i < count; i += 1) {
    const minted = await mintInviteCode({
      mintedById: auth.userId,
      note,
      maxUses,
      expiresAt,
    });
    codes.push(minted);
  }
  return NextResponse.json({ count: codes.length, codes });
}

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const rows = await prisma.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      code: true,
      note: true,
      maxUses: true,
      usedCount: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ codes: rows });
}
