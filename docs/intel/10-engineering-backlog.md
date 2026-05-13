# 10 — Engineering Backlog: What's Left to Code for Full Functionality

**Anchor doc:** `Production model instructions.docx` (2026-04-04).
**Last updated:** 2026-05-13, after v4.13.0 opened public signup (G3 launch). Tiers A + B + C all done. Beta-prep workstream all done. Public signup live on copyme1.com.

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
| ~~**A3**~~ | ✅ **DONE in v4.5.0** — Translation pipeline live. `lib/translation.ts` (Claude Haiku, Redis cache 24h TTL, $0.10/user/day budget, heuristic source detection, <4-word skip). `User.preferredLocale` column. `TranslationCostLog` model. `/api/messages/send` translates when sender ↔ receiver locales differ. ChatScreen toggle chip wired (Globe icon, "translate · sl → en"). `/api/users/me` PATCH accepts `preferredLocale` (BCP-47 validated). | shipped | done | S-135 follow-up |
| ~~**A4**~~ | ✅ **DONE in v4.4.2** — TS + ESLint now strict in `next.config.ts`. 18 pre-existing TS errors fixed (DemoModal/push/use-web-push/yogi/next.config). Lint went from 202 → 0 errors (after ignoring `.next/**` + `next-env.d.ts` + `*.cjs`). CI workflow hard-gates lint + typecheck. Build green with strict mode. | shipped | done | pre-G3 hardening |
| ~~**A5**~~ | ✅ **DONE in v4.6.0** — SSE realtime delivery on Vercel Node runtime + Upstash Redis pub/sub fan-out. `/api/messages/stream` (60s lifetime, 15s heartbeat, replay on reconnect via `since=<ms>`), `lib/realtime.ts` (publish + subscribe), `lib/sse-parser.ts` (8 unit tests pass), `useMessageStream` client hook with fetch+ReadableStream + exponential backoff + Last-Event-ID. Polling kept as 3s safety net; ChatScreen dedupes by message id. Per-user concurrent stream cap = 7. Feature flag `COPYME_FLAG_REALTIME=1` (live in prod). Vercel `maxDuration: 60` for the route. Upstash store `upstash-kv-beige-elephant` linked → `REDIS_URL` injected. | shipped | done | follow-up to S-194 |

**Tier A total: ~7 days of one engineer to close the last MVP gaps.**

### Tier B — Quality + hardening (before public launch)

