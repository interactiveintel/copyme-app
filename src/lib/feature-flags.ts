// Feature-flag wrapper (S-186).
//
// Single chokepoint for VAP, calls (S-136), Yogi-cost-throttle (S-204),
// and any other gradual-rollout flag. Backed by environment variables in
// dev/preview; production wires Statsig (or any OpenFeature provider) by
// passing a custom evaluator into `setFlagEvaluator`.

export type FlagName =
  | "calls"          // S-136 — 1:1 voice calls beta
  | "yogi"           // S-201 — Yogi assistant in-app
  | "yogi_cost_throttle" // S-204
  | "vap"            // S-311 — Value Account Pay
  | "ads_marketplace"; // S-247

const DEFAULTS: Record<FlagName, boolean> = {
  calls: false,
  yogi: false,
  yogi_cost_throttle: false,
  vap: false,
  ads_marketplace: false,
};

export interface FlagContext {
  userId?: string;
  tier?: string;
  countryIso2?: string;
}

type Evaluator = (flag: FlagName, ctx: FlagContext) => Promise<boolean> | boolean;

let evaluator: Evaluator | null = null;

export function setFlagEvaluator(fn: Evaluator): void {
  evaluator = fn;
}

export async function isEnabled(flag: FlagName, ctx: FlagContext = {}): Promise<boolean> {
  if (evaluator) return await evaluator(flag, ctx);
  // env-driven fallback: COPYME_FLAG_<NAME>=1
  const envKey = `COPYME_FLAG_${flag.toUpperCase()}`;
  if (process.env[envKey] === "1") return true;
  return DEFAULTS[flag];
}

/** Synchronous variant for client-side use (reads localStorage `copyme.flag.*`). */
export function isEnabledSync(flag: FlagName): boolean {
  if (typeof window === "undefined") return DEFAULTS[flag];
  return localStorage.getItem(`copyme.flag.${flag}`) === "1" || DEFAULTS[flag];
}
