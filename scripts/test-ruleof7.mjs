// Rule-of-7 integration test (S-118).
//
// Runs the same precompile-and-import dance as test-phone.mjs against the
// pure validators in lib/ruleOf7.ts. End-to-end HTTP tests would require a
// running dev server + a seeded user; this script covers the unit path
// which is what's strictly enforced.
//
// Run:  npm run test:ruleof7

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-ruleof7-"));

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
    resolve(repoRoot, "src/lib/ruleOf7.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "ruleOf7.js")).href);
const {
  validateMessageContent,
  validateMediaCount,
  validateDuration,
  validateDisplayName,
  validateInterest,
  LIMITS,
} = mod;

// ----- Word cap (S-111) ---------------------------------------------------

test("word cap — 70 words passes", () => {
  const text = Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ");
  assert.equal(validateMessageContent(text).valid, true);
});

test("word cap — 71 words fails", () => {
  const text = Array.from({ length: 71 }, (_, i) => `w${i}`).join(" ");
  const r = validateMessageContent(text);
  assert.equal(r.valid, false);
  assert.match(r.error, /70-word limit/);
});

test("word cap — empty passes (validators don't check 'required')", () => {
  assert.equal(validateMessageContent("").valid, true);
});

test("word cap — emoji counts as 1 word", () => {
  const text = "🔥 ".repeat(70).trim();
  assert.equal(validateMessageContent(text).valid, true);
});

test("word cap — Pro tier raises to 700", () => {
  const text = Array.from({ length: 600 }, (_, i) => `w${i}`).join(" ");
  // BASIC fails …
  assert.equal(validateMessageContent(text, "basic").valid, false);
  // … BUSINESS allows it
  assert.equal(validateMessageContent(text, "business_3").valid, true);
});

// ----- Media cap (S-113) --------------------------------------------------

test("media cap — 7 passes, 8 fails", () => {
  assert.equal(validateMediaCount(7).valid, true);
  const r = validateMediaCount(8);
  assert.equal(r.valid, false);
  assert.match(r.error, /7-item limit/);
});

// ----- Duration cap (S-114) -----------------------------------------------

test("duration cap — 70s passes, 71s fails", () => {
  assert.equal(validateDuration(70).valid, true);
  const r = validateDuration(71);
  assert.equal(r.valid, false);
  assert.match(r.error, /70-second limit/);
});

// ----- Display name + interest --------------------------------------------

test("display name — 7 words passes, 8 fails", () => {
  assert.equal(validateDisplayName("a b c d e f g").valid, true);
  const r = validateDisplayName("a b c d e f g h");
  assert.equal(r.valid, false);
});

test("display name — empty rejected", () => {
  assert.equal(validateDisplayName("").valid, false);
  assert.equal(validateDisplayName("   ").valid, false);
});

test("interest — empty rejected, 7 words passes", () => {
  assert.equal(validateInterest("").valid, false);
  assert.equal(validateInterest("a b c d e f g").valid, true);
});

// ----- LIMITS table snapshot ----------------------------------------------

test("LIMITS — basic tier shape (the canonical Rule of 7 table)", () => {
  assert.equal(LIMITS.BASIC.maxMessageWords, 70);
  assert.equal(LIMITS.BASIC.maxImages, 7);
  assert.equal(LIMITS.BASIC.maxVoiceSeconds, 70);
  assert.equal(LIMITS.BASIC.maxVideoSeconds, 70);
  assert.equal(LIMITS.BASIC.contactsAtOnce, 7);
  assert.equal(LIMITS.BASIC.inboxPerContact, 7);
  assert.equal(LIMITS.BASIC.groupSize, 7);
});
