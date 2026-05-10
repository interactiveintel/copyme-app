// Value Account Pay (VAP) types — Phase 3 (S-311+).
//
// Wallet, virtual card, transactions. Real implementations live in
// /api/vap/* routes that talk to the BaaS partner via lib/vap/partner.ts
// (a thin adapter swappable per partner — Solaris/Modulr/Treezor/Marqeta).

export type Currency = "EUR" | "USD" | "GBP";

export interface WalletBalance {
  available: number; // major units (EUR, USD)
  pending: number;
  currency: Currency;
  asOf: string; // ISO timestamp
}

export interface WalletTransaction {
  id: string;
  type: "p2p_send" | "p2p_receive" | "card_purchase" | "topup" | "withdrawal" | "fee" | "refund";
  amount: number;
  currency: Currency;
  counterparty?: string;
  status: "pending" | "completed" | "failed" | "reversed";
  createdAt: string;
  description?: string;
}

export interface VirtualCard {
  id: string;
  /** Last 4 of the PAN; full PAN never sits on our servers. */
  last4: string;
  network: "mastercard";
  status: "active" | "frozen" | "terminated";
  spendingLimitDaily: number;
  regionWhitelist: string[]; // ISO-2 country codes
  inWallet: { apple: boolean; google: boolean };
}

export interface PartnerAdapter {
  openWallet(args: { userId: string; countryIso2: string; currency: Currency }): Promise<{ walletId: string }>;
  getBalance(walletId: string): Promise<WalletBalance>;
  listTransactions(walletId: string, limit?: number): Promise<WalletTransaction[]>;
  topUpFromCard(args: { walletId: string; amount: number; currency: Currency; cardToken: string }): Promise<WalletTransaction>;
  withdrawSepa(args: { walletId: string; amount: number; iban: string; reference: string }): Promise<WalletTransaction>;
  issueVirtualCard(args: { walletId: string; cardholderName: string }): Promise<VirtualCard>;
  freezeCard(cardId: string, frozen: boolean): Promise<VirtualCard>;
  setCardLimits(args: { cardId: string; daily: number; regions: string[] }): Promise<VirtualCard>;
  p2pSend(args: { fromWalletId: string; toWalletId: string; amount: number; currency: Currency; memo?: string }): Promise<WalletTransaction>;
}
