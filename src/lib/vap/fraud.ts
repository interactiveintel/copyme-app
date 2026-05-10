// VAP fraud monitoring (S-342).
//
// Three velocity rules + a device-binding check + a geo-velocity check.
// Real production wires the BaaS partner's risk webhooks; this is the
// in-house first-line.

import { prisma } from "@/lib/db";

const HIGH_AMOUNT_EUR = 500;
const RAPID_TX_WINDOW_MS = 60 * 1000;
const RAPID_TX_LIMIT = 5;
const NEW_DEVICE_HARD_LIMIT_EUR = 50;

export interface FraudSignal {
  /** 0..1 risk score; ≥ 0.7 means decline-and-review. */
  score: number;
  reasons: string[];
}

export interface ScoreCtx {
  userId: string;
  amountEur: number;
  deviceId?: string;
  countryIso2?: string;
}

export async function scoreTransaction(ctx: ScoreCtx): Promise<FraudSignal> {
  const reasons: string[] = [];
  let score = 0;

  // Rule 1 — high-value amount.
  if (ctx.amountEur >= HIGH_AMOUNT_EUR) {
    score += 0.2;
    reasons.push("amount_high");
  }

  // Rule 2 — rapid-fire transactions (DB-backed for now).
  const rapidSince = new Date(Date.now() - RAPID_TX_WINDOW_MS);
  const recent = await prisma.vapTransaction.count({
    where: { senderId: ctx.userId, createdAt: { gte: rapidSince } },
  });
  if (recent >= RAPID_TX_LIMIT) {
    score += 0.4;
    reasons.push("velocity");
  }

  // Rule 3 — new device + high amount.
  if (ctx.deviceId && ctx.amountEur >= NEW_DEVICE_HARD_LIMIT_EUR) {
    const known = await prisma.session.findFirst({
      where: { userId: ctx.userId, deviceId: ctx.deviceId, createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } },
    });
    if (!known) {
      score += 0.4;
      reasons.push("new_device_high_amount");
    }
  }

  // Rule 4 — geo velocity (country swap within 24h).
  if (ctx.countryIso2) {
    const lastIp = await prisma.session.findFirst({
      where: { userId: ctx.userId, lastUsedAt: { gte: new Date(Date.now() - 86_400_000) } },
      orderBy: { lastUsedAt: "desc" },
      select: { ipHash: true },
    });
    void lastIp; // hook: in prod we resolve ipHash to a country bucket
    // Placeholder: don't add to score until ip→country lookup is wired.
  }

  return { score: Math.min(1, score), reasons };
}

/** Convenience: should we hold the transaction for review? */
export async function shouldHold(ctx: ScoreCtx): Promise<boolean> {
  const s = await scoreTransaction(ctx);
  return s.score >= 0.7;
}
