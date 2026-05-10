// Second-price ad auction (S-234).
//
// Inputs: a list of candidate ads with their bid (priceMicroUsd) and
// targeting overlap with the viewer (interest tags + region). The match
// score multiplies the effective bid; the winner pays max(secondBid+1,
// floor) — Vickrey style.
//
// Pure function so it's trivially testable; production callers feed it
// the candidate list from `prisma.businessAd.findMany({ status:'approved', ... })`.

export interface AdCandidate {
  id: string;
  bidMicroUsd: number;
  /** Score in [0, 1] — fraction of targeting tags that match the viewer. */
  matchScore: number;
}

export interface AuctionResult {
  winnerId: string | null;
  payMicroUsd: number;
  effectiveBids: Array<{ id: string; effective: number }>;
  reason?: "NO_CANDIDATES" | "BELOW_FLOOR";
}

const FLOOR_MICRO_USD = 100_000; // 0.10 USD

export function runAuction(candidates: AdCandidate[]): AuctionResult {
  if (candidates.length === 0) {
    return { winnerId: null, payMicroUsd: 0, effectiveBids: [], reason: "NO_CANDIDATES" };
  }
  const ranked = candidates
    .map((c) => ({ id: c.id, effective: Math.round(c.bidMicroUsd * c.matchScore) }))
    .sort((a, b) => b.effective - a.effective);

  const top = ranked[0];
  if (top.effective < FLOOR_MICRO_USD) {
    return { winnerId: null, payMicroUsd: 0, effectiveBids: ranked, reason: "BELOW_FLOOR" };
  }

  const second = ranked[1]?.effective ?? FLOOR_MICRO_USD;
  const pay = Math.max(second + 1, FLOOR_MICRO_USD);
  return { winnerId: top.id, payMicroUsd: pay, effectiveBids: ranked };
}
