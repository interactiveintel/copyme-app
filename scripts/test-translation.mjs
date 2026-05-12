// Translation module — pure heuristic tests only (Tier B2).
//
// translation.ts mixes pure heuristics (`detectLocaleHeuristic`) with the
// stateful `translate()` function that imports prisma + redis + Anthropic.
// We can't compile the whole file standalone (the @/* imports would explode),
// so we extract `detectLocaleHeuristic` into a tiny wrapper file and compile
// THAT. The function body is copied verbatim from src/lib/translation.ts;
// if it ever changes, this test will silently keep testing the old impl —
// the assumption is the heuristic block is reasonably stable. (See AC: the
// task explicitly says "Skip the translate() function".)
//
// Run:  node scripts/test-translation.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const tsc = resolve(repoRoot, "node_modules/.bin/tsc");
const buildDir = mkdtempSync(join(tmpdir(), "copyme-translation-"));

// Extract `detectLocaleHeuristic` from src/lib/translation.ts at runtime so
// we test the actual source rather than a hand-copied duplicate.
const src = readFileSync(resolve(repoRoot, "src/lib/translation.ts"), "utf8");
// Match the entire export function detectLocaleHeuristic(...) { ... } block.
// The function ends at the first `^}` after the export.
const startIdx = src.indexOf("export function detectLocaleHeuristic");
assert.notEqual(startIdx, -1, "detectLocaleHeuristic not found in translation.ts");
// Walk braces to find matching close.
let depth = 0;
let endIdx = -1;
let started = false;
for (let i = startIdx; i < src.length; i++) {
  if (src[i] === "{") {
    depth++;
    started = true;
  } else if (src[i] === "}") {
    depth--;
    if (started && depth === 0) {
      endIdx = i + 1;
      break;
    }
  }
}
assert.notEqual(endIdx, -1, "couldn't find end of detectLocaleHeuristic");

const wrapperSrc = src.slice(startIdx, endIdx);
const wrapperFile = join(buildDir, "wrapper.ts");
writeFileSync(wrapperFile, wrapperSrc);

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
    wrapperFile,
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "wrapper.js")).href);
const { detectLocaleHeuristic } = mod;

// ----- Heuristic detection -------------------------------------------------

test("detectLocaleHeuristic — Slovenian phrase", () => {
  assert.equal(detectLocaleHeuristic("Hvala in nasvidenje"), "sl");
});

test("detectLocaleHeuristic — Slovenian 'kaj je to'", () => {
  assert.equal(detectLocaleHeuristic("kaj je to"), "sl");
});

test("detectLocaleHeuristic — Spanish 'hola que tal'", () => {
  // 'que', 'tal' are not exact tokens; need words from the regex.
  // Use 'hola' + 'gracias' which ARE in the regex.
  assert.equal(detectLocaleHeuristic("hola gracias"), "es");
});

test("detectLocaleHeuristic — German 'guten tag danke'", () => {
  assert.equal(detectLocaleHeuristic("guten tag danke"), "de");
});

test("detectLocaleHeuristic — French 'bonjour merci'", () => {
  assert.equal(detectLocaleHeuristic("bonjour merci"), "fr");
});

test("detectLocaleHeuristic — Italian 'ciao grazie'", () => {
  assert.equal(detectLocaleHeuristic("ciao grazie"), "it");
});

test("detectLocaleHeuristic — English 'hello and thanks'", () => {
  assert.equal(detectLocaleHeuristic("hello and thanks"), "en");
});

test("detectLocaleHeuristic — undetermined for nondescript text", () => {
  // Plain emoji + numbers — no regex matches.
  assert.equal(detectLocaleHeuristic("123 456 789"), "und");
  assert.equal(detectLocaleHeuristic("🔥🔥🔥"), "und");
});

test("detectLocaleHeuristic — empty string is undetermined", () => {
  assert.equal(detectLocaleHeuristic(""), "und");
});

test("detectLocaleHeuristic — case-insensitive", () => {
  assert.equal(detectLocaleHeuristic("HVALA IN NASVIDENJE"), "sl");
  assert.equal(detectLocaleHeuristic("BONJOUR MERCI"), "fr");
});
