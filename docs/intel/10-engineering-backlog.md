# 10 — Engineering Backlog: What's Left to Code for Full Functionality

**Anchor doc:** `Production model instructions.docx` (2026-04-04).
**Last updated:** 2026-05-12, after the v4.3.2 deploy + `copyme1.com` domain wiring.

This document answers the question "what next has to be coded to make
CopyMe fully functional?" It cross-checks every gap the original
production-readiness doc flagged against the current codebase, then lays
out the remaining engineering work in dependency order with effort
estimates.

---

## Part 1 — How the original gap list closed

From `Production model instructions.docx`, the five categories of "missing for production":

### 1. "No Real Backend"

| Original gap | Status today | Evidence |
|---|---|---|
| Auth was fake (Sign In just navigated to inbox) | ✅ **Closed** | JWT register/login/refresh end-to-end. Phone-OTP signup at `/signup`. Single-use refresh rotation with replay detection (S-107). |
| No database connected (Prisma schema only) | ✅ **Closed** | Neon Postgres, 10 migrations applied, 31 models live. |
| No user accounts, sessions, JWT verification | ✅ **Closed** | `Session` model with device-id rotation. JWT verified per route. |
| Conversations / contacts / messages hardcoded | ✅ **Closed** | All flow through Prisma. Mock data only used in the inbox UI fallback when API returns empty. |

### 2. "No Real Messaging"

| Original gap | Status today | What's still needed |
|---|---|---|
| No WebSocket or real-time messaging | ⚠️ **Partial** — polling-based delivery works | **C1**: socket.io worker for instant delivery (long pole) |
| No message storage or retrieval | ✅ **Closed** | `Message` model + `/api/messages/send` + `/api/messages/inbox` with Redis cache |
| Rule of 7 constraints not enforced — just displayed | ✅ **Closed** | Server-side validation (`lib/ruleOf7.ts`), telemetry (`lib/ruleOf7-metrics.ts`), 11 integration tests |

### 3. "No AI Integration"

| Original gap | Status today | What's still needed |
|---|---|---|
| AI agents have stubs but no Anthropic API key | ✅ **Closed** | Yogi in production with personality memory, cost caps, prompt caching |
| Smart Match shows fake compatibility scores | ✅ **Closed** | Real interest-overlap scoring in `lib/suggest-users.ts` |
| No actual content moderation | ✅ **Closed** | `/api/agents/moderate` + `lib/safety/hash-match.ts` (NCMEC) + `lib/safety/spam.ts` |

### 4. "No Infrastructure"

| Original gap | Status today | What's still needed |
|---|---|---|
| No PostgreSQL deployed | ✅ **Closed** | Neon (pooled + unpooled) |
| No Redis for real-time/session management | ✅ **Closed** | ioredis with 3 caches: inbox / presence / rate-limit |
| No file storage for media/avatars | ⚠️ **Partial** — Vercel Blob slot exists, not wired | **C3**: wire avatar + chat-media upload pipeline |
| No email verification or password reset | ✅ **Closed** | `/api/auth/email/verify` + `/api/auth/password-reset` |

### 5. "Security Gaps"

| Original gap | Status today | What's still needed |
|---|---|---|
| Middleware decodes JWT — doesn't verify signatures | ✅ **Closed** | Per-route handlers re-verify against `JWT_SECRET` (32-char min enforced in prod) |
| No rate limiting | ✅ **Closed** | Redis sliding window + memory fallback (`lib/rate-limit.ts`) |
| No input sanitization beyond basic email validation | ✅ **Closed** | Rule-of-7 + age-gate + phone validators; webhook HMAC verify |

**Net of the original doc: 16 of 18 sub-items are closed. The two open items (C1, C3) are in the backlog below.**

---

## Part 2 — The Engineering Backlog (what to code next)

Ordered by **dependency chain**, not effort. Items at the top unblock items below them. Each entry: identifier, what to build, where it lives, effort estimate (working-days for one engineer), sprint reference.

### Tier A — MVP completers (close Phase 1 to production-grade)