| ID | What to build | Files | Effort |
|---|---|---|---|
| ~~**B1**~~ | ✅ **DONE in v4.7.0** — libsignal-client integrated. New `src/lib/e2e/libsignal.ts` (X3DH + Double Ratchet + PQXDH) + `src/lib/e2e/store.ts` (IndexedDB-backed protocol stores) + `scripts/test-e2e.mjs` (9 tests). WebCrypto stand-in kept as fallback. **Caveat:** lib ships as native Node addon at v0.94, not wasm — callers must opt into Node runtime via `export const runtime = "nodejs"`. `serverExternalPackages` set in next.config.ts. | shipped | done |
| ~~**B2**~~ | ✅ **DONE in v4.7.0** — 7 new test files / 89 new tests. Final: 11 suites, 131 tests, 0 failures. Coverage now spans auth (JWT + bcrypt + JWT_SECRET prod guard), age-gate, translation heuristics, MIME sniff, EXIF strip, ad auction, A/B test. | shipped | done |
| ~~**B3**~~ | ✅ **DONE in v4.7.0** — `/admin/moderation` reviewer console live. Reads `GET /api/admin/reports` + `GET /api/admin/suspensions`, posts dismiss/suspend/lift actions. 30s auto-refresh. Two new endpoints: `GET /api/admin/reports` (admin-gated listing with hydrated names) + `PATCH /api/admin/reports/[id]` (mark resolved). | shipped | done |
| ~~**B4**~~ | ✅ **DONE in v4.7.0** — Daily-digest template polished: gradient header, brand wordmark SVG, mobile-responsive table layout, up to 7 conversations (Rule of 7), streak chip, single CTA with UTM tags, plain-text fallback. New `/api/notifications/unsubscribe` (HMAC-SHA256 token, 30d TTL, Redis opt-out flag — no migration needed). Cron honors the flag. | shipped | done |
| **B5** | **Stripe webhook hardening.** Verify HMAC, idempotency key, replay window check. Already present in `/api/webhooks/stripe`; coverage gap remaining (B2 didn't cover it because it requires HMAC-mocking gear). | mostly covered by B2 |
| ~~**B6**~~ | ✅ **DONE in v4.7.0** — Sentry release tag wired in all 3 inits (server / edge / client via `instrumentation-client.ts`). Client-side reach via `next.config.ts env:` forwarding `VERCEL_GIT_COMMIT_SHA → NEXT_PUBLIC_GIT_SHA` + `VERCEL_ENV → NEXT_PUBLIC_VERCEL_ENV` + `VERCEL_DEPLOYMENT_ID → NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID`. Synthetic-error route at `/api/_debug/throw` (gated by `COPYME_DEBUG_THROW=1` in prod) returns release/env/eventId for one-curl verification. | shipped | done |
| **B7** | **Backup + DR drill** — execute first one. Doc is in `docs/ops/dr.md`; just needs the first execution + log entry. **Still open as of G3 launch — operational, ~1hr.** | docs/ops/dr.md drill log | (operational, not coding) |

**Tier B total: ~10–13 days of one engineer.**

### Tier C — Phase 2 features (Year 2)

Phase 2 = Yogi top-level surface + AI search + surveys + ad marketplace + paid tiers. Most schemas + libs already exist; the work is **UI surface + a few integrations**.

| ID | What to build | Effort | Sprint |
|---|---|---|---|
| ~~**C1**~~ | ✅ **DONE in v4.8.0** — `YogiInboxScreen.tsx` is now the dedicated 3rd-tab surface (renamed "Yogi" in `BottomNav.tsx`). First-run consent modal gated by `localStorage["copyme.yogi.consented"]`. Cost-cap banner reads from `/api/agents/yogi`. Composer with `WordCounter` enforces Rule of 7. | shipped | done — S-201 |
| ~~**C2**~~ | ✅ **DONE in v4.8.0** — `SmartReplyChips.tsx` mounted above the composer in `ChatScreen.tsx`. Fetches `/api/agents/yogi/smart-replies` keyed off the latest inbound message ref; skips when last msg <4 words or sent-by-user. Renders 3 chips with skeletons; accept emits `yogi.smart_reply.accepted` Sentry breadcrumb. | shipped | done — S-207 |
| ~~**C3**~~ | ✅ **DONE in v4.8.0** — `/admin/yogi-quality` page live with 4 summary tiles (calls, cost, avg DAU, avg cost/DAU), pure-SVG gradient-stroke cost trend chart, day-by-day collapsible table, 30s auto-refresh. Reads `/api/admin/yogi-quality`. | shipped | done — S-208 |
| ~~**C4**~~ | ✅ **DONE in v4.8.0** — `SearchScreen.tsx` ships inline `MatchBadge` + `SearchResultCard`. Score formula `Math.min(100, Math.round((relevanceScore / 18) * 100))` → "92% match" copy. Adds "Why this match?" affordance + "Send first message →" CTA. | shipped | done — S-211 / S-213 |
| ~~**C5**~~ | ✅ **DONE in v4.8.0** — Three new surfaces: `/business/surveys` (list), `/business/surveys/create` (builder, ≤7 questions), `/business/surveys/[id]/results` (k≥7 anonymity gate, CSS-only horizontal bars). Recipient surface: `SurveyInboxCard.tsx` (radio/checkbox/textarea by type) rendered above conversations in `InboxScreen.tsx` via `/api/surveys/pending`. | shipped | done — S-221 / S-222 / S-223 |
| ~~**C6**~~ | ✅ **DONE in v4.8.0** — `/business/ads` now ships live preview pane using shared `AdInboxCard.tsx` (matches consumer marketplace look), 5 banned-word lint patterns (guarantee / free money / click here / excessive `!!!` / restricted categories), chip-based `InterestPicker` with 24-item `COMMON_INTERESTS` suggestions, max 7 tags. | shipped | done — S-232 |
| ~~**C7**~~ | ✅ **DONE in v4.8.0** — `/pricing` is now a client component with functional Upgrade CTAs hitting `/api/billing/checkout`. Stripe webhook now handles `mode === "subscription"` idempotently via `TIER_RANK` (pro → business_3, business → business_7). New `/billing/success` (with `/api/billing/verify-session`), `/profile/billing` (Manage / Downgrade), `/api/billing/cancel`. | shipped | done — S-243 |
| ~~**C8**~~ | ✅ **DONE in v4.8.0** + ✅ **CAVEAT CLOSED in v4.9.0** — Refund flow now end-to-end functional. Migration `20260512230000_c8_user_stripe_ids` adds `users.stripe_customer_id` (UNIQUE) + `users.stripe_subscription_id` (indexed). Stripe webhook persists both ids on `checkout.session.completed`; new `customer.subscription.deleted` handler flips tier back to `basic` and clears subscription id. `/api/billing/refund` now reads the stored customer id and runs the full Stripe-API refund flow; `/api/billing/cancel` resolves the subscription id from the User row when not passed in. The v4.8.x 503 `REFUND_LOOKUP_UNAVAILABLE` is gone — endpoint returns 404 `NO_SUBSCRIPTION` only when the user genuinely has no Stripe history. | shipped | done — S-244 |
| ~~**C9**~~ | ✅ **DONE in v4.8.0** — `/api/users/me/referral/share` (returns code, deepLink, shareText, qualifyingReferrals, needed=7, freeDaysGranted, earnedAt). `ReferralBanner.tsx` (7-dot progress + share with native + copy fallback) rendered in `ProfileScreen.tsx` above the stats grid; hides for non-basic tiers. Signup captures `?ref=<code>` → forwards to `/api/auth/phone/complete`. New `getReferralProgress()` sibling in `lib/referrals/rule-of-7.ts`. | shipped | done — S-246 |
| ~~**C10**~~ | ✅ **DONE in v4.8.0** — Locale routing via `src/app/[locale]/(layout|page).tsx` with `generateStaticParams` + per-locale `generateMetadata`. New `lib/i18n/server.ts` (`tFor` + `isSupportedLocale`). `Hero.tsx`, `Navbar.tsx`, `Footer.tsx` accept optional `t?: (key) => string` (falls back to English when omitted, so `/` is byte-identical). `Footer.tsx` adds language-switcher row with native names. | shipped | done — S-254 |

**Tier C total: shipped in v4.8.0 (parallel agents — wall-clock minutes). Phase 2 LIVE target (per FEEDBACK_3 plan): 2026-08-31 — surface work complete; remaining is launch ops + marketing.**

### Beta-prep + G3 launch ships (v4.11.0 → v4.13.0)

Workstream that ran after Tier C closed. Not in the original backlog
because the original assumed beta launch would be its own phase —
these landed as a single session of operational + launch-prep code.

| ID | What shipped | Files |
|---|---|---|
| ~~**P1**~~ | ✅ **DONE in v4.11.0** — Public status page + JSON twin. `src/lib/health.ts` runs parallel DB/Redis/Blob probes (each timeboxed 3s, classified ok/degraded/down). `/status` is a server-rendered HTML page with 30s meta-refresh and zero client JS; `/api/status` returns the same snapshot as JSON. HTTP code mirrors the worst service (503 on down). Public — no auth. | `src/lib/health.ts`, `src/app/api/status/route.ts`, `src/app/status/page.tsx`, `src/middleware.ts` |
| ~~**P2**~~ | ✅ **DONE in v4.11.1** — Welcome email now fires at first email verification (not at signup). Phone-first signups now get one too. Migration adds `email_verification_tokens.email` so the verify endpoint can address the welcome send. Single trigger point regardless of signup flow. | `prisma/migrations/20260513050000_email_verify_token_email`, `src/lib/email-verification.ts`, `src/app/api/auth/email/verify/route.ts` |
| ~~**P3**~~ | ✅ **DONE in v4.12.0** — Beta invite-code gate. New `InviteCode` + `InviteCodeRedemption` models. `betaInviteRequired()` env-flag check, `validateInviteCode()` / `redeemInviteCode()` (transactional, race-safe) / `mintInviteCode()`. Three endpoints: public preflight `/api/auth/invite/check`, admin `/api/admin/invites` (mint + list). Validation wired into both `/api/auth/phone/complete` and `/api/auth/register`. UI gate in `/signup` (new "invite" step before phone when flag is on). | `prisma/migrations/20260513052000_invite_codes`, `src/lib/invite-code.ts`, `src/app/api/auth/invite/check/route.ts`, `src/app/api/admin/invites/route.ts`, `src/app/signup/page.tsx`, two signup endpoints |
| ~~**P4**~~ | ✅ **DONE in v4.12.1–v4.12.4** — G2 cohort opened operationally: 70 single-use codes minted via `scripts/seed-invite-codes.mjs`, env-var `"1\n"` bug fixed in `betaInviteRequired()` (`.trim()` guard), `scripts/delete-users.mjs` shipped for ops cleanup, hand-off playbook for co-founder at `docs/ops/g2-cohort-handoff.md`. | `scripts/seed-invite-codes.mjs`, `scripts/delete-users.mjs`, `docs/ops/g2-cohort-handoff.md` |
| ~~**P5**~~ | ✅ **DONE in v4.13.0** — Opened public signup at G3. Removed both gate env vars on Vercel. Beta gate stays dormant: schema, library, endpoints, and UI all in place — re-flipping the flags re-engages the gate without a migration. | (no diff beyond an empty commit to trigger redeploy) |

### i18n breadth (v4.10.0 → v4.10.8)

Ran as a parallel workstream after Tier C. The bare `t()` in
`src/lib/i18n/index.ts` only covered landing components after C10 —
v4.10.x extended coverage through the entire authenticated shell.

| Pass | What shipped |
|---|---|
| v4.10.0 | `LocaleProvider` + `useLocale` hook; BottomNav + chat composer placeholder. |
| v4.10.1 | InboxScreen, ProfileScreen, SearchScreen, WordCounter. |
| v4.10.2 | SearchScreen leftovers (header/AI Mode/filter chips/section) + HomeNudges streak/push/invite. |
| v4.10.3 | ContactProfileSheet + global Connect button. |
| v4.10.4 | Send Message CTA + plural copy fixes (singular/plural via JS branching). |
| v4.10.5 | AdMarketplace overlay + ad detail sheet. |
| v4.10.6 | OnboardingScreen + shared `cta.*` button namespace. |
| v4.10.7 | AuthScreen (sign-in / register / forgot password) — first surface non-EN users see. |
| v4.10.8 | OnboardingAI helper + HomeNudges blocked state + PrivacyControls (orphan but ready) + ProfileScreen extras. **Slovenian-complete end-to-end.** |

**Cumulative i18n:** 154 keys × 5 locales = **770 string entries** across
13 components. The whole authenticated journey (Auth → Onboarding →
Inbox → Chat → Search → Profile → AdMarketplace → Contact sheets) is
localized for SI/ES/DE/FR. Out of scope: server-side validation error
messages (would need a translatable error-key system).

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
| ~~Weeks 6–11~~ | ~~Tier C~~ | ✅ Shipped in v4.8.0 (parallel-agent run; wall-clock minutes vs. 17–18 estimated days). Phase 2 surfaces all live. |
| **Week 12+** | Phase 2 LAUNCH ops | Pro/Business public — marketing + onboarding + plan-tier docs (no remaining code) |
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

| Gate | Original date | Status |
|---|---|---|
| ~~**G1**~~ — Phase 1 core complete (internal alpha) | 2026-05-22 | ✅ Reached early — Tier A all done by v4.6.0 |
| ~~**G2**~~ — Customer-ready (70-user beta) | 2026-06-02 | ✅ Reached early — beta gate built (v4.12.0), 70 codes minted, then **opted-out and went straight to G3** |
| ~~**G3**~~ — Public launch | 2026-06-09 | ✅ **LIVE on 2026-05-13** at v4.13.0 — gate off, anyone can sign up at copyme1.com/signup |
| **Phase 2 LIVE** | 2026-08-31 | ✅ Code-complete in v4.8.0 — only launch ops + marketing remain |
| **Phase 3 closed beta** | Q2 2027 | Partner-gated (S-302). When BaaS term sheet signs → start **Tier D** (D1–D15) |

---

## Closing line

> The original `Production model instructions.docx` listed 18 sub-items
> across 5 categories that stood between "demo" and "production." **All
> 18 are closed.** Tier A (MVP completers), Tier B (quality + hardening),
> Tier C (Phase 2 surfaces), v4.10.x (i18n breadth), and v4.11–v4.13.0
> (beta-prep + G3 launch) all shipped. The site is public on
> copyme1.com; anyone can sign up.
>
> What's left:
> * **B7 disaster-recovery drill** — operational, ~1hr, not coding.
> * **Tier D (wallet/cards/payments)** — partner-gated on S-302
>   (BaaS term sheet). Cannot start until that signs.
>
> Everything else is feature work, launch ops, or marketing —
> not engineering readiness.
