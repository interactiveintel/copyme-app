// EXIF-strip tests (Tier B2). Hand-craft minimal JPEG / PNG byte streams
// with metadata segments and verify they're removed.
//
// JPEG:
//   SOI(FFD8) APP1(FFE1, len, "Exif\0\0", body…) DQT(FFDB,len,…)
//   SOS(FFDA, len, …) <scan data> EOI(FFD9)
//
// PNG:
//   PNG_SIG  IHDR  tEXt  IDAT  IEND
//
// Run:  node scripts/test-exif-strip.mjs

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-exif-"));

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
    resolve(repoRoot, "src/lib/media/exif-strip.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "exif-strip.js")).href);
const { stripExif, containsExifMarker } = mod;

// ----- JPEG helpers -------------------------------------------------------

function makeJpegWithExif() {
  // SOI: FFD8
  // APP1 segment: FFE1 [length-2-bytes] "Exif\0\0" + 10 bytes of fake EXIF
  const exifBody = Uint8Array.from([
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, // body
  ]);
  const app1Len = 2 + exifBody.length; // length includes the 2-byte length field itself
  const app1 = [0xff, 0xe1, (app1Len >> 8) & 0xff, app1Len & 0xff, ...exifBody];

  // DQT segment: FFDB [length=4] [2 bytes payload]
  const dqt = [0xff, 0xdb, 0x00, 0x04, 0x00, 0x00];

  // SOS marker FFDA + 4 bytes of "scan" data + EOI
  const sos = [0xff, 0xda, 0x00, 0x02, 0xaa, 0xbb, 0xcc, 0xdd];
  const eoi = [0xff, 0xd9];

  return new Uint8Array([0xff, 0xd8, ...app1, ...dqt, ...sos, ...eoi]);
}

// ----- JPEG tests ---------------------------------------------------------

test("stripExif JPEG — APP1 EXIF segment is removed", () => {
  const original = makeJpegWithExif();
  assert.equal(containsExifMarker(original), true, "fixture should contain Exif marker");

  const stripped = stripExif(original, "image/jpeg");
  assert.equal(containsExifMarker(stripped), false, "Exif marker should be gone");
});

test("stripExif JPEG — DQT and scan data preserved", () => {
  const stripped = stripExif(makeJpegWithExif(), "image/jpeg");
  // SOI must remain
  assert.equal(stripped[0], 0xff);
  assert.equal(stripped[1], 0xd8);
  // DQT marker FFDB must still be present somewhere
  let hasDqt = false;
  for (let i = 0; i < stripped.length - 1; i++) {
    if (stripped[i] === 0xff && stripped[i + 1] === 0xdb) { hasDqt = true; break; }
  }
  assert.equal(hasDqt, true, "DQT segment should be preserved");
  // EOI at the end
  assert.equal(stripped[stripped.length - 2], 0xff);
  assert.equal(stripped[stripped.length - 1], 0xd9);
});

test("stripExif JPEG — output is shorter than input (segment removed)", () => {
  const original = makeJpegWithExif();
  const stripped = stripExif(original, "image/jpeg");
  assert.ok(stripped.length < original.length, "stripped output should be shorter");
});

test("stripExif JPEG — image/jpg mime alias works", () => {
  const original = makeJpegWithExif();
  const stripped = stripExif(original, "image/jpg");
  assert.equal(containsExifMarker(stripped), false);
});

test("stripExif JPEG — non-JPEG bytes returned unchanged for image/jpeg", () => {
  // Bytes that don't start with FFD8 — fall-through path.
  const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const out = stripExif(garbage, "image/jpeg");
  assert.equal(out.length, 4);
  assert.equal(out[0], 0x00);
});

// ----- PNG helpers --------------------------------------------------------

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function be32(n) {
  return [(n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function chunk(type, data) {
  // PNG chunk: len (BE32) | type (4 ASCII) | data | crc (BE32 — we use 0 for tests)
  const typeBytes = [type.charCodeAt(0), type.charCodeAt(1), type.charCodeAt(2), type.charCodeAt(3)];
  return [...be32(data.length), ...typeBytes, ...data, 0, 0, 0, 0];
}

function makePngWithText() {
  const ihdr = chunk("IHDR", [
    0, 0, 0, 1, // width 1
    0, 0, 0, 1, // height 1
    8, 0, 0, 0, 0, // bit depth, color type, …
  ]);
  const tEXt = chunk("tEXt", [
    0x53, 0x6f, 0x66, 0x74, 0x77, 0x61, 0x72, 0x65, // "Software"
    0x00,
    0x53, 0x6e, 0x65, 0x61, 0x6b, 0x79, // "Sneaky"
  ]);
  const idat = chunk("IDAT", [0x78, 0x9c, 0x62, 0x00, 0x00]);
  const iend = chunk("IEND", []);
  return new Uint8Array([...PNG_SIG, ...ihdr, ...tEXt, ...idat, ...iend]);
}

function findChunk(buf, type) {
  for (let i = PNG_SIG.length; i + 8 < buf.length; i++) {
    const t = String.fromCharCode(buf[i + 4], buf[i + 5], buf[i + 6], buf[i + 7]);
    if (t === type) return i;
  }
  return -1;
}

// ----- PNG tests ----------------------------------------------------------

test("stripExif PNG — tEXt chunk is removed", () => {
  const original = makePngWithText();
  // sanity: tEXt is present
  assert.notEqual(findChunk(original, "tEXt"), -1);

  const stripped = stripExif(original, "image/png");
  assert.equal(findChunk(stripped, "tEXt"), -1, "tEXt chunk should be removed");
});

test("stripExif PNG — IHDR / IDAT / IEND preserved", () => {
  const stripped = stripExif(makePngWithText(), "image/png");
  assert.notEqual(findChunk(stripped, "IHDR"), -1, "IHDR preserved");
  assert.notEqual(findChunk(stripped, "IDAT"), -1, "IDAT preserved");
  assert.notEqual(findChunk(stripped, "IEND"), -1, "IEND preserved");
});

test("stripExif PNG — PNG signature preserved", () => {
  const stripped = stripExif(makePngWithText(), "image/png");
  for (let i = 0; i < PNG_SIG.length; i++) {
    assert.equal(stripped[i], PNG_SIG[i], `PNG sig byte ${i}`);
  }
});

test("stripExif PNG — non-PNG bytes returned unchanged", () => {
  const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
  const out = stripExif(garbage, "image/png");
  assert.equal(out.length, 4);
});

// ----- Pass-through -------------------------------------------------------

test("stripExif — unknown MIME passes through unchanged", () => {
  const data = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x12, 0x34]);
  const out = stripExif(data, "application/octet-stream");
  assert.deepEqual(Array.from(out), Array.from(data));
});

test("stripExif — webp passes through unchanged (not in strip list)", () => {
  const data = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);
  const out = stripExif(data, "image/webp");
  assert.deepEqual(Array.from(out), Array.from(data));
});

// ----- containsExifMarker -------------------------------------------------

test("containsExifMarker — true when 'Exif\\0\\0' present", () => {
  const buf = new Uint8Array([0xff, 0x00, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0xff]);
  assert.equal(containsExifMarker(buf), true);
});

test("containsExifMarker — false when missing", () => {
  const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x00, 0xff, 0xd9]);
  assert.equal(containsExifMarker(buf), false);
});
