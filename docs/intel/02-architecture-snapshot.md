# 02 — Architecture Snapshot

**Source synthesis:** `CopyMe_Architecture_Review_23Apr2026.docx`,
`CpM_Developer_Specification.docx` §2–§6, current state of `copyme-app/`
(post-Sprint-0 + Phase-1 work landed 2026-05-09 → 2026-05-10).

This is the snapshot you'd want before joining the project as an engineer
or auditing it as a CTO. Where the original spec called for a heavier stack
(microservices on Kubernetes with Kong API gateway, MongoDB + Elasticsearch +
Kafka), the **as-built** is a leaner, Vercel-native single Next.js
application. That divergence is intentional and well-suited to the $100M
target (per `CopyMe_Revised_100M_Assessment.docx`).

## 1. Topology

A single **Vercel-deployed Next.js 15** application hosts:

* **Marketing surface** — `/`, `/pricing`, `/pitch`, `/press`, `/privacy`, `/terms`, `/reset`, `/verify`, plus the new `/transparency/ads` (S-238) and `/admin/ruleof7` (S-117).
* **Authenticated app** — `/app/*` (inbox, chat, search, profile, Yogi).
* **Sign-up flow** — `/signup` (the new Phase 1 phone-first three-step flow).
* **Admin surface** — `/admin/*` (gated by `ADMIN_USER_IDS` env var allow-list).
* **API routes** — under `/api/*`, all in the same Next.js runtime.

Edge middleware (`src/middleware.ts`) handles CORS + JWT decode + the
`x-user-id` forwarding header. Per-route handlers re-verify the JWT.

## 2. Stack

| Layer | What's used | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.14 |
| UI runtime | React | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS | ^4 |
| Animation | framer-motion | ^12.38 |
| Icons | lucide-react | ^1.7 |
| ORM | Prisma | ^7.6 |
| DB driver | `@prisma/adapter-pg` + `pg` | ^7.6 / ^8.20 |
| Cache | ioredis (Redis) | ^5.10 |
| AI | `@anthropic-ai/sdk` | ^0.82 |
| Auth | jsonwebtoken + bcryptjs | ^9.0 / ^3.0 |
| Realtime (declared, not wired) | socket.io / -client | ^4.8 |
| Errors | @sentry/nextjs | ^10.49 |
| IDs | uuid | ^13.0 |

External services degrade gracefully when env vars are missing — AI returns
503, mailer logs to console, Stripe checkout returns an error. Critical
production env vars: `DATABASE_URL`, `JWT_SECRET` (≥32 chars, enforced),
`ANTHROPIC_API_KEY`, `CRON_SECRET`, VAPID keys.

## 3. Data model — what's in PostgreSQL

The Prisma schema declares **31 models** across 8 functional groups
(after Phase 1 + 2 + 3 additions). Highlights:

* **Identity** — `User` (with `phoneHash`, `emailHash`, `phoneEncrypted`,
  `emailEncrypted`, `passwordHash`, `referralCode`), `UserLocation`,
  `UserInterest` (composite key on slot 1–7), `UserDescription`.
* **Communication** — `Message`, `Group`, `GroupMember`, `Contact`.
* **AI** — `YogiPersonality`, `YogiMessage`, `YogiCostLog` (per-day
  micro-USD cost tracking).
* **Subscriptions** — `Subscription` (carries explicit numeric caps per
  tier; defaults to 7).
* **Ads** — `BusinessAd` (with `targetInterests` JSON, `priceMicroUsd`,
  Stripe checkout id), `AdEventDay` (per-day impression/click bucket).
* **Safety** — `UserBlock` (composite key), `UserReport`, `AccountSuspension` (S-175).
* **Phase 1.1 additions (from this session)** — `PhoneOtp`, `Session`,
  `RecoveryFile`, `AccountDeletion`.
* **Phase 2 additions** — `Survey`, `SurveyResponse`.
* **Phase 3 placeholders** — `VapAccount`, `VapTransaction` (no API routes
  reference yet).

PII practice: phone + email are stored as **SHA-256 hashes** (for uniqueness
checks) plus **AES-256 encrypted blobs** (for recovery / notification
delivery). Per the architecture review:
> "An important privacy posture that matches the Developer Specification."

