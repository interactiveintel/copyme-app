// Integration test for the libsignal Signal Protocol layer (B1).
//
// Compiles src/lib/e2e/{libsignal,store}.ts to a temp dir UNDER the repo
// (so node_modules resolution works for the @signalapp/libsignal-client
// native addon), then drives a full Alice ↔ Bob ratchet round-trip. We
// assert:
//
//   - Identity generation is stable: a second `ensureIdentity` call returns
//     the same bytes (lazy load + IndexedDB fallback to MemoryKv).
//   - PreKey bundles deserialize cleanly and the first encrypt produces a
//     PreKey-typed envelope (X3DH).
//   - The second message is a Whisper-typed envelope (Double Ratchet).
//   - Bob can decrypt both messages.
//   - Bob can reply, Alice can decrypt — bidirectional ratcheting.
//   - safetyNumber() agrees on both sides and is 60 ASCII digits + spaces.
//
// Run: node scripts/test-e2e.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const tsc = resolve(repoRoot, "node_modules/.bin/tsc");

// CRITICAL: build under the repo root (NOT /tmp) so the compiled JS can
// resolve `@signalapp/libsignal-client` via the repo's node_modules.
const buildDir = mkdtempSync(join(repoRoot, ".test-e2e-"));

let lib;
let store;

test("compile e2e modules", () => {
  execFileSync(
    tsc,
    [
      "--target", "es2022",
      "--module", "nodenext",
      "--moduleResolution", "nodenext",
      "--esModuleInterop",
      "--skipLibCheck",
      "--strict",
      "--outDir", buildDir,
      resolve(repoRoot, "src/lib/e2e/libsignal.ts"),
      resolve(repoRoot, "src/lib/e2e/store.ts"),
    ],
    { stdio: "inherit" },
  );
});

test("load compiled modules", async () => {
  lib = await import(pathToFileURL(join(buildDir, "libsignal.js")).href);
  store = await import(pathToFileURL(join(buildDir, "store.js")).href);
  assert.equal(lib.LIBSIGNAL_AVAILABLE, true, "libsignal addon must be available in Node");
  assert.equal(typeof lib.ensureIdentity, "function");
  assert.equal(typeof lib.getPreKeyBundle, "function");
  assert.equal(typeof lib.encryptForRecipient, "function");
  assert.equal(typeof lib.decryptFromSender, "function");
  assert.equal(typeof lib.safetyNumber, "function");
});

test("ensureIdentity returns stable bytes on second call", async () => {
  const kv = store.createMemoryKv();
  lib._resetStoresCacheForTesting();
  const a = await lib.ensureIdentity(kv);
  const b = await lib.ensureIdentity(kv);
  assert.equal(
    Buffer.from(a.publicKey.serialize()).toString("hex"),
    Buffer.from(b.publicKey.serialize()).toString("hex"),
    "identity must persist across ensureIdentity() calls",
  );
});

test("PreKey bundle has all PQXDH fields populated", async () => {
  const kv = store.createMemoryKv();
  lib._resetStoresCacheForTesting();
  const bundle = await lib.getPreKeyBundle(kv);
  assert.ok(bundle.registrationId > 0 && bundle.registrationId <= 16384);
  assert.equal(bundle.deviceId, 1);
  assert.ok(bundle.preKeyId > 0);
  assert.ok(bundle.signedPreKeyId > 0);
  assert.ok(bundle.kyberPreKeyId > 0);
  assert.ok(bundle.preKeyPublic.length > 0);
  assert.ok(bundle.signedPreKeyPublic.length > 0);
  assert.ok(bundle.signedPreKeySignature.length > 0);
  assert.ok(bundle.kyberPreKeyPublic.length > 0, "PQXDH Kyber pre-key must be present");
  assert.ok(bundle.kyberPreKeySignature.length > 0, "Kyber pre-key signature must be present");
  assert.ok(bundle.identityKey.length > 0);
});

