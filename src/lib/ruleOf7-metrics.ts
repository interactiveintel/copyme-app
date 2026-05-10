// Rule-of-7 cap-hit telemetry (S-117).
//
// Each call to `recordCapHit(kind, tier)` emits a Sentry breadcrumb AND
// bumps a per-process rolling counter. The counters are exposed at
// /api/admin/ruleof7 for the internal dashboard. A real Grafana panel will
// scrape Sentry's `breadcrumbs.message` events; this is the local fallback.

import { addBreadcrumb } from "@/lib/observability";

export type CapKind =
  | "word"        // 70-word message cap (S-111)
  | "media"       // 7-item media-group cap (S-113)
  | "duration"    // 70-second voice/video cap (S-114)
  | "contacts"    // 7 active contacts cap (S-115)
  | "retention"   // last-7 messages per contact prune (S-116)
  | "display_name"
  | "interest";

export interface CapCounter {
  kind: CapKind;
  tier: string;
  count: number;
  /** ISO timestamp of the most recent hit. */
  lastAt: string;
}

const counters = new Map<string, CapCounter>();

function key(kind: CapKind, tier: string) {
  return `${kind}|${tier}`;
}

export function recordCapHit(kind: CapKind, tier: string = "basic"): void {
  const k = key(kind, tier);
  const now = new Date().toISOString();
  const row = counters.get(k);
  if (row) {
    row.count += 1;
    row.lastAt = now;
  } else {
    counters.set(k, { kind, tier, count: 1, lastAt: now });
  }
  addBreadcrumb("ruleof7.cap_hit", { kind, tier });
}

export function snapshotCounters(): CapCounter[] {
  return Array.from(counters.values()).sort((a, b) => b.count - a.count);
}

/** For tests. */
export function _resetCounters(): void {
  counters.clear();
}
