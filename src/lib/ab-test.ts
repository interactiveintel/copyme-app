// A/B test framework + stat-sig (S-251).
//
// Hash-based stable assignment per (userId, experimentName). Pure functions
// so callers in API routes can branch deterministically. Sample-size and
// p-value calc lives in `analyze()` so dashboards can verify lift.

import { createHash } from "node:crypto";

export interface Experiment {
  name: string;
  variants: string[];   // e.g. ["control", "B"]
  /** Optional unequal split; defaults to even. Sum must be 1. */
  weights?: number[];
}

export function assignVariant(experiment: Experiment, userId: string): string {
  if (experiment.variants.length === 0) return "control";
  const hash = createHash("sha1").update(`${experiment.name}:${userId}`).digest();
  const r = (hash.readUInt32BE(0) >>> 0) / 0xffffffff;
  const weights = experiment.weights ?? experiment.variants.map(() => 1 / experiment.variants.length);
  let acc = 0;
  for (let i = 0; i < experiment.variants.length; i++) {
    acc += weights[i];
    if (r < acc) return experiment.variants[i];
  }
  return experiment.variants[experiment.variants.length - 1];
}

export interface ABResult {
  variant: string;
  conversions: number;
  exposures: number;
  rate: number;
}

/**
 * Two-proportion z-test for AB winners. Returns {z, p, lift, signif}.
 * `signif` true if p < 0.05.
 */
export function analyzeAB(control: ABResult, b: ABResult) {
  const p1 = control.conversions / Math.max(1, control.exposures);
  const p2 = b.conversions / Math.max(1, b.exposures);
  const pPool = (control.conversions + b.conversions) / Math.max(1, control.exposures + b.exposures);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / Math.max(1, control.exposures) + 1 / Math.max(1, b.exposures)));
  const z = se === 0 ? 0 : (p2 - p1) / se;
  const p = 2 * (1 - phi(Math.abs(z)));
  return {
    z,
    p,
    lift: p1 === 0 ? 0 : (p2 - p1) / p1,
    signif: p < 0.05 && b.exposures >= 100 && control.exposures >= 100,
  };
}

// Standard normal CDF, Abramowitz & Stegun approximation.
function phi(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}
