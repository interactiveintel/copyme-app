// MIME-sniff tests (Tier B2) — covers signature matching, extension allow-
// list, size cap, and the SIG_MISMATCH error path.
//
// Run:  node scripts/test-sniff.mjs

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-sniff-"));

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
    resolve(repoRoot, "src/lib/media/sniff.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "sniff.js")).href);
const { sniff, ALLOWED_EXT, MAX_DOC_BYTES } = mod;

// ----- Helpers ------------------------------------------------------------

function buf(...bytes) {
  return new Uint8Array(bytes);
}

function pad(prefix, totalLen) {
  const out = new Uint8Array(totalLen);
  out.set(prefix, 0);
  return out;
}

// ----- Signature matches --------------------------------------------------

test("sniff — JPEG magic bytes detected as image/jpeg", () => {
  const b = pad(buf(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10), 100);
  const r = sniff(b, "photo.jpg");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "image/jpeg");
});

test("sniff — JPEG with .jpeg extension also matches", () => {
  const b = pad(buf(0xff, 0xd8, 0xff), 100);
  const r = sniff(b, "photo.jpeg");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "image/jpeg");
});

test("sniff — PNG magic bytes detected as image/png", () => {
  const b = pad(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 100);
  const r = sniff(b, "graphic.png");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "image/png");
});

test("sniff — GIF magic bytes detected as image/gif", () => {
  const b = pad(buf(0x47, 0x49, 0x46, 0x38), 100);
  const r = sniff(b, "anim.gif");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "image/gif");
});

test("sniff — PDF magic bytes detected as application/pdf", () => {
  const b = pad(buf(0x25, 0x50, 0x44, 0x46), 100);
  const r = sniff(b, "doc.pdf");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "application/pdf");
});

test("sniff — MP4 ftyp box at offset 4 detected", () => {
  // First 4 bytes can be anything (box size); offset 4-7 must be "ftyp".
  const b = pad(buf(0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70), 100);
  const r = sniff(b, "movie.mp4");
  assert.equal(r.ok, true);
  assert.equal(r.mime, "video/mp4");
});

// ----- Extension allow-list ----------------------------------------------

test("sniff — disallowed extension .exe rejected with EXT_NOT_ALLOWED", () => {
  const b = pad(buf(0x4d, 0x5a), 100); // PE header
  const r = sniff(b, "malware.exe");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "EXT_NOT_ALLOWED");
});

test("sniff — no extension at all rejected", () => {
  const b = pad(buf(0xff, 0xd8, 0xff), 100);
  const r = sniff(b, "noext");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "EXT_NOT_ALLOWED");
});

// ----- Mismatched extensions ----------------------------------------------

test("sniff — .png file with JPEG bytes rejected with SIG_MISMATCH", () => {
  const b = pad(buf(0xff, 0xd8, 0xff), 100); // JPEG magic
  const r = sniff(b, "lying.png");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "SIG_MISMATCH");
});

test("sniff — .jpg file with PNG bytes rejected with SIG_MISMATCH", () => {
  const b = pad(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 100);
  const r = sniff(b, "lying.jpg");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "SIG_MISMATCH");
});

test("sniff — .pdf file with random bytes rejected", () => {
  const b = pad(buf(0xde, 0xad, 0xbe, 0xef), 100);
  const r = sniff(b, "fake.pdf");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "SIG_MISMATCH");
});

// ----- Size cap -----------------------------------------------------------

test("sniff — file over 25MB rejected with TOO_LARGE", () => {
  const huge = new Uint8Array(MAX_DOC_BYTES + 1);
  huge[0] = 0xff; huge[1] = 0xd8; huge[2] = 0xff; // valid JPEG, but too big
  const r = sniff(huge, "big.jpg");
  assert.equal(r.ok, false);
  assert.equal(r.reason, "TOO_LARGE");
});

test("sniff — file at exactly the cap is allowed (size check is strict >)", () => {
  const cap = new Uint8Array(MAX_DOC_BYTES);
  cap[0] = 0xff; cap[1] = 0xd8; cap[2] = 0xff;
  const r = sniff(cap, "biggest.jpg");
  // We expect ok=true since the check is `>` not `>=`.
  assert.equal(r.ok, true);
  assert.equal(r.mime, "image/jpeg");
});

// ----- Allowed extension list ---------------------------------------------

test("ALLOWED_EXT — contains common formats", () => {
  for (const ext of ["jpg", "jpeg", "png", "gif", "webp", "mp4", "pdf"]) {
    assert.ok(ALLOWED_EXT.has(ext), `expected ALLOWED_EXT to contain ${ext}`);
  }
});

test("ALLOWED_EXT — does NOT contain executables / scripts", () => {
  for (const ext of ["exe", "sh", "js", "html", "php"]) {
    assert.equal(ALLOWED_EXT.has(ext), false, `unexpected ext ${ext}`);
  }
});
