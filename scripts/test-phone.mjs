// Phone module test (S-007).
//
// Run from the copyme-app dir:
//   node scripts/test-phone.mjs
//
// We don't have a UI test framework wired into the project, so this script
// drives a one-shot tsc compile of src/lib/phone/*.ts → a temp dir, then
// imports the JS output and asserts behavior with node:test. The AC for
// S-007 calls for a "snapshot test for the country picker"; we snapshot the
// deterministic ordering and dial-code data, plus the validate() pipeline
// against Jože's example number "+386 31 234 567".

import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const phoneSrc = resolve(repoRoot, "src/lib/phone");
const tsc = resolve(repoRoot, "node_modules/.bin/tsc");

// One-time compile.
const buildDir = mkdtempSync(join(tmpdir(), "copyme-phone-"));
execFileSync(
  tsc,
  [
    "--target", "es2022",
    "--module", "nodenext",
    "--moduleResolution", "nodenext",
    "--esModuleInterop",
    "--strict",
    "--skipLibCheck",
    "--rootDir", phoneSrc,
    "--outDir", buildDir,
    resolve(phoneSrc, "countries.ts"),
    resolve(phoneSrc, "validate.ts"),
  ],
  { stdio: "inherit" },
);

const countriesUrl = pathToFileURL(join(buildDir, "countries.js")).href;
const validateUrl = pathToFileURL(join(buildDir, "validate.js")).href;

const { COUNTRIES, orderedCountries, findCountryByIso2 } = await import(countriesUrl);
const { validatePhone, parseE164, formatPretty } = await import(validateUrl);

// ----- snapshot of picker data -------------------------------------------

test("countries — pinned head order is [SI, US]", () => {
  const head = orderedCountries().slice(0, 2).map((c) => c.iso2);
  assert.deepEqual(head, ["si", "us"]);
});

test("countries — Slovenia entry (S-007 main AC)", () => {
  const si = findCountryByIso2("si");
  assert.ok(si);
  assert.equal(si.dialCode, "386");
  assert.equal(si.flag, "🇸🇮");
  assert.deepEqual(si.nsnLengths, [8]);
  assert.equal(si.pinned, true);
});

test("countries — required dial codes present", () => {
  const required = { us: "1", gb: "44", de: "49", fr: "33", it: "39", hr: "385" };
  for (const [iso2, dial] of Object.entries(required)) {
    const c = findCountryByIso2(iso2);
    assert.ok(c, `country ${iso2} must exist`);
    assert.equal(c.dialCode, dial, `country ${iso2} dial code`);
  }
});

test("countries — no duplicate iso2", () => {
  const isoSet = new Set(COUNTRIES.map((c) => c.iso2));
  assert.equal(isoSet.size, COUNTRIES.length);
});

test("countries — alphabetical after pinned", () => {
  const tail = orderedCountries().slice(2).map((c) => c.name);
  const sorted = [...tail].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(tail, sorted);
});

// ----- validatePhone ------------------------------------------------------

test("validatePhone — Slovenia happy path: '+386 31 234 567'", () => {
  const r = validatePhone("si", "31 234 567");
  assert.equal(r.valid, true);
  assert.equal(r.e164, "+38631234567");
});

test("validatePhone — strips trunk prefix '0' (EU dial habit)", () => {
  const r = validatePhone("si", "031 234 567");
  assert.equal(r.valid, true);
  assert.equal(r.e164, "+38631234567");
});

test("validatePhone — too short", () => {
  const r = validatePhone("si", "31 234");
  assert.equal(r.valid, false);
  assert.equal(r.reason, "TOO_SHORT");
});

test("validatePhone — too long", () => {
  const r = validatePhone("si", "31 234 567 89");
  assert.equal(r.valid, false);
  assert.equal(r.reason, "TOO_LONG");
});

test("validatePhone — empty input", () => {
  const r = validatePhone("si", "");
  assert.equal(r.valid, false);
  assert.equal(r.reason, "EMPTY");
});

test("validatePhone — unknown country", () => {
  const r = validatePhone("xx", "31234567");
  assert.equal(r.valid, false);
  assert.equal(r.reason, "UNKNOWN_COUNTRY");
});

test("validatePhone — US 10-digit with formatting", () => {
  const r = validatePhone("us", "(415) 555-0142");
  assert.equal(r.valid, true);
  assert.equal(r.e164, "+14155550142");
});

test("parseE164 round-trip", () => {
  const r = validatePhone("si", "31 234 567");
  assert.equal(r.valid, true);
  const back = parseE164(r.e164);
  assert.ok(back);
  assert.equal(back.country.iso2, "si");
  assert.equal(back.nsn, "31234567");
});

test("formatPretty produces '+386 31234567'", () => {
  assert.equal(formatPretty("+38631234567"), "+386 31234567");
});