These finish the original spec. Without them, CopyMe is "functional" but not "fully functional."

| ID | What to build | Files | Effort | Sprint |
|---|---|---|---|---|
| ~~**A1**~~ | ✅ **DONE in v4.4.0** — Vercel Blob upload pipeline. `copyme-media` store provisioned + linked. `lib/blob.ts` + `/api/uploads/avatar` + `/api/uploads/message-media` + `/api/avatars/[seed]` shipped. `User.avatarUrl` added. Signup flow uploads after session exists. | shipped | done | S-105 / S-133 / S-134 |
| ~~**A2**~~ | ✅ **DONE in v4.4.0** — EXIF strip + MIME sniff now invoked inside `lib/blob.ts` on every server-side write. The libraries existed but weren't called; now they are. | shipped | done | S-133 follow-up |
| **A3** | **Translation pipeline.** On message send, if receiver's `preferredLocale` differs from sender's detected locale, call Anthropic (cheap Haiku) to translate. Store both in `Message.content`/`translatedText`. Inbox UI toggles between original/translated. | new `src/lib/translation.ts`, edits to `/api/messages/send`, `ChatScreen.tsx` (toggle chip) | **1.5d** | S-135 follow-up |
| **A4** | **Re-enable TS + ESLint strict in `next.config.ts`.** Today both are silenced at build time. CI catches them but local + Vercel builds can ship type errors. | `next.config.ts` (`typescript.ignoreBuildErrors=false`, `eslint.ignoreDuringBuilds=false`), plus 18 known pre-existing TS error fixes in `DemoModal.tsx`, `push.ts`, `use-web-push.ts`, `yogi.ts` | **1d** | pre-G3 hardening |
| **A5** | **Realtime delivery upgrade** (replace polling). Two viable paths: **(a)** Vercel Edge Streaming on a single `/api/messages/stream` SSE endpoint (zero infra change), **(b)** socket.io on a separate Node worker. Recommend **(a)** first — same code path stays on Vercel, scales to ~100K MAU without extra ops. | new `src/app/api/messages/stream/route.ts` (SSE), client subscription in `ChatScreen.tsx`, keep polling as fallback | **3d** SSE / **5d** socket.io | follow-up to S-194 |

**Tier A total: ~7 days of one engineer to close the last MVP gaps.**

### Tier B — Quality + hardening (before public launch)

| ID | What to build | Files | Effort |
|---|---|---|---|
| **B1** | **libsignal proper** — replace the ECDH-P256 + AES-GCM stand-in with `@signalapp/libsignal-client` (wasm). Get X3DH + Double Ratchet correct. | `src/lib/e2e/*` rewrite; bundles + Capacitor wasm wiring | **4–6d** |
| **B2** | **Test coverage expansion.** Today: 25 tests (phone + ruleof7). Need: `auth` (login flow, refresh rotation, replay), `sessions` (revoke + list), `webhooks/stripe` (signature verify + idempotency), `e2e/cipher` (round-trip + tamper detection), `surveys` (k≥7 anonymity gate), `billing/checkout` (EU 14-day waiver). Plus a couple of integration tests with a real DB. | new tests in `scripts/test-*.mjs`; expand `npm run test:all` | **3–4d** |
| **B3** | **Admin moderation queue UI.** API exists (`/api/admin/suspensions`, reports). UI doesn't. Reviewer SLA (S-237) needs a screen with filter + bulk-action. | new `src/app/admin/moderation/page.tsx` + reviewer hooks | **1.5d** |
| **B4** | **Daily-digest content polish.** `lib/mailer.ts` template exists; the React-email JSX needs a once-over for visual polish + utm-tagged links + unsubscribe flow. | `src/lib/mailer.ts` + new templates | **1d** |
| **B5** | **Stripe webhook hardening.** Verify HMAC, idempotency key, replay window check. Already present in `/api/webhooks/stripe`; needs test coverage in B2. | mostly covered by B2 |
| **B6** | **Sentry release tagging on deploy.** Vercel exposes `VERCEL_GIT_COMMIT_SHA`; wire to `Sentry.init({ release })` so errors group per release. | `instrumentation.ts` / `sentry.*.config.ts` | **0.5d** |
| **B7** | **Backup + DR drill** — execute first one. Doc is in `docs/ops/dr.md`; just needs the first execution + log entry. | docs/ops/dr.md drill log | (operational, not coding) |

