// Age-gate tests (Tier B2 — test coverage expansion).
//
// Covers minAgeForCountry table lookup, default fallback, computeAge edge
// cases (birthday-not-yet-this-year), and the meetsAgeGate boundary on the
// exact birthday.
//
// Run:  node scripts/test-age-gate.mjs

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-age-gate-"));

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
    resolve(repoRoot, "src/lib/age-gate/index.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "index.js")).href);
const { minAgeForCountry, computeAge, meetsAgeGate, checkAge, HOUSE_MINIMUM } = mod;

// ----- minAgeForCountry ---------------------------------------------------

test("minAgeForCountry — US is 13 (COPPA)", () => {
  assert.equal(minAgeForCountry("us"), 13);
});

test("minAgeForCountry — DE is 16", () => {
  assert.equal(minAgeForCountry("de"), 16);
});

test("minAgeForCountry — case-insensitive", () => {
  assert.equal(minAgeForCountry("US"), 13);
  assert.equal(minAgeForCountry("De"), 16);
});

test("minAgeForCountry — unknown country falls back to house minimum (16)", () => {
  assert.equal(minAgeForCountry("xx"), 16);
  assert.equal(minAgeForCountry("zz"), 16);
  assert.equal(HOUSE_MINIMUM, 16);
});

test("minAgeForCountry — coverage spot-checks: SI=15, FR=15, GB=13, IT=14", () => {
  assert.equal(minAgeForCountry("si"), 15);
  assert.equal(minAgeForCountry("fr"), 15);
  assert.equal(minAgeForCountry("gb"), 13);
  assert.equal(minAgeForCountry("it"), 14);
});

// ----- computeAge ---------------------------------------------------------

test("computeAge — exactly N years old on the birthday", () => {
  const dob = new Date("2010-06-15T00:00:00Z");
  const now = new Date("2026-06-15T00:00:00Z");
  assert.equal(computeAge(dob, now), 16);
});

test("computeAge — birthday not yet this year (still N-1)", () => {
  const dob = new Date("2010-12-31T00:00:00Z");
  const now = new Date("2026-06-15T00:00:00Z");
  assert.equal(computeAge(dob, now), 15);
});

test("computeAge — day before birthday (still N-1)", () => {
  const dob = new Date("2010-06-15T00:00:00Z");
  const now = new Date("2026-06-14T00:00:00Z");
  assert.equal(computeAge(dob, now), 15);
});

test("computeAge — birthday already passed this year", () => {
  const dob = new Date("2010-01-15T00:00:00Z");
  const now = new Date("2026-06-15T00:00:00Z");
  assert.equal(computeAge(dob, now), 16);
});

// ----- meetsAgeGate -------------------------------------------------------

test("meetsAgeGate — US, exactly 12yo, fails", () => {
  // US min = 13. Born 2014-05-12, now 2026-05-12 → age 12 → fail.
  const dob = new Date("2014-05-12T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z");
  assert.equal(meetsAgeGate("us", dob, now), false);
});

test("meetsAgeGate — US, exactly 13yo on birthday, passes", () => {
  // US min = 13. Born 2013-05-12, now 2026-05-12 → age 13 → pass.
  const dob = new Date("2013-05-12T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z");
  assert.equal(meetsAgeGate("us", dob, now), true);
});

test("meetsAgeGate — US, day before 13th birthday, fails", () => {
  const dob = new Date("2013-05-13T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z");
  assert.equal(meetsAgeGate("us", dob, now), false);
});

test("meetsAgeGate — DE requires 16, 15yo fails", () => {
  const dob = new Date("2010-06-01T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z"); // age 15
  assert.equal(meetsAgeGate("de", dob, now), false);
});

// ----- checkAge full result ----------------------------------------------

test("checkAge — full result shape", () => {
  const dob = new Date("2010-01-01T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z");
  const r = checkAge("US", dob, now);
  assert.deepEqual(r, {
    allowed: true,
    minAge: 13,
    ageProvided: 16,
    countryIso2: "us",   // lowercased
  });
});

test("checkAge — under minimum", () => {
  const dob = new Date("2015-01-01T00:00:00Z");
  const now = new Date("2026-05-12T00:00:00Z");
  const r = checkAge("de", dob, now);
  assert.equal(r.allowed, false);
  assert.equal(r.minAge, 16);
  assert.equal(r.ageProvided, 11);
});
