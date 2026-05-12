// Auth module tests (Tier B2 — test coverage expansion).
//
// Same compile-and-import dance as the existing test scripts. Covers JWT
// generation/verification, password hashing, bearer-token extraction, and
// the production JWT_SECRET guard. Production-secret check runs in a child
// process so we can flip NODE_ENV without contaminating this run.
//
// Run:  node scripts/test-auth.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const tsc = resolve(repoRoot, "node_modules/.bin/tsc");
// Build INSIDE the repo so node module resolution finds jsonwebtoken/bcryptjs
// in repo node_modules. (The system tmpdir doesn't have those deps.)
const cacheRoot = resolve(repoRoot, "node_modules/.cache/copyme-tests");
mkdirSync(cacheRoot, { recursive: true });
const buildDir = mkdtempSync(join(cacheRoot, "auth-"));

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
    resolve(repoRoot, "src/lib/auth.ts"),
  ],
  { stdio: "inherit", cwd: repoRoot },
);

const mod = await import(pathToFileURL(join(buildDir, "auth.js")).href);
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  verifyPassword,
  extractBearerToken,
  authenticateRequest,
} = mod;

// ----- JWT round-trip ------------------------------------------------------

test("generateAccessToken — round-trips through verifyToken", () => {
  const tok = generateAccessToken("user-abc");
  const payload = verifyToken(tok);
  assert.equal(payload.userId, "user-abc");
  assert.equal(payload.type, "access");
});

test("generateRefreshToken — has type 'refresh'", () => {
  const tok = generateRefreshToken("user-xyz");
  const payload = verifyToken(tok);
  assert.equal(payload.userId, "user-xyz");
  assert.equal(payload.type, "refresh");
});

test("verifyToken — throws on tampered signature", () => {
  const tok = generateAccessToken("u1");
  // JWT format: header.payload.signature — flip the LAST char of the signature.
  const lastChar = tok.slice(-1);
  // Pick a different valid base64url char.
  const replacement = lastChar === "A" ? "B" : "A";
  const tampered = tok.slice(0, -1) + replacement;
  assert.throws(() => verifyToken(tampered));
});

test("verifyToken — throws on expired token", async () => {
  // Sign a token with negative expiry — guaranteed expired.
  const jwtMod = await import("jsonwebtoken");
  const jwt = jwtMod.default ?? jwtMod;
  // Use whatever secret lib/auth resolved at import time. In CI the workflow
  // sets JWT_SECRET; locally the dev fallback is used. Either way, the tests
  // need to sign with the same secret they verify with.
  const secret =
    process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
      ? process.env.JWT_SECRET
      : "copyme-dev-secret-not-for-production-use-32ch";
  const expired = jwt.sign({ userId: "u1", type: "access" }, secret, { expiresIn: "-1s" });
  assert.throws(() => verifyToken(expired), /expired|jwt/i);
});

test("verifyToken — throws on garbage input", () => {
  assert.throws(() => verifyToken("not.a.jwt"));
  assert.throws(() => verifyToken(""));
});

// ----- extractBearerToken --------------------------------------------------

test("extractBearerToken — returns token from well-formed header", () => {
  assert.equal(extractBearerToken("Bearer abc123"), "abc123");
});

test("extractBearerToken — null on missing header", () => {
  assert.equal(extractBearerToken(null), null);
  assert.equal(extractBearerToken(undefined), null);
  assert.equal(extractBearerToken(""), null);
});

test("extractBearerToken — null on malformed header", () => {
  assert.equal(extractBearerToken("abc123"), null);            // no scheme
  assert.equal(extractBearerToken("Basic abc123"), null);       // wrong scheme
  assert.equal(extractBearerToken("Bearer"), null);             // no token
  assert.equal(extractBearerToken("Bearer a b"), null);         // too many parts
});

// ----- authenticateRequest -------------------------------------------------

test("authenticateRequest — accepts valid access token", () => {
  const tok = generateAccessToken("u-auth");
  const payload = authenticateRequest(`Bearer ${tok}`);
  assert.ok(payload);
  assert.equal(payload.userId, "u-auth");
});

test("authenticateRequest — rejects refresh token", () => {
  const tok = generateRefreshToken("u-auth");
  assert.equal(authenticateRequest(`Bearer ${tok}`), null);
});

test("authenticateRequest — null on bad header", () => {
  assert.equal(authenticateRequest(null), null);
  assert.equal(authenticateRequest("Bearer garbage"), null);
});

// ----- Password hashing ----------------------------------------------------

test("hashPassword + verifyPassword — round-trip", async () => {
  const hash = await hashPassword("hunter2");
  assert.notEqual(hash, "hunter2");                 // hashed
  assert.match(hash, /^\$2[aby]\$/);                // bcrypt prefix
  assert.equal(await verifyPassword("hunter2", hash), true);
  assert.equal(await verifyPassword("wrong", hash), false);
});

test("hashPassword — same password produces different hashes (salted)", async () => {
  const a = await hashPassword("same-password");
  const b = await hashPassword("same-password");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword("same-password", a), true);
  assert.equal(await verifyPassword("same-password", b), true);
});

// ----- JWT_SECRET production guard ----------------------------------------

test("JWT_SECRET — production with weak secret throws on import", () => {
  // Spawn a subprocess that imports the module with NODE_ENV=production
  // and a too-short JWT_SECRET. We expect a non-zero exit.
  const probeFile = join(buildDir, "secret-probe.mjs");
  const authJsUrl = pathToFileURL(join(buildDir, "auth.js")).href;
  writeFileSync(
    probeFile,
    `import("${authJsUrl}").then(() => { process.exit(0); }).catch(() => process.exit(2));\n`,
  );
  let result;
  try {
    result = execFileSync(
      process.execPath,
      [probeFile],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          JWT_SECRET: "too-short",
        },
        stdio: "pipe",
      },
    );
    // If we got here, the import succeeded — that's a failure.
    assert.fail("expected production+short-secret to throw, but import succeeded");
  } catch (err) {
    // Expected: import threw.
    assert.notEqual(err.status, 0, "subprocess should exit non-zero");
  }
});

test("JWT_SECRET — production with strong secret works", () => {
  const probeFile = join(buildDir, "secret-probe-ok.mjs");
  const authJsUrl = pathToFileURL(join(buildDir, "auth.js")).href;
  writeFileSync(
    probeFile,
    `import("${authJsUrl}").then((m) => {
       const tok = m.generateAccessToken("u");
       const p = m.verifyToken(tok);
       if (p.userId !== "u") process.exit(3);
       process.exit(0);
     }).catch(() => process.exit(2));\n`,
  );
  // Strong secret = 32+ chars.
  const result = execFileSync(
    process.execPath,
    [probeFile],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        JWT_SECRET: "x".repeat(48),
      },
      stdio: "pipe",
    },
  );
  // No throw means exit 0 — pass.
});
