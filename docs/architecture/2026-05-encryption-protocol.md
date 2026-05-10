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