**Tier B total: ~10–13 days of one engineer.**

### Tier C — Phase 2 features (Year 2)

Phase 2 = Yogi top-level surface + AI search + surveys + ad marketplace + paid tiers. Most schemas + libs already exist; the work is **UI surface + a few integrations**.

| ID | What to build | Effort | Sprint |
|---|---|---|---|
| **C1** | **Yogi top-level inbox surface** — a dedicated tab where Yogi is the contact. Reuses `/api/agents/yogi`. Adds a Privacy modal first-run (per S-203). | 2d | S-201 |
| **C2** | **Smart-replies chip** wired into `ChatScreen.tsx` composer. Endpoint exists (`/api/agents/yogi/smart-replies`). | 1d | S-207 |
| **C3** | **Yogi quality dashboard UI** for the `/api/admin/yogi-quality` data (cost/DAU chart, refusal rate, accept rate). | 1d | S-208 |
| **C4** | **AI search & discovery surface** — `SearchScreen.tsx` polish + match-score badges + "92% match" UI. Endpoint exists. | 1.5d | S-211 / S-213 |
| **C5** | **Surveys UI** — creator (`/business/surveys/create`), delivery (in-inbox card), respondent flow, results dashboard with k≥7 gating. Backend complete. | 3–4d | S-221 / S-222 / S-223 |
| **C6** | **Ad marketplace creator polish** — `/business/ads` exists but needs (a) preview rendering the actual user inbox view, (b) banned-word lint, (c) targeting picker improvement. | 2d | S-232 |
| **C7** | **Pro / Business tier upgrade flow** — `/pricing` → checkout → `/billing/success` → tier flip. Checkout endpoint exists (S-243); UI flow + portal link needs wiring. | 2d | S-243 |
| **C8** | **EU 14-day cancellation flow** — refund UI + record-keep. Backend metadata flag is set on Stripe; refund endpoint + admin view needs building. | 1.5d | S-244 |
| **C9** | **Referral promo activation** — `lib/referrals/rule-of-7.ts` exists; UI flow ("Refer 7 friends, get 7 days Pro") + share-link generator + in-app banner. | 1d | S-246 |
| **C10** | **i18n wire** — `lib/i18n/index.ts` exists with EN/SI/ES/DE/FR strings; need to thread `t('hero.h1')` through `Hero.tsx`, `Navbar.tsx`, `Footer.tsx` and add locale routing (`/si/`). | 2d | S-254 |

**Tier C total: ~17–18 days. Phase 2 LIVE target (per FEEDBACK_3 plan): 2026-08-31.**

### Tier D — Phase 3 features (Years 3–5; regulator-gated)

These cannot ship until the BaaS partner term sheet (S-302) is signed. But the code can be **written against the partner sandbox** in parallel once that lands.

| ID | What to build | Blocked by | Effort |
|---|---|---|---|
| **D1** | Wallet onboarding UI + KYC handoff | S-302 + S-303 sandbox keys | 3d |
| **D2** | Wallet home (balance + last-7 tx) | D1 | 1.5d |
| **D3** | Top-up via Apple/Google Pay / SEPA | D1 | 2.5d |
| **D4** | SEPA withdrawal | D1 | 1.5d |
| **D5** | Virtual MasterCard issuance + display | partner card API | 3d |
| **D6** | Card freeze + limits + region whitelist | partner card API | 2d |
| **D7** | 3DS / SCA push challenges | partner webhook contract | 2.5d |
| **D8** | Card dispute flow | partner ticketing API | 2d |
| **D9** | P2P transfer to a contact (inline in thread) | partner ledger | 2d |
| **D10** | Request money + 7-day expiry | D9 | 1.5d |
| **D11** | Split bill (≤7 people) | D9 | 1.5d |
| **D12** | Merchant pay (QR + payment link) | partner merchant API | 2.5d |
| **D13** | Cashback / promo credits | partner promo system | 2d |
| **D14** | Customer-support tooling — read-only wallet view (no PAN) | D5 | 2d |
| **D15** | Fraud monitor UI (alerts feed + holds) | lib already exists; needs surface | 1.5d |

