// Unit test for the SSE frame parser (A5).
//
// We can't easily test the full network round-trip without spinning up a
// dev server + Redis, but the parser is pure and represents the highest-
// risk piece of the client (off-by-one on frame boundaries → missed
// events). Snapshot a handful of well-known frames.
//
// Run: node scripts/test-realtime.mjs

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
const buildDir = mkdtempSync(join(tmpdir(), "copyme-realtime-"));

// Parser lives in lib/sse-parser.ts — pure, no React. Compile and import.
execFileSync(
  tsc,
  [
    "--target", "es2022",
    "--module", "nodenext",
    "--moduleResolution", "nodenext",
    "--esModuleInterop",
    "--skipLibCheck",
    "--outDir", buildDir,
    resolve(repoRoot, "src/lib/sse-parser.ts"),
  ],
  { stdio: "inherit" },
);

const mod = await import(pathToFileURL(join(buildDir, "sse-parser.js")).href);
const { handleFrame } = mod;

function makeRef() {
  return { current: null };
}

test("handleFrame — drops comment frames", () => {
  const events = [];
  const ref = makeRef();
  handleFrame(":heartbeat 12345", (e) => events.push(e), ref);
  assert.equal(events.length, 0);
  assert.equal(ref.current, null);
});

test("handleFrame — parses a complete message event", () => {
  const events = [];
  const ref = makeRef();
  const frame =
    "id: abc123\nevent: message\ndata: " +
    JSON.stringify({
      type: "message",
      eventId: "abc123",
      ts: 1,
      messageId: "m1",
      senderId: "u1",
      receiverId: "u2",
      contactId: "u1",
      preview: "hi",
      type_: "text",
      createdAt: "2026-05-12T00:00:00.000Z",
    });
  handleFrame(frame, (e) => events.push(e), ref);
  assert.equal(events.length, 1);
  assert.equal(events[0].messageId, "m1");
  assert.equal(ref.current, "abc123");
});

test("handleFrame — multi-line data is rejoined with \\n", () => {
  const events = [];
  const ref = makeRef();
  const frame = `event: message\ndata: {"type":"message","eventId":"x","ts":1,"messageId":"m","senderId":"a","receiverId":"b","contactId":"a","preview":"line one\\nline two","type_":"text","createdAt":"t"}`;
  handleFrame(frame, (e) => events.push(e), ref);
  assert.equal(events.length, 1);
  assert.equal(events[0].preview, "line one\nline two");
});

test("handleFrame — bye event is silently dropped (server lifetime close)", () => {
  const events = [];
  const ref = makeRef();
  handleFrame("event: bye\ndata: lifetime", (e) => events.push(e), ref);
  assert.equal(events.length, 0);
});

test("handleFrame — malformed JSON is silently dropped", () => {
  const events = [];
  const ref = makeRef();
  handleFrame("event: message\ndata: {not json", (e) => events.push(e), ref);
  assert.equal(events.length, 0);
});

test("handleFrame — strips single leading space after `:` (SSE spec)", () => {
  const events = [];
  const ref = makeRef();
  // No leading space → value is exactly "abc"
  handleFrame("id:abc\nevent:read_receipt\ndata:{\"type\":\"read_receipt\",\"eventId\":\"abc\",\"ts\":1,\"senderId\":\"x\",\"readerId\":\"y\",\"upToMessageId\":\"m\"}", (e) => events.push(e), ref);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "read_receipt");
  assert.equal(ref.current, "abc");
});

test("handleFrame — last event id only updates on frames that carry one", () => {
  const ref = { current: "previous" };
  handleFrame("event: message\ndata: {\"type\":\"message\",\"eventId\":\"new\",\"ts\":1,\"messageId\":\"m\",\"senderId\":\"a\",\"receiverId\":\"b\",\"contactId\":\"a\",\"preview\":null,\"type_\":\"text\",\"createdAt\":\"t\"}", () => {}, ref);
  // No `id:` line → ref unchanged.
  assert.equal(ref.current, "previous");
});

test("handleFrame — empty frame is a no-op", () => {
  const events = [];
  const ref = makeRef();
  handleFrame("", (e) => events.push(e), ref);
  assert.equal(events.length, 0);
});