## 4. API surface

**60+ endpoints** as of 2026-05-10 (the architecture review counted 43 on
2026-04-23; Phase 1 + 2 work added ~20).

* **Auth (12)** — register, login, refresh, email verify-request, email verify, password-reset request + confirm, **phone send + verify + complete (S-101–S-105)**, **sessions GET/DELETE (S-106)**, **recovery + redeem (S-108)**, **account/delete + export (S-109 + S-146)**.
* **Messages (3)** — send, inbox, mark-read.
* **Contacts (2)** — list/add, delete; plus `/api/auth/onboarding/contacts` (S-104).
* **Users (5)** — me, me/referral, suggested, [id]/block, blocked.
* **Search (1)** — users.
* **Agents (6)** — yogi, chat-assist, moderate, onboarding, smart-match, **yogi/smart-replies (S-207)**.
* **Ads & Business (8)** — business/ads CRUD, checkout, analytics, ads/inbox, ads/[id]/click, plus **public ad transparency (S-238)**.
* **Admin (5)** — admin/ads, admin/ads/[id], admin/metrics, **admin/ruleof7 (S-117)**, **admin/yogi-quality (S-208)**, **admin/suspensions (S-175)**.
* **Notifications (2)** — public-key, subscribe.
* **Cron (1)** — daily-digest.
* **Webhooks (1)** — stripe.
* **Misc** — presence, reports, **blocks (S-172)**, waitlist, pitch (export + metrics), surveys CRUD + results.
* **Billing (2)** — `/api/billing/checkout` + `/api/billing/portal` (S-243).

## 5. Real-time + caching

Three Redis caches do load-bearing work:

1. **Inbox cache** — last 7 messages per (user, contact), 24h TTL.
2. **Presence map** — 5-min TTL, online badges.
3. **Rate-limit counters** — per-user sliding window, used by login + Yogi.

Real-time delivery is **polling-based today** (clients poll
`/api/messages/inbox`). `socket.io` is declared in `package.json` but not
wired. **Risk noted in the architecture review:** at the 100M-user target,
pure polling is expensive — a dedicated socket.io worker, Vercel Edge
streaming, or a managed provider should land before public scale-out.

## 6. Auth

* **JWT** with two-token scheme: 15-min access + 7-day refresh.
* **Bcrypt** at 12 rounds for passwords.
* **Refresh rotation** is single-use (S-107): the old session row is
  revoked on each refresh; presenting an already-rotated token marks every
  live session `replayDetectedAt` and the UI shows a banner.
* **Sessions** are tracked per device; a user can list and revoke them at
  `/api/auth/sessions`.
* **Phone OTP** (S-101 / S-103) via provider-agnostic `lib/otp/index.ts`
  with primary → fallback (Twilio → MessageBird → mock).
* **Recovery file** (S-108) — single-use secret + optional secondary phone.

## 7. Encryption (E2E) — current state

Per the Phase 1.5 work landed:

* **Decision:** Signal Protocol via `libsignal-client` for 1:1 (decision doc
  in `docs/architecture/2026-05-encryption-protocol.md`). Currently
  scaffolded with WebCrypto-backed ECDH-P256 + AES-GCM as a stand-in.
* **Identity key** — generated at signup, stored in IndexedDB
  (`lib/e2e/keys.ts`); production will move to OS keychain via Capacitor.
* **Session key** — derived per (recipientId, day-bucket) via HKDF-SHA-256;
  rotates every 7 days.
* **Safety number** — 60-digit decimal grouped 5×12 (Signal-style),
  derivable on the client (`safetyNumber()`).
* **Server holds ciphertext only** — verified by the test plan in
  `docs/architecture/2026-05-encryption-protocol.md`.

## 8. Observability + ops

* **Sentry** — wired front + back via `instrumentation.ts` and
  `sentry.*.config.ts`. PII scrubbed (`sendDefaultPii: false`).
* **Synthetic monitor** (S-184) — `scripts/synthetic-monitor.mjs` checks
  landing + manifest + OTP send canary; alert webhook on 2 consecutive
  failures.
