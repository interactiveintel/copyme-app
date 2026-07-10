// AI model-registry test (v4.16.31).
//
// Locks the single source of truth for Claude model ids (src/lib/ai-models.ts)
// so a future edit can't silently reintroduce a retired id or break the
// temperature-eligibility rule. The July 2026 migration (Sonnet 4 → 5,
// Opus 4.7 → 4.8) cost five ships because these were scattered and
// untested; this is the guardrail.
//
// Same precompile-and-import dance as test-ruleof7.mjs. ai-models.ts has
// no runtime imports, so it compiles + loads standalone.
//
// Run:  npm run test:ai-models

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-ai-models-"));

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
    resolve(repoRoot, "src/lib/ai-models.ts"),
  ],
  { stdio: "inherit" },
);

const { AI_MODELS, modelAcceptsTemperature } = await import(
  pathToFileURL(join(buildDir, "ai-models.js")).href
);

// ----- Registry values are current (no retired ids) -----------------------

test("registry pins current model ids", () => {
  assert.equal(AI_MODELS.agent, "claude-sonnet-5");
  assert.equal(AI_MODELS.yogi, "claude-opus-4-8");
  assert.equal(AI_MODELS.translation, "claude-haiku-4-5-20251001");
  assert.equal(AI_MODELS.summary, "claude-haiku-4-5-20251001");
});

test("registry contains no retired ids", () => {
  const retired = [
    "claude-sonnet-4-20250514",
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-sonnet-4-6",
  ];
  for (const id of Object.values(AI_MODELS)) {
    assert.ok(!retired.includes(id), `${id} is retired`);
  }
});

// ----- temperature eligibility --------------------------------------------

test("current models reject temperature", () => {
  for (const m of [
    "claude-sonnet-5",
    "claude-sonnet-5-20260101",
    "claude-opus-4-8",
    "claude-opus-4-10",
    "claude-haiku-4-5-20251001",
    "claude-fable-5",
  ]) {
    assert.equal(modelAcceptsTemperature(m), false, m);
  }
});

test("legacy models accept temperature", () => {
  for (const m of [
    "claude-sonnet-4-20250514",
    "claude-opus-4-7",
    "claude-opus-4-0",
    "claude-3-5-sonnet-20241022",
  ]) {
    assert.equal(modelAcceptsTemperature(m), true, m);
  }
});

test("every registry model rejects temperature (all are current)", () => {
  for (const id of Object.values(AI_MODELS)) {
    assert.equal(modelAcceptsTemperature(id), false, id);
  }
});