test("X3DH first message + Double Ratchet round-trip", async () => {
  const aliceKv = store.createMemoryKv();
  const bobKv = store.createMemoryKv();

  lib._resetStoresCacheForTesting();
  await lib.ensureIdentity(aliceKv);
  lib._resetStoresCacheForTesting();
  await lib.ensureIdentity(bobKv);

  // Bob publishes a bundle.
  lib._resetStoresCacheForTesting();
  const bobBundle = await lib.getPreKeyBundle(bobKv);

  // Alice -> Bob #1 must be a PreKeySignalMessage (X3DH initial).
  lib._resetStoresCacheForTesting();
  const env1 = await lib.encryptForRecipient("bob-uuid", bobBundle, "Hello, Bob!", aliceKv);
  // CiphertextMessageType.PreKey = 3
  assert.equal(env1.type, 3, "first message must be PreKey-typed (X3DH)");

  lib._resetStoresCacheForTesting();
  const pt1 = await lib.decryptTextFromSender("alice-uuid", env1, bobKv);
  assert.equal(pt1, "Hello, Bob!");

  // Alice -> Bob #2: still PreKey-typed because Alice hasn't yet seen a
  // reply from Bob to confirm the session — per Signal spec, the sender
  // keeps wrapping in a PreKey envelope until they receive a message
  // back. The Double Ratchet is still doing its work inside; the wrapper
  // type just ensures Bob can recover even if message #1 was lost.
  lib._resetStoresCacheForTesting();
  const env2 = await lib.encryptForRecipient("bob-uuid", null, "Second!", aliceKv);
  assert.ok(
    env2.type === 2 || env2.type === 3,
    `second message must be Whisper(2) or PreKey(3), got ${env2.type}`,
  );

  lib._resetStoresCacheForTesting();
  const pt2 = await lib.decryptTextFromSender("alice-uuid", env2, bobKv);
  assert.equal(pt2, "Second!");

  // Bob -> Alice — both sides ratchet.
  lib._resetStoresCacheForTesting();
  const env3 = await lib.encryptForRecipient("alice-uuid", null, "Hi back!", bobKv);
  lib._resetStoresCacheForTesting();
  const pt3 = await lib.decryptTextFromSender("bob-uuid", env3, aliceKv);
  assert.equal(pt3, "Hi back!");

  // Now Alice has heard back from Bob; her next message MUST be a
  // Whisper-typed envelope (Double Ratchet only, no PreKey wrapper).
  lib._resetStoresCacheForTesting();
  const env4 = await lib.encryptForRecipient("bob-uuid", null, "Third!", aliceKv);
  assert.equal(env4.type, 2, "after seeing a reply, Alice must send Whisper-typed envelopes");
  lib._resetStoresCacheForTesting();
  const pt4 = await lib.decryptTextFromSender("alice-uuid", env4, bobKv);
  assert.equal(pt4, "Third!");
});

test("safety number is symmetric and 60 digits (5x12 grouping)", async () => {
  const aliceKv = store.createMemoryKv();
  const bobKv = store.createMemoryKv();
  lib._resetStoresCacheForTesting();
  const aliceIdent = await lib.ensureIdentity(aliceKv);
  lib._resetStoresCacheForTesting();
  const bobIdent = await lib.ensureIdentity(bobKv);

  lib._resetStoresCacheForTesting();
  const sn1 = await lib.safetyNumber(
    aliceIdent.publicKey, "alice-uuid",
    bobIdent.publicKey, "bob-uuid",
  );
  lib._resetStoresCacheForTesting();
  const sn2 = await lib.safetyNumber(
    bobIdent.publicKey, "bob-uuid",
    aliceIdent.publicKey, "alice-uuid",
  );
  assert.equal(sn1, sn2, "safety number must be symmetric");
  // Strip whitespace, check 60 digits.
  const digits = sn1.replace(/\s+/g, "");
  assert.equal(digits.length, 60, "safety number must be 60 digits");
  assert.match(digits, /^\d{60}$/, "safety number must be all decimal digits");
});

test("decryptFromSender rejects unknown ciphertext types", async () => {
  const kv = store.createMemoryKv();
  lib._resetStoresCacheForTesting();
  await lib.ensureIdentity(kv);
  lib._resetStoresCacheForTesting();
  await assert.rejects(
    () => lib.decryptFromSender("nope", { type: 99, body: "" }, kv),
    /Unsupported ciphertext type/,
  );
});

test("encryptForRecipient without bundle and without session throws", async () => {
  const aliceKv = store.createMemoryKv();
  lib._resetStoresCacheForTesting();
  await lib.ensureIdentity(aliceKv);
  lib._resetStoresCacheForTesting();
  await assert.rejects(
    () => lib.encryptForRecipient("stranger", null, "ping", aliceKv),
    /No session for stranger/,
  );
});

test("cleanup", () => {
  rmSync(buildDir, { recursive: true, force: true });
});