**Tier D total: ~33 days, but heavily parallelizable once partner is signed.**

---

## Part 3 — Recommended ordering (the actual work plan)

| Sprint | Focus | Output |
|---|---|---|
| **Week 1** (2026-05-13 → 2026-05-16) | **A1 + A2 + A4** | Avatar uploads work; EXIF stripped; build-time strict |
| **Week 2** (2026-05-18 → 2026-05-22) | **A3 + A5 + B6** | Translation live; SSE realtime; Sentry release-tagged |
| **Week 3** (2026-05-25 → 2026-05-29) | **B2 + B3** | Test coverage doubled; admin moderation UI live |
| **Week 4** (2026-06-01 → 2026-06-05) | **B1 + B4** | libsignal swap; daily digest polish |
| **Week 5** (2026-06-08 → 2026-06-12) | Beta soak + G3 launch | Phase 1 LIVE on copyme1.com |
| **Weeks 6–11** (June → mid-July) | **Tier C** | Phase 2 surfaces — Yogi top-level, surveys, ad polish, paid tiers, referrals, i18n |
| **Week 12+** | Phase 2 LAUNCH | Pro/Business public |
| **Q3 2026** | BaaS partner signed (S-302) → Tier D begins | Phase 3 closed beta |

**Bottom line:** with **one focused engineer**, the absolute MVP-complete state (Tiers A + B) is **~3–4 weeks of work**. Phase 2 surfaces add another **~3–4 weeks**. Phase 3 starts only after the partner term sheet is signed.

---

## Part 4 — What this list explicitly defers

Important enough to call out so we don't sneak it in:

* **Group chat polish beyond ≤7 members** — schema supports it, but UI/UX for groups isn't a Phase 1 priority.
* **Channels / broadcast features** — explicit non-goal (would dilute Rule of 7).
* **Stories / ephemeral content** — not in the spec.
* **Marketplace listings beyond the ad inbox** — Phase 2 ads is enough; broader marketplace is Phase 3 follow-up.
* **Voice/video conferencing for groups** — calls (S-136) are 1:1 only; group calls = Phase 3+.
* **Native mobile (vs PWA + Capacitor)** — explicit choice, not a gap.
* **OS-level keychain for E2E keys** — current build uses IndexedDB; OS keychain via Capacitor is Phase 1.5 hardening, not a launch blocker.
* **Server-side rendering for the authenticated app shell** — `/app/*` is client-rendered, deliberately, to keep latency low and simplify session handling.

---

## Part 5 — How this maps to the gates in `07-production-readiness.md`

| Gate | Date | What needs to be coded by then |
|---|---|---|
| **G1** — Phase 1 core complete (internal alpha) | 2026-05-22 | **A1 + A2 + A3 + A4 + A5** |
| **G2** — Customer-ready (70-user beta opens) | 2026-06-02 | + **B1 + B2 + B3 + B4 + B6** |
| **G3** — Public launch | 2026-06-09 | beta soak passes + 7-day status green |
| **Phase 2 LIVE** | 2026-08-31 | **Tier C** (all of C1–C10) |
| **Phase 3 closed beta** | Q2 2027 | partner-gated, then **Tier D** (D1–D15) |

---

## Closing line

> The original `Production model instructions.docx` listed 18 sub-items
> across 5 categories that stood between "demo" and "production." **16 of
> them are closed.** The remaining 2 (real-time delivery + media upload
> pipeline) are Tier A1 + A5 above. Add Tier B (libsignal proper + tests +
> moderation UI + Sentry tagging + DR drill) and Phase 1 is genuinely
> production-grade. Everything beyond that is feature work, not
> readiness work.
