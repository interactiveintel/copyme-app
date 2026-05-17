// VapAccount helpers — lazy creation + balance reads.
//
// Accounts are created on first use rather than at signup. This keeps
// signup cheap (no extra row write per user) and means users who never
// touch wallet features never burn a row. The transfer/request paths
// upsert the account in their own transaction so this helper is only
// strictly needed for the GET /api/vap/account read path.
//
// Balances are Decimal(12,2) in the DB and Prisma.Decimal in memory.
// We convert to integer cents ONLY at this function's return boundary
// (cents-on-wire). Never do Decimal → number anywhere else inside the
// VAP lib.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const CENTS_PER_DOLLAR = new Prisma.Decimal(100);

function decimalToCents(d: Prisma.Decimal): number {
  return d.mul(CENTS_PER_DOLLAR).toNumber();
}

export interface AccountState {
  /** Whole-dollar amount as a number — keep cents on the wire to avoid float drift. */
  balanceCents: number;
  currency: "USD" | "EUR";
  weeklyTransferCents: number;
  annualTransferCents: number;
  tier: "standard" | "premium" | "merchant";
  lastTransactionAt: string | null;
  virtualCardCount: number;
  /** True if the account was just created by this call. */
  created: boolean;
}

export async function getOrCreateAccount(userId: string): Promise<AccountState> {
  const existing = await prisma.vapAccount.findUnique({
    where: { userId },
  });
  if (existing) {
    return {
      balanceCents: decimalToCents(existing.balance),
      currency: existing.currency as "USD" | "EUR",
      weeklyTransferCents: decimalToCents(existing.weeklyTransferTotal),
      annualTransferCents: decimalToCents(existing.annualTransferTotal),
      tier: existing.tier as "standard" | "premium" | "merchant",
      lastTransactionAt: existing.lastTransactionAt?.toISOString() ?? null,
      virtualCardCount: existing.virtualCardCount,
      created: false,
    };
  }
  const fresh = await prisma.vapAccount.create({
    data: { userId, balance: 0 },
  });
  return {
    balanceCents: 0,
    currency: fresh.currency as "USD" | "EUR",
    weeklyTransferCents: 0,
    annualTransferCents: 0,
    tier: fresh.tier as "standard" | "premium" | "merchant",
    lastTransactionAt: null,
    virtualCardCount: 0,
    created: true,
  };
}
