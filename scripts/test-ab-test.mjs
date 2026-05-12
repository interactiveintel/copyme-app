// A/B test framework tests (Tier B2). Hash-based assignment + z-test for
// significance. Pure functions, no I/O.
//
// Run:  node scripts/test-ab-test.mjs

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-abtest-"));

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
    resolve(repoRoot, "src/lib/ab-test.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "ab-test.js")).href);
const { assignVariant, analyzeAB } = mod;

// ----- Determinism --------------------------------------------------------

test("assignVariant — same (experiment, userId) → same variant", () => {
  const exp = { name: "exp1", variants: ["a", "b"] };
  const v1 = assignVariant(exp, "user-123");
  const v2 = assignVariant(exp, "user-123");
  const v3 = assignVariant(exp, "user-123");
  assert.equal(v1, v2);
  assert.equal(v2, v3);
});

test("assignVariant — different experiment names produce independent splits", () => {
  // Same userId, different experiment names — assignments are independent.
  // Find at least one userId where they differ (probability > 0).
  const exp1 = { name: "exp-A", variants: ["a", "b"] };
  const exp2 = { name: "exp-B", variants: ["a", "b"] };
  let foundDiff = false;
  for (let i = 0; i < 100; i++) {
    if (assignVariant(exp1, `u${i}`) !== assignVariant(exp2, `u${i}`)) {
      foundDiff = true;
      break;
    }
  }
  assert.ok(foundDiff, "different experiments should diverge for at least one user");
});

test("assignVariant — empty variants returns 'control'", () => {
  assert.equal(assignVariant({ name: "x", variants: [] }, "u"), "control");
});

// ----- Even split sanity check --------------------------------------------

test("assignVariant — even split is roughly 50/50 over 1000 random userIds", () => {
  const exp = { name: "even-split", variants: ["a", "b"] };
  let aCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (assignVariant(exp, `user-${i}`) === "a") aCount++;
  }
  // Should land within +/- 10% (i.e. between 400 and 600).
  assert.ok(aCount >= 400 && aCount <= 600, `expected 400-600, got ${aCount}`);
});

test("assignVariant — three-way split is roughly 33/33/33", () => {
  const exp = { name: "three-way", variants: ["a", "b", "c"] };
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 1500; i++) {
    counts[assignVariant(exp, `u-${i}`)]++;
  }
  // Each should be within +/- 10% of 500.
  for (const k of ["a", "b", "c"]) {
    assert.ok(counts[k] >= 400 && counts[k] <= 600, `${k}: ${counts[k]} not within 400-600`);
  }
});

// ----- Weighted split -----------------------------------------------------

test("assignVariant — 80/20 weighted split is roughly 80/20", () => {
  const exp = { name: "weighted", variants: ["a", "b"], weights: [0.8, 0.2] };
  let aCount = 0;
  for (let i = 0; i < 1000; i++) {
    if (assignVariant(exp, `wu-${i}`) === "a") aCount++;
  }
  // 80/20 = 800/200; allow +/- 5% (i.e. 750-850 in 'a').
  assert.ok(aCount >= 730 && aCount <= 870, `expected ~800, got ${aCount}`);
});

// ----- Z-test analysis ----------------------------------------------------

test("analyzeAB — control 100/1000 vs treatment 150/1000 → significant lift ~0.5", () => {
  const r = analyzeAB(
    { variant: "control", conversions: 100, exposures: 1000, rate: 0.1 },
    { variant: "treatment", conversions: 150, exposures: 1000, rate: 0.15 },
  );
  assert.equal(r.signif, true);
  // Lift: (0.15 - 0.10) / 0.10 = 0.5
  assert.ok(Math.abs(r.lift - 0.5) < 1e-9, `lift was ${r.lift}`);
  assert.ok(r.p < 0.05, `p-value was ${r.p}`);
});

test("analyzeAB — small sample (<100 exposures) → signif=false even with big effect", () => {
  const r = analyzeAB(
    { variant: "control", conversions: 5, exposures: 50, rate: 0.1 },
    { variant: "treatment", conversions: 25, exposures: 50, rate: 0.5 },
  );
  // p might be tiny but the sample-size guard kicks in.
  assert.equal(r.signif, false);
});

test("analyzeAB — equal rates → no lift, not significant", () => {
  const r = analyzeAB(
    { variant: "control", conversions: 100, exposures: 1000, rate: 0.1 },
    { variant: "treatment", conversions: 100, exposures: 1000, rate: 0.1 },
  );
  assert.equal(r.signif, false);
  assert.ok(Math.abs(r.lift) < 1e-9);
  assert.ok(Math.abs(r.z) < 1e-9);
});

test("analyzeAB — zero conversions in control → lift=0 (avoid div-by-zero)", () => {
  const r = analyzeAB(
    { variant: "control", conversions: 0, exposures: 1000, rate: 0 },
    { variant: "treatment", conversions: 50, exposures: 1000, rate: 0.05 },
  );
  // Code returns lift=0 when p1 (control rate) === 0.
  assert.equal(r.lift, 0);
});

test("analyzeAB — negative lift (treatment worse than control)", () => {
  const r = analyzeAB(
    { variant: "control", conversions: 200, exposures: 1000, rate: 0.2 },
    { variant: "treatment", conversions: 100, exposures: 1000, rate: 0.1 },
  );
  // Lift: (0.1 - 0.2) / 0.2 = -0.5
  assert.ok(Math.abs(r.lift - (-0.5)) < 1e-9, `lift was ${r.lift}`);
  // Z negative, p still small — significant *negative* result.
  assert.equal(r.signif, true);
  assert.ok(r.z < 0);
});
