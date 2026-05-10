// Auto-moderation: NSFW + CSAM hash matching (S-173).
//
// Two checks per inbound media:
//   1. SHA-256 against known-CSAM hash list (loaded from
//      `process.env.NCMEC_HASH_LIST_URL` at boot, cached for 24h).
//   2. pHash (perceptual) against an NSFW seed list — flagged not blocked,
//      surfaces in the moderation queue for review.
//
// On a CSAM match we MUST: (a) drop the upload (b) preserve the hash and
// metadata for required law-enforcement reporting (c) suspend the account
// per Terms §4. Non-matches are NOT logged, per spec.

import { createHash } from "node:crypto";
import { addBreadcrumb, reportError } from "@/lib/observability";

let cachedCsamHashes: Set<string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

async function loadCsamList(): Promise<Set<string>> {
  if (cachedCsamHashes && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedCsamHashes;
  }
  const url = process.env.NCMEC_HASH_LIST_URL;
  if (!url) {
    cachedCsamHashes = new Set();
    cacheLoadedAt = Date.now();
    return cachedCsamHashes;
  }
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${process.env.NCMEC_TOKEN ?? ""}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    cachedCsamHashes = new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => /^[a-f0-9]{64}$/.test(line)),
    );
    cacheLoadedAt = Date.now();
    return cachedCsamHashes;
  } catch (err) {
    reportError(err, { context: "ncmec_load_failed" });
    cachedCsamHashes = new Set();
    cacheLoadedAt = Date.now();
    return cachedCsamHashes;
  }
}

export interface ScanResult {
  ok: boolean;
  csamMatch: boolean;
  nsfwSuspect: boolean;
  sha256: string;
}

/**
 * Scan a media buffer. CSAM matches → ok=false (caller must drop + report).
 * NSFW suspects → ok=true with `nsfwSuspect=true` (caller may flag for
 * review queue without blocking the upload).
 */
export async function scanMedia(buf: Uint8Array): Promise<ScanResult> {
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const list = await loadCsamList();
  const csamMatch = list.has(sha256);
  if (csamMatch) {
    addBreadcrumb("safety.csam_match", { sha256_prefix: sha256.slice(0, 8) });
    return { ok: false, csamMatch: true, nsfwSuspect: false, sha256 };
  }
  // pHash is intentionally not implemented here — placeholder until the
  // image-processing pipeline is wired (likely with sharp + an NSFW model).
  return { ok: true, csamMatch: false, nsfwSuspect: false, sha256 };
}

/**
 * Report a CSAM match to NCMEC. In dev we just log; production wires to
 * NCMEC's CyberTipline API.
 */
export async function reportCsam(meta: {
  uploaderUserId: string;
  sha256: string;
  filename?: string;
  ipHash?: string | null;
}): Promise<void> {
  addBreadcrumb("safety.csam_reported", meta);
  if (process.env.NODE_ENV !== "production") return;
  const url = process.env.NCMEC_REPORT_URL;
  if (!url) return;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.NCMEC_TOKEN ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(meta),
  }).catch((e) => reportError(e, { context: "ncmec_report_failed" }));
}
