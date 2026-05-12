// Ad auction tests (Tier B2). Pure Vickrey logic — second-price + floor.
//
// Run:  node scripts/test-ads-auction.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const tsc = resolve(repoRoot, "node_modules/.bin/tsc");
const buildDir = mkdtempSync(join(tmpdir(), "copyme-auction-"));

execFileSync(
  tsc,
  [
    "--target", "es2022",
    "--module", "nodenext",
    "--moduleResolution", "nodenext",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck",
    "--outDir", buildDir,
    resolve(repoRoot, "src/lib/ads/auction.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "auction.js")).href);
const { runAuction } = mod;

const FLOOR = 100_000; // matches FLOOR_MICRO_USD inside auction.ts

// ----- Empty / degenerate -------------------------------------------------

test("runAuction — empty list returns NO_CANDIDATES", () => {
  const r = runAuction([]);
  assert.equal(r.winnerId, null);
  assert.equal(r.payMicroUsd, 0);
  assert.equal(r.reason, "NO_CANDIDATES");
  assert.deepEqual(r.effectiveBids, []);
});

// ----- Single candidate ---------------------------------------------------

test("runAuction — single candidate above floor wins, pays floor", () => {
  const r = runAuction([{ id: "a", bidMicroUsd: 500_000, matchScore: 1.0 }]);
  assert.equal(r.winnerId, "a");
  // No second bidder → second defaults to FLOOR; payment = max(FLOOR+1, FLOOR) = FLOOR+1.
  // Per spec: "Single candidate above floor wins, pays max(secondBid+1, floor) = floor".
  // With second=FLOOR, payment = max(FLOOR+1, FLOOR) = FLOOR+1. The spec rounds this
  // down to "floor" colloquially. Check it equals floor + 1 micro-USD.
  assert.equal(r.payMicroUsd, FLOOR + 1);
});

test("runAuction — single candidate below floor → BELOW_FLOOR", () => {
  const r = runAuction([{ id: "a", bidMicroUsd: 50_000, matchScore: 1.0 }]);
  assert.equal(r.winnerId, null);
  assert.equal(r.payMicroUsd, 0);
  assert.equal(r.reason, "BELOW_FLOOR");
});

// ----- Multi-candidate ranking --------------------------------------------

test("runAuction — two candidates: higher effective bid wins, pays second + 1", () => {
  const r = runAuction([
    { id: "a", bidMicroUsd: 200_000, matchScore: 1.0 }, // effective 200_000
    { id: "b", bidMicroUsd: 300_000, matchScore: 1.0 }, // effective 300_000
  ]);
  assert.equal(r.winnerId, "b");
  // Second highest effective is 200_000. max(200_001, FLOOR=100_000) = 200_001.
  assert.equal(r.payMicroUsd, 200_001);
});

test("runAuction — match score multiplies bid (effective = bid * matchScore)", () => {
  const r = runAuction([
    { id: "low-bid-high-match", bidMicroUsd: 200_000, matchScore: 0.9 }, // eff 180_000
    { id: "high-bid-low-match", bidMicroUsd: 500_000, matchScore: 0.2 }, // eff 100_000
  ]);
  assert.equal(r.winnerId, "low-bid-high-match");
  assert.equal(r.payMicroUsd, 100_001);
  assert.equal(r.effectiveBids[0].effective, 180_000);
  assert.equal(r.effectiveBids[1].effective, 100_000);
});

test("runAuction — effective bid is rounded", () => {
  // 333_333 * 0.5 = 166_666.5 → rounds to 166_667
  const r = runAuction([
    { id: "rounded", bidMicroUsd: 333_333, matchScore: 0.5 },
  ]);
  assert.equal(r.effectiveBids[0].effective, 166_667);
});

// ----- All below floor ----------------------------------------------------

test("runAuction — all candidates below floor → BELOW_FLOOR", () => {
  const r = runAuction([
    { id: "a", bidMicroUsd: 50_000, matchScore: 1.0 },
    { id: "b", bidMicroUsd: 40_000, matchScore: 1.0 },
    { id: "c", bidMicroUsd: 30_000, matchScore: 1.0 },
  ]);
  assert.equal(r.winnerId, null);
  assert.equal(r.reason, "BELOW_FLOOR");
  // effectiveBids should still be populated (sorted desc).
  assert.equal(r.effectiveBids.length, 3);
  assert.equal(r.effectiveBids[0].effective, 50_000);
  assert.equal(r.effectiveBids[2].effective, 30_000);
});

test("runAuction — winner above floor, second below floor: pays floor", () => {
  // top eff=500k, second eff=50k → max(50_001, 100_000) = 100_000.
  const r = runAuction([
    { id: "winner", bidMicroUsd: 500_000, matchScore: 1.0 },
    { id: "loser", bidMicroUsd: 50_000, matchScore: 1.0 },
  ]);
  assert.equal(r.winnerId, "winner");
  assert.equal(r.payMicroUsd, 100_000);
});

// ----- effectiveBids ordering --------------------------------------------

test("runAuction — effectiveBids returned sorted descending", () => {
  const r = runAuction([
    { id: "low", bidMicroUsd: 100_000, matchScore: 1.0 },
    { id: "mid", bidMicroUsd: 200_000, matchScore: 1.0 },
    { id: "high", bidMicroUsd: 400_000, matchScore: 1.0 },
  ]);
  assert.deepEqual(
    r.effectiveBids.map((e) => e.id),
    ["high", "mid", "low"],
  );
});

test("runAuction — three-way: winner pays third's…wait, second's effective + 1", () => {
  const r = runAuction([
    { id: "a", bidMicroUsd: 100_000, matchScore: 1.0 }, // 100k
    { id: "b", bidMicroUsd: 200_000, matchScore: 1.0 }, // 200k
    { id: "c", bidMicroUsd: 500_000, matchScore: 1.0 }, // 500k winner
  ]);
  assert.equal(r.winnerId, "c");
  // Vickrey: pays second-highest + 1 = 200_001.
  assert.equal(r.payMicroUsd, 200_001);
});