* **Feature flags** (S-186) — `lib/feature-flags.ts` with env + localStorage
  fallback; `setFlagEvaluator()` seam for Statsig/OpenFeature later.
* **CI** — `.github/workflows/ci.yml` runs lint + typecheck +
  `npm run test:all` + build on every PR.
* **Load test** — `scripts/load/k6-signup.js` ramps 1k → 10k VUs against
  the signup flow; p95 threshold 600ms.
* **DR runbook** — `docs/ops/dr.md`; quarterly drill required before launch.

## 9. What's NOT in production yet

| Capability | Why not | Where it lands |
|---|---|---|
| Real-time WebSocket delivery | Architecture review flagged as a scale risk | Phase 1.10 (S-194 launch) or Phase 2 |
| Translation (per-message language) | Schema columns exist; no service call | Phase 2 (international rollout) |
| libsignal proper (vs WebCrypto stand-in) | Wasm dep + Capacitor wiring needed | Phase 1.5 follow-up |
| App Store + Play submissions | Needs Apple/Play developer accounts | Phase 1.7 follow-up |
| Real BaaS partner (Solaris/Marqeta/Treezor) | Counsel + commercial negotiation | Phase 3.1 (S-302 — blocked) |
| Real KYC sandbox keys (Sumsub) | Vendor account needed | Phase 3.2 (S-312 — blocked) |
| Microservices / Kong / Kubernetes | Deliberately deferred — Vercel-native is enough until $100M | Re-evaluate at Series A |
| MongoDB + Elasticsearch + Kafka | Postgres + Redis cover Phase 1+2 needs | Re-evaluate at scale |

## 10. The intentional simplifications vs the original spec

The original developer spec (`CpM_Developer_Specification.docx`, April 4)
called for a heavier stack. The actual build is leaner. Both are correct —
the heavier stack is the eventual target; the lean stack is the right
trade-off for the $100M trajectory:

| Spec component | What we run instead | Why |
|---|---|---|
| Kong API gateway | Next.js middleware + per-route auth | Same effect with one fewer hop |
| Node.js / Go microservices | Single Next.js app | Latency, simplicity, deploy speed |
| WebSocket + Redis Pub/Sub | Polling + Redis cache | Acceptable < 10M users; planned upgrade |
| Elasticsearch search | PostgreSQL `ILIKE` + interest scoring | Sufficient for ≤700-result tier caps |
| MongoDB (profiles) | PostgreSQL + JSONB columns | One DB, one ops surface |
| Kafka event streaming | Vercel cron + observability breadcrumbs | Phase 1 events are low-volume |
| TURN servers | Webcam/mic via WebRTC stub | Calls are flag-gated (S-136) |
| Kubernetes | Vercel | One-click deploy, edge included |

The architecture review (April 23) explicitly endorses this trajectory:
> "The codebase is cohesive, well-organized, and faithful to the CopyMe
> specification. … The product is in a credible position to launch a Phase
> 1 beta."

## 11. Migration history

Nine Prisma migrations applied between 2026-04-05 and 2026-04-23, plus the
new Phase 1.1 / Phase 2 additions from this session.

(See `prisma/migrations/` for chronology. The most consequential are
`20260405_init`, `20260422_yogi_production`, `20260422_business_ads`, and
`20260423_referrals`.)

## 12. Known risks and mitigations

| Risk | Source | Mitigation |
|---|---|---|
| Polling-based delivery at scale | Architecture review §7.1 | Plan socket.io worker before public scale beyond ~100K MAU |
| `next.config.ts` disables TS+ESLint errors during build | Architecture review §7.3 | Re-enable + CI gating before public launch |
| Test coverage minimal (only phone + ruleof7 unit tests today) | Architecture review §7.2 | Expand to auth, sessions, billing, webhooks |
| Phase 3 (VAP) requires standalone fintech-grade compliance | Architecture review §7.4 | Defer until $100M reached from Phase 1+2 |
| Translation columns exist with no service | Architecture review §7.5 | Wire on first international demand signal |
| Yogi token spend can balloon | Architecture review §6 | Per-user daily cap ($0.10) + S-204 budget meter + S-208 dashboard |
