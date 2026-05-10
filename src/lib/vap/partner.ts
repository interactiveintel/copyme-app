// BaaS partner adapter (S-311). Default implementation is a deterministic
// noop suitable for staging; the real adapter (Solaris/Marqeta/etc.) lands
// after S-302 partner selection and replaces this module.

import type { PartnerAdapter, WalletTransaction } from "./types";

class NoopAdapter implements PartnerAdapter {
  async openWallet({ userId }: { userId: string }) {
    return { walletId: `noop_${userId}` };
  }
  async getBalance() {
    return { available: 0, pending: 0, currency: "EUR" as const, asOf: new Date().toISOString() };
  }
  async listTransactions() {
    return [] as WalletTransaction[];
  }
  async topUpFromCard({ amount, currency }: { amount: number; currency: "EUR" | "USD" | "GBP" }) {
    return tx("topup", amount, currency);
  }
  async withdrawSepa({ amount }: { amount: number }) {
    return tx("withdrawal", amount, "EUR");
  }
  async issueVirtualCard() {
    return {
      id: `card_noop_${Math.random().toString(36).slice(2)}`,
      last4: "0000",
      network: "mastercard" as const,
      status: "active" as const,
      spendingLimitDaily: 500,
      regionWhitelist: [],
      inWallet: { apple: false, google: false },
    };
  }
  async freezeCard(cardId: string, frozen: boolean) {
    return {
      id: cardId,
      last4: "0000",
      network: "mastercard" as const,
      status: frozen ? ("frozen" as const) : ("active" as const),
      spendingLimitDaily: 500,
      regionWhitelist: [],
      inWallet: { apple: false, google: false },
    };
  }
  async setCardLimits({ cardId, daily, regions }: { cardId: string; daily: number; regions: string[] }) {
    return {
      id: cardId,
      last4: "0000",
      network: "mastercard" as const,
      status: "active" as const,
      spendingLimitDaily: daily,
      regionWhitelist: regions,
      inWallet: { apple: false, google: false },
    };
  }
  async p2pSend({ amount, currency }: { amount: number; currency: "EUR" | "USD" | "GBP" }) {
    return tx("p2p_send", amount, currency);
  }
}

function tx(type: WalletTransaction["type"], amount: number, currency: "EUR" | "USD" | "GBP"): WalletTransaction {
  return {
    id: `tx_${Math.random().toString(36).slice(2)}`,
    type,
    amount,
    currency,
    status: "completed",
    createdAt: new Date().toISOString(),
  };
}

let adapter: PartnerAdapter = new NoopAdapter();

export function setVapAdapter(a: PartnerAdapter): void {
  adapter = a;
}

export function vapAdapter(): PartnerAdapter {
  return adapter;
}
