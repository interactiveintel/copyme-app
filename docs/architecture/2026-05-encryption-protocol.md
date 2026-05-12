# E2E protocol selection — decision record (S-141)

**Date:** 2026-05-10
**Status:** Decided · pending implementation in S-142+

## Decision

Adopt the **Signal Protocol** via `libsignal-client` for all 1:1 messaging.
Group messages (S-126 emojis aside) will use **Sender Keys** when groups
ship in a later sprint.

## Why Signal

| Criterion | Signal Protocol | MLS (RFC 9420) | Custom |
|---|---|---|---|
| Maturity (deployed at scale) | ✅ Signal, WhatsApp, FB Messenger | 🟡 newer, fewer prod deployments | ❌ |
| Audited / formal proofs | ✅ multiple academic reviews | 🟡 newer | ❌ |
| Library available (TS / Wasm) | ✅ `@signalapp/libsignal-client` | 🟡 limited TS bindings | n/a |
| Group scaling | 🟡 fan-out N (acceptable up to 7-member rooms) | ✅ tree-based, scales | n/a |
| Future-fit for Yogi (S-203) | ✅ subprocessor sees ciphertext only | ✅ same | ✅ same |

CopyMe's group cap is 7 (Rule of 7), so Signal's per-recipient fan-out
cost is bounded and acceptable.

## Architecture

```
┌────────┐  signed prekey   ┌────────────┐
│ Device │ ───────────────▶ │  Server    │ ── stores public bundles only
└────────┘                  │ (Postgres) │
   │                        └────────────┘
   │  encrypt(text, recipientBundle)        ┌────────┐
   ├──────────────────────────────────────▶ │ Server │
   │                                        └────────┘
   │                                            │
   │              ciphertext only               │
   │ ◀────────────────────────────────────────┘
   ▼
 decrypt with own session
```

* **Identity key** generated at signup, stored in OS keychain (Keychain on iOS,
  Keystore on Android, IndexedDB + WebCrypto for the PWA fallback).
* **Pre-keys** (signed + 100 one-time) uploaded post-signup; replenished by
  the client when the server's stash drops below 10.
* **Session keys** rotate every 7 days (mirrors the Rule-of-7 retention
  policy).
* **Server holds ciphertext only** — verified by the test in S-142 AC.

## Open questions for follow-up

1. PWA key storage: WebCrypto + IndexedDB is exposed to XSS; we mitigate
   by serving the app under strict CSP (S-181 baseline) and a Service
   Worker that wraps key access.
2. Multi-device sync: Signal's "linked-device" model uses pairing QR;
   CopyMe will reuse the same UX (planned S-144).
3. Backup strategy: by default we DO NOT back up the secret. The recovery
   file (S-108) lets users regenerate identity but loses prior message
   history. This matches WhatsApp's default and is consistent with
   "live in the present" framing.

## Implementation order

| Sprint | What |
|---|---|
| S-141 | This doc, key generation stub, IndexedDB key store |
| S-142 | Per-message encrypt/decrypt; bundle exchange API |
| S-143 | Chunked media encrypt/decrypt; CDN serves ciphertext |
| S-144 | Safety-number screen + change alerts |
| S-145 | Privacy controls UI (presence, receipts, last-seen, transcripts) |
| S-146 | Data-export ZIP (GDPR Art. 15) |

## Implementation status — 2026-05-12 (Tier B1)

Tier B1 swapped the WebCrypto stand-in for the real Signal Protocol via
`@signalapp/libsignal-client@0.94.0`. The relevant files:

* `src/lib/e2e/libsignal.ts` — real Signal stack: X3DH initial agreement,
  Double Ratchet, PQXDH (Kyber 1024 augmentation), per-recipient sessions.
  Exports `ensureIdentity`, `getPreKeyBundle`, `encryptForRecipient`,
  `decryptFromSender`, `safetyNumber`. Round-trip tested end-to-end in
  `scripts/test-e2e.mjs` (Alice ↔ Bob: X3DH first message, Whisper-typed
  ratchet messages once a reply lands, bidirectional ratcheting).
* `src/lib/e2e/store.ts` — pluggable KV backing the protocol stores.
  IndexedDB (`copyme-signal` database) when `indexedDB` is defined,
  in-memory `MemoryKv` everywhere else (Node tests, server-side use).
  All five Signal stores are wired: `IdentityKeyStore`, `PreKeyStore`,
  `SignedPreKeyStore`, `KyberPreKeyStore`, `SessionStore`.
* `src/lib/e2e/keys.ts` and `src/lib/e2e/cipher.ts` — the original
  WebCrypto stand-in is **kept** as a fallback for browser/Edge contexts
  where the libsignal native addon cannot load. Callers consult
  `LIBSIGNAL_AVAILABLE` (or `libsignalAvailable()`) and pick a path.
* `next.config.ts` — adds `serverExternalPackages: ["@signalapp/libsignal-client"]`
  so Webpack does not try to bundle the native `.node` prebuilds into the
  client chunk.

### Runtime constraint

`@signalapp/libsignal-client` 0.94.0 is a **native Node addon**, not wasm.
That means:

* The libsignal path runs **only in the Node runtime** (`export const runtime = "nodejs"`
  on any Server Component / Route Handler that imports `libsignal.ts`).
* The Edge runtime cannot load it.
* The browser cannot load it (no wasm build at this version).

Because the long-term Signal model requires private key material to live
on the device, the browser path will eventually need a wasm port (Signal
distribute one for the desktop client; expected to land in a future
`@signalapp/libsignal-client` release). Until then the **WebCrypto
fallback in `cipher.ts`/`keys.ts` is the active code path for PWA
clients** and the libsignal layer is used by server-side ratchet helpers
and tests. Migration story: when libsignal-wasm ships, the browser
detects `LIBSIGNAL_AVAILABLE === true`, fresh users get libsignal
identities into `copyme-signal`, and the legacy `copyme-e2e` IndexedDB
records are migrated lazily on first send.

### What now matches Signal proper vs what's still scaffolded

| Capability | Status |
|---|---|
| Identity key (X25519, IdentityKeyPair) | libsignal-backed |
| Signed pre-key (Curve25519 sig over EC pub) | libsignal-backed |
| One-time pre-keys | libsignal-backed (1 per `getPreKeyBundle()`) |
| PQ pre-key (Kyber 1024, signed) | libsignal-backed |
| X3DH initial agreement | libsignal-backed via `processPreKeyBundle` |
| Double Ratchet (forward + future secrecy) | libsignal-backed via `signalEncrypt`/`signalDecrypt` |
| Out-of-order message handling | libsignal-backed (skipped-key cache lives inside SessionRecord) |
| Safety number (60-digit Signal-style) | libsignal-backed via `Fingerprint.displayableFingerprint` |
| Sealed sender | not yet wired — placeholder noted in `libsignal.ts` |
| Sender Keys (group messaging) | not started; needed when groups ship |
| Pre-key replenishment policy | scaffolded (caller responsibility — refill below 10) |
| Multi-device linking | not started (S-144 follow-up) |
| Browser path | **WebCrypto fallback** (no wasm libsignal yet) |
