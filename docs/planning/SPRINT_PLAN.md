# CopyMe (CpM) — Master Sprint Plan

**Repo:** `github.com/interactiveintel/copyme-app` · **Live:** `copyme1.com` · **Tag baseline:** `v4.1.3`
**Owners:** Paul Pereira (InteractiveIntel, USA) · Jože Kralj (Pimdom d.o.o., Slovenia)
**Plan author:** Claude · **Plan date:** 2026-05-09 · **Plan format:** 1-hour micro-sprints for Claude Code execution

---

## How to use this plan

Each sprint is a self-contained **1-hour unit of work** sized for Claude Code to pick up, execute, and ship in a single session. Sprints are grouped by **Phase** (per the existing 3-phase roadmap) and by **Workstream** (Engineering, Product, Trust/Compliance, Business/Investor). Sprints are sequenced so that any sprint with no open `Depends on:` items is ready to claim.

**Sprint anatomy:**

```
S-XXX · <Title>                                Phase · Workstream · ~60 min
Goal:        single-sentence outcome
AC:          acceptance criteria — checkable bullets
Touches:     files / routes / surfaces likely affected
Depends on:  S-IDs that must be merged first (or "none")
```

**Definition of Done (applies to every sprint):**

1. Code compiles, type-checks, and lints clean.
2. Acceptance criteria verified locally (and on Vercel preview where the change is user-visible).
3. New behavior covered by at least one automated test.
4. PR title `S-XXX: <Title>` opened against `main` with a 3-line summary.
5. Sprint marked `done` in the companion `copyme_sprint_tracker.xlsx`.

---

## Executive summary

CopyMe is on track to leave concept stage and enter **production-ready beta**. Sprint 0 closes Jože's second-feedback loop (hero copy, logo, +386 country code, T&C edits) in **8 sprints**. Phase 1 (Year 1, free communication core) is the longest engineering arm and is decomposed into **72 sprints** across Auth, Rule-of-7 enforcement, Inbox/Composer, Voice/Video, Encryption, Public pages, Mobile packaging, Trust/Safety, Observability, and Launch gating. Phase 2 (Year 2, Yogi AI + B2B ad marketplace + paid tiers) is decomposed into **37 sprints**. Phase 3 (Years 3-5, Value Account Pay + virtual MasterCard) is decomposed into **26 sprints**, sequenced behind regulatory milestones. A parallel Business/Investor track of **12 sprints** prepares the entity, the €1M angel raise (Boscarol candidate), and the data-room hardening required for diligence.

**Total backlog: 161 sprints** (10 in Sprint 0 after Feedback 3 deltas; 72 Phase 1; 37 Phase 2; 26 Phase 3; 16 Business). At a sustained cadence of 6 sprints/day this is roughly **27 working days of build to reach Phase 1 launch readiness** (Sprint 0 + Phase 1 = 82 sprints ≈ 14 days). Concrete dated gates G0..G3 are in `FEEDBACK_3_CORRECTION_PLAN.md` §3 — **G0 (Joze closure) by 2026-05-12, G2 (customer-ready) by 2026-06-02, G3 (public launch) by 2026-06-09**.

---

## Synthesis of Jože's 2nd feedback (2026-05-07)

| # | Edit Jože proposed | Where it lives now | Sprint that closes it |
|---|---|---|---|
| 1 | Strike "Communication that Matters / Copies"; replace with "Your World's chart of Communication" | `app/page.tsx` hero | **S-001** |
| 2 | Strike "Built on the …", "Seven … Seventy words." Keep: "Rule of 7 — A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact." | `app/page.tsx` hero subhead | **S-002** |
| 3 | Move Rule-of-7 specifics (70 words, 7 contacts, last-7 retention) **out of the landing page** and **into Terms** | `app/page.tsx` + `app/terms/page.tsx` | **S-003** |
| 4 | T&C "At a glance": rephrase suspension wording from "We can suspend …" to "accounts that break these rules could be suspended" (fix the `suspened` typo too) | `app/terms/page.tsx` | **S-004** |
| 5 | Logo refinement — keep the mark, drop the "Rule of 7" script underneath; explore a small globe-with-figure variant per the original paper | `app/icon.svg`, `public/og-*` | **S-005**, **S-006** |
| 6 | Add country code **+386 (Slovenia)** to the phone-verification flow | auth/onboarding | **S-007** |
| 7 | Validate the polished landing on phones for both Paul and Jože | end-to-end live test | **S-008** |

**Tone Jože is asking us to land on:** the first-time visitor must feel the **promise of CopyMe** in one breath; mechanical detail belongs in Terms.

---

## Workstream legend

- **ENG** — Engineering (frontend, backend, mobile, infra)
- **PROD** — Product / UX / copy / design
- **TRUST** — Trust, safety, privacy, compliance, T&C
- **BIZ** — Business, legal entity, investor, fundraise

---

# Sprint 0 — Close Jože's Feedback Loop

> Goal of Sprint 0: ship every red-text edit Jože sent, plus the +386 country code and a phone-device test, before any Phase 1 work begins.

### S-001 · Hero — remove "Copies", keep "Communication That Matters" (corrected per Feedback 3)
Phase 0 · PROD · ~60 min
**Goal:** Remove only the word `Copies` from the hero headline. Keep "Communication That Matters" as H1. (S-010 then adds "Your World's chart of Communication" as H2.)
**AC:**
- H1 reads exactly: `Communication That Matters`
- The string `Copies` no longer appears anywhere in the hero.
- OG image regenerates.
**Touches:** `app/page.tsx`, OG image route.
**Depends on:** none.
**Note:** Feedback 3 (2026-05-10) clarified that "Communication That Matters" was never meant to be removed — only `Copies` was struck. See `FEEDBACK_3_CORRECTION_PLAN.md`.

### S-002 · Hero subhead "Rule of 7" rewrite
Phase 0 · PROD · ~60 min
**Goal:** Subhead reads exactly: *"Rule of 7 — A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact."*
**AC:**
- Subhead string updated; previous variants (`Built on the`, `Seven`, `Seventy words.`) removed from source.
- Visual hierarchy preserved (Rule of 7 still emphasized).
**Touches:** `app/page.tsx`.
**Depends on:** S-001.

### S-003 · Move Rule-of-7 mechanics off landing → into Terms
Phase 0 · TRUST · ~60 min
**Goal:** Strip mechanical limits (70 words, 7 contacts, last-7 retention) from the landing page; ensure the same enumerated list lives in Terms §3.
**AC:**
- Landing page has no numeric Rule-of-7 enumeration.
- `/terms` §3 contains: 70-word cap, 7-item media group, 70-second voice/video, 7 active contacts (free), last-7 messages retained per contact.
- Internal anchor `#rule-of-7` on Terms page works from a "Read the Rule of 7 in Terms →" CTA on landing.
**Touches:** `app/page.tsx`, `app/terms/page.tsx`.
**Depends on:** S-002.

### S-004 · Fix Terms suspension wording + typo
Phase 0 · TRUST · ~60 min
**Goal:** Replace "We can suspend accounts that break these rules" with "Accounts that break these rules may be suspended" in the "At a glance" block. Fix the `suspened` typo.
**AC:**
- "At a glance" reads: `Accounts that break these rules may be suspended.`
- No occurrence of `suspened` anywhere in the repo.
**Touches:** `app/terms/page.tsx`.
**Depends on:** none.

### S-005 · Logo: drop "Rule of 7" subscript
Phase 0 · PROD · ~60 min
**Goal:** Produce a clean SVG mark without the "Rule of 7" descriptor underneath.
**AC:**
- `app/icon.svg` and any header logo component render the mark only.
- Favicons + Apple touch icons regenerated.
- Old "Rule of 7" lockup stays in `/press` press-kit downloads as the legacy mark.
**Touches:** `app/icon.svg`, `app/apple-icon.tsx`, `components/Logo.tsx`.
**Depends on:** none.

### S-006 · Logo variant: globe-with-figure exploration
Phase 0 · PROD · ~60 min
**Goal:** Produce a 2-option SVG exploration adding a small globe with a human figure in front (per Jože's original paper sketch).
**AC:**
- 2 SVG variants saved under `design/logo-explorations/`.
- 1200×630 OG previews rendered for each.
- Internal Notion/Linear ticket opened so Paul + Jože can pick the winner.
**Touches:** `design/logo-explorations/`, OG route.
**Depends on:** S-005.

### S-007 · Add country code +386 (Slovenia) to phone auth
Phase 0 · ENG · ~60 min
**Goal:** Slovenia (+386) selectable in the country dropdown, with proper E.164 formatting and a valid local-number regex.
**AC:**
- `+386` shows in the dropdown with the SI flag.
- Number `+386 31 234 567` validates and a verification SMS is sent in dev mode.
- Snapshot test added for the country picker.
**Touches:** `lib/phone/countries.ts`, `components/PhoneInput.tsx`, `lib/phone/validate.ts`, tests.
**Depends on:** none.

### S-008 · Cross-device live test (US ↔ SI)
Phase 0 · PROD · ~60 min
**Goal:** Install the PWA on Paul's phone (US, +1) and Jože's phone (SI, +386); send messages both ways; capture screenshots.
**AC:**
- Both numbers verify successfully.
- A 70-word boundary message and a 7-item media group succeed.
- A 71-word message is blocked client-side and server-side.
- Screenshots committed to `docs/qa/2026-05-launch-readiness/`.
**Touches:** docs only.
**Depends on:** S-007, S-001..S-005 deployed.

### S-009 · Contact email migration to `info@copyme1.com`
Phase 0 · TRUST · ~60 min · **NEW per Feedback 3**
**Goal:** Replace `interactiveintel@gmail.com` with `info@copyme1.com` everywhere it appears.
**AC:**
- `grep -ri "interactiveintel@gmail.com"` returns 0 hits in source (excluding `CHANGELOG.md` and git history).
- Updated in Terms §13, Privacy, Press, README, contact pages.
- DNS for `copyme1.com` resolves; MX + SPF + DKIM + DMARC published.
- A test email to `info@copyme1.com` is received and auto-replied.
- Old gmail kept as a passive alias for 90 days.
**Touches:** `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/press/page.tsx`, `README.md`, DNS provider.
**Depends on:** none. **Pre-req:** confirm `copyme1.com` is registered (or register it).

### S-010 · Hero — add "Your World's chart of Communication" as H2
Phase 0 · PROD · ~60 min · **NEW per Feedback 3**
**Goal:** Below the H1 "Communication That Matters", insert a second-tier headline `Your World's chart of Communication`. The Rule-of-7 paragraph (S-002) sits below both.
**AC:**
- DOM order on `/`: H1 ("Communication That Matters") → H2 ("Your World's chart of Communication") → subhead paragraph.
- OG image regenerated with both headlines.
- Lighthouse a11y ≥95 unchanged.
**Touches:** `app/page.tsx`, OG image route.
**Depends on:** S-001.

---

# Phase 1 — Communication Core (Year 1, free tier, 10–100M user target)

> Goal of Phase 1: ship a production-grade communication app that **enforces the Rule of 7 at every layer**, is mobile-installable, end-to-end encrypted, and observable. Free tier only.

## 1.1 Auth & Onboarding (S-101 … S-110)

### S-101 · Phone-first sign-up flow
ENG · ~60 min
**Goal:** Single-screen sign-up: country code + number → SMS OTP → display name. No email step.
**AC:** Happy path works on Vercel preview; OTP retry has 30s cooldown; bot rate-limit by IP.
**Depends on:** S-007.

### S-102 · Country picker: full ITU list
ENG · ~60 min
**Goal:** All ITU country codes, sorted by user locale, with search.
**AC:** 240+ entries; SI (+386) and US (+1) appear at top for Paul/Jože context; keyboard-navigable.
**Depends on:** S-007.

### S-103 · OTP backend (provider-agnostic)
ENG · ~60 min
**Goal:** Wrap Twilio + a fallback (e.g. MessageBird) behind a single `sendOtp(phone)` interface.
**AC:** Provider chosen via env; failure on primary auto-flips to fallback; metrics emitted.
**Depends on:** S-101.

### S-104 · Onboarding "first 7 contacts" import
PROD · ~60 min
**Goal:** Post-signup screen invites user to add their first 7 contacts (paste numbers, share-link, or skip).
**AC:** Up to 7 contacts saved; "skip" allowed; analytics event emitted.
**Depends on:** S-101.

### S-105 · Display-name + avatar setup
PROD · ~60 min
**Goal:** Required display name (≤24 chars), optional avatar upload, default-avatar generator.
**AC:** Validation + image resize at the edge; saved to profile; visible in inbox immediately.
**Depends on:** S-101.

### S-106 · Session management & device list
ENG · ~60 min
**Goal:** Sessions table, "Active devices" view in Profile, ability to revoke a device.
**AC:** Logout from device A invalidates only A; revoke list rendered in real time.
**Depends on:** S-101.

### S-107 · Refresh-token rotation + replay protection
ENG · ~60 min
**Goal:** Sliding refresh tokens, single-use refresh, replay alerts to user.
**AC:** Replay attempt logs a `auth.replay_attempt` event and emails (in-app banner) the user.
**Depends on:** S-106.

### S-108 · Lost-phone recovery flow
TRUST · ~60 min
**Goal:** Recovery via secondary verified number OR signed recovery file; no password recovery.
**AC:** Recovery file generated at signup; recovery cycle round-trip tested.
**Depends on:** S-106.

### S-109 · Hard-delete account ("Profile → Delete account")
TRUST · ~60 min
**Goal:** Self-serve account hard-delete per Terms §8.
**AC:** Confirmed delete schedules 30-day grace, then erases PII; data export ZIP delivered first.
**Depends on:** S-105.

### S-110 · 16+ age gate at signup
TRUST · ~60 min
**Goal:** Birthdate or self-attestation gate, with locale-aware "age of digital consent".
**AC:** Per-country threshold table (DE 16, ES 14, US 13, etc.); blocked users see a friendly screen with appeal link.
**Depends on:** S-101.

## 1.2 Rule-of-7 Enforcement (S-111 … S-118)

### S-111 · Server-side 70-word message cap
ENG · ~60 min
**Goal:** Reject messages whose word count > 70 at the API edge before persistence.
**AC:** 70 passes, 71 blocked with `RULE_OF_7_WORD_CAP` error; word-count algorithm matches client (S-112).
**Depends on:** S-101.

### S-112 · Client live word counter (`64 / 70 words`)
ENG · ~60 min
**Goal:** Live counter under composer; turns amber at 60, red at 70, hard-stops at 70.
**AC:** Matches the existing hero mock; emoji counts as 1 word; URLs count as 1.
**Depends on:** S-111.

### S-113 · 7-item media-group cap
ENG · ~60 min
**Goal:** Attachment picker disables "+" once 7 items selected; server rejects > 7.
**AC:** Clean error UX; metadata records the original count attempted.
**Depends on:** S-101.

### S-114 · 70-second voice / video clip cap
ENG · ~60 min
**Goal:** Recorder hard-stops at 70s; uploaded clips > 70s rejected.
**AC:** Recorder UI shows "70" countdown ring; ffmpeg probe at upload.
**Depends on:** S-101.

### S-115 · 7 active contacts (free tier) enforcement
ENG · ~60 min
**Goal:** Free users can have at most 7 active conversations. 8th archives the least-recent.
**AC:** UX explains the swap; archived threads remain searchable but read-only.
**Depends on:** S-101.

### S-116 · Last-7 messages retention per contact (free tier)
ENG · ~60 min
**Goal:** For free users, only the last 7 messages per contact are retained server-side.
**AC:** Background pruning job runs hourly; per-thread "you're seeing your last 7 — upgrade for more" hint.
**Depends on:** S-115.

### S-117 · Rule-of-7 telemetry dashboard
ENG · ~60 min
**Goal:** Internal dashboard showing how often each cap is hit (word, media, voice, contacts, retention).
**AC:** Grafana panel live; baseline captured; alert if any cap < 0.5% trigger rate (means it's not biting).
**Depends on:** S-111..S-116.

### S-118 · Rule-of-7 enforcement integration tests
ENG · ~60 min
**Goal:** End-to-end test suite covering all five caps with both happy and rejection paths.
**AC:** CI runs in < 3 min; no flakes over 20 consecutive runs.
**Depends on:** S-111..S-116.

## 1.3 Inbox & Composer (S-121 … S-130)

### S-121 · Inbox list — 7-item view
ENG · ~60 min
**Goal:** Inbox renders the 7 active threads with avatar, last-message preview, time, unread dot.
**AC:** Matches mock; virtualized for snappy scroll; pull-to-refresh.
**Depends on:** S-115.

### S-122 · Thread view — bubble layout
ENG · ~60 min
**Goal:** Standard bubble UI; sent right, received left; date separators; read receipts.
**AC:** Smooth on 60Hz mid-tier Android; respects "reduced motion" pref.
**Depends on:** S-121.

### S-123 · Composer — with `n / 70 words` counter
ENG · ~60 min
**Goal:** Composer sticky to viewport; counter from S-112; send button disabled at 0 or > 70.
**AC:** Pasting > 70 words trims to 70 with a one-time toast.
**Depends on:** S-112.

### S-124 · Typing indicator + presence
ENG · ~60 min
**Goal:** "typing…" + Online/Last seen, opt-out per privacy settings.
**AC:** Privacy default: presence ON, last-seen OFF.
**Depends on:** S-122.

### S-125 · Read receipts (opt-out)
ENG · ~60 min
**Goal:** Double-tick / blue-tick equivalent; opt-out is mutual (turn off → don't see others').
**AC:** State synced across devices.
**Depends on:** S-122.

### S-126 · Reactions (limited to 7 emoji)
PROD · ~60 min
**Goal:** Tap-and-hold to react; palette restricted to 7 emoji to honor the constraint principle.
**AC:** 7 emoji are: ❤️ 👍 😂 😮 😢 🔥 💜 (matching mock).
**Depends on:** S-122.

### S-127 · Reply / quote (no forward chains)
PROD · ~60 min
**Goal:** Reply to a specific message inline. No "forward" — disable by design.
**AC:** Quoted message snippet renders; tapping it scrolls to original.
**Depends on:** S-122.

### S-128 · Search across the user's last-7 per thread
ENG · ~60 min
**Goal:** Local-first full-text search over the 7-message window.
**AC:** Sub-100ms on 7 contacts × 7 messages corpus; highlights matches.
**Depends on:** S-116.

### S-129 · Push notifications (FCM + APNs)
ENG · ~60 min
**Goal:** Per-thread mute, global quiet hours, per-device opt-in.
**AC:** New message → push within 5s p95; mute respected.
**Depends on:** S-122.

### S-130 · Offline send queue
ENG · ~60 min
**Goal:** Messages composed offline queue locally and flush on reconnect.
**AC:** Airplane-mode test passes; max queue size 7 messages (Rule of 7 again).
**Depends on:** S-123.

## 1.4 Voice, Video & Media (S-131 … S-136)

### S-131 · Voice clip recorder (≤70s)
ENG · ~60 min
**Goal:** Hold-to-record, release-to-send; waveform; 70s hard cap.
**AC:** Clip uploads chunked; transcript stub stored for accessibility.
**Depends on:** S-114.

### S-132 · Video clip recorder (≤70s)
ENG · ~60 min
**Goal:** Front/back camera, 720p, 70s cap; thumbnail generated.
**AC:** Clip plays inline; CDN-served HLS.
**Depends on:** S-114.

### S-133 · Image attachments (≤7, EXIF stripped)
TRUST · ~60 min
**Goal:** Picker enforces 7-cap; server strips EXIF (incl. GPS) before storage.
**AC:** EXIF assertion test on upload pipeline.
**Depends on:** S-113.

### S-134 · Document attachments (≤7, ≤25MB each)
ENG · ~60 min
**Goal:** PDFs and common docs supported; per-file 25MB cap; in-app preview for PDF.
**AC:** MIME sniffing on server; reject mismatched extensions.
**Depends on:** S-113.

### S-135 · Voice / video transcripts (background, opt-in)
ENG · ~60 min
**Goal:** Background transcription via third-party; off by default; respects Privacy.
**AC:** Transcript saved as a sibling of the clip; toggle in Profile → Privacy.
**Depends on:** S-131, S-132.

### S-136 · Real-time 1:1 voice call (beta flag)
ENG · ~60 min
**Goal:** WebRTC 1:1 call, behind feature flag; 70-min cap (Rule of 7 echoed).
**AC:** Call connects in < 3s p95 in two regions; flag default OFF.
**Depends on:** S-131.

## 1.5 Encryption & Privacy (S-141 … S-146)

### S-141 · E2E protocol selection + key generation
TRUST · ~60 min
**Goal:** Choose Signal Protocol (libsignal); generate identity + prekeys at signup.
**AC:** Decision doc committed; keys stored in secure enclave / Keychain / Keystore.
**Depends on:** S-101.

### S-142 · E2E for text messages
ENG · ~60 min
**Goal:** All 1:1 text messages are E2E encrypted in transit and at rest server-side (server holds ciphertext only).
**AC:** Server cannot decrypt fixture; key rotation every 7 days.
**Depends on:** S-141.

### S-143 · E2E for media (chunked)
ENG · ~60 min
**Goal:** Media encrypted client-side, uploaded as ciphertext, decrypted on recipient device.
**AC:** Cross-device media exchange test passes.
**Depends on:** S-142.

### S-144 · Safety-number verification ("scan to verify")
TRUST · ~60 min
**Goal:** Per-contact safety number with QR; alert when it changes.
**AC:** UX matches Signal's mental model; explainer copy approved by Jože.
**Depends on:** S-142.

### S-145 · Privacy controls (presence, receipts, last-seen, transcripts)
PROD · ~60 min
**Goal:** Single Privacy screen consolidating all opt-outs.
**AC:** Defaults documented; each control linked to the relevant Terms section.
**Depends on:** S-124, S-125, S-135.

### S-146 · Data-export ZIP (GDPR Art. 15)
TRUST · ~60 min
**Goal:** "Download my data" produces a portable ZIP within 7 days.
**AC:** Job pipeline emits ZIP; user notified by push when ready.
**Depends on:** S-109.

## 1.6 Profile, Pricing, Public Pages (S-151 … S-158)

### S-151 · Profile screen (matching mock)
PROD · ~60 min
**Goal:** Profile with avatar, name, phone, plan, settings groups.
**AC:** Visual parity with mock; settings deep-linkable.
**Depends on:** S-105.

### S-152 · Plan card (Free / Pro / Business)
PROD · ~60 min
**Goal:** Plan card on profile shows current tier and CTA to upgrade.
**AC:** Pulls live tier from `/api/me`; CTA → `/pricing`.
**Depends on:** S-151.

### S-153 · Pricing page polish
PROD · ~60 min
**Goal:** Refresh `/pricing` for clarity; Free emphasizes Rule of 7, Pro raises caps, Business adds ads marketplace.
**AC:** Mobile layout passes Lighthouse a11y > 95.
**Depends on:** none.

### S-154 · Press kit page polish
PROD · ~60 min
**Goal:** `/press` boilerplate, founders, logos (legacy + new), media contact.
**AC:** Press kit ZIP downloadable; OG renders on Twitter/LinkedIn previews.
**Depends on:** S-005.

### S-155 · Privacy policy refresh
TRUST · ~60 min
**Goal:** Align `/privacy` with Yogi subprocessor disclosure and EU/UK consumer rights.
**AC:** Reviewed against Terms §7 and §11.
**Depends on:** none.

### S-156 · Terms diff PR (Sprint 0 follow-through)
TRUST · ~60 min
**Goal:** Single PR consolidating S-003 + S-004 + Phase-1 references to Rule of 7.
**AC:** Lawyer-friendly diff; no orphan numerical claims on landing.
**Depends on:** S-003, S-004.

### S-157 · Cookie / tracking banner (EU)
TRUST · ~60 min
**Goal:** EU-only cookie consent for analytics + ad pixels.
**AC:** Geo-detected; consent state persisted; no analytics fires before opt-in.
**Depends on:** S-155.

### S-158 · Investor data-room page polish
BIZ · ~60 min
**Goal:** `/pitch` shows live DAU/WAU/MAU, retention, Yogi cost, ad rev (already public).
**AC:** Page survives a 100-RPS hit; metrics endpoint cached at edge.
**Depends on:** none.

## 1.7 Mobile packaging & install (S-161 … S-166)

### S-161 · PWA install prompt + manifest polish
ENG · ~60 min
**Goal:** Manifest icons, name, theme color; "Install CopyMe" prompt after 2nd visit.
**AC:** Lighthouse PWA score 100.
**Depends on:** S-005.

### S-162 · iOS Safari install handoff
ENG · ~60 min
**Goal:** iOS-specific install instructions overlay (Safari → Share → Add to Home Screen).
**AC:** Detected via UA; one-time dismiss.
**Depends on:** S-161.

### S-163 · Capacitor wrapper for App Store / Play
ENG · ~60 min
**Goal:** Capacitor project that wraps the Next.js PWA for iOS + Android stores.
**AC:** Both shells build locally; push notifications wired.
**Depends on:** S-129, S-161.

### S-164 · App Store metadata + screenshots
PROD · ~60 min
**Goal:** Listing copy, keywords, 6 screenshots per device class.
**AC:** Submitted to App Store Connect (TestFlight track).
**Depends on:** S-163.

### S-165 · Play Store metadata + screenshots
PROD · ~60 min
**Goal:** Same as S-164 for Google Play (Internal track).
**AC:** Listing in Internal Testing.
**Depends on:** S-163.

### S-166 · Deep links (`copyme://thread/<id>`)
ENG · ~60 min
**Goal:** Universal links + Android App Links; share-link to a thread opens the app if installed.
**AC:** Domain-association files served at `/.well-known/`.
**Depends on:** S-163.

## 1.8 Trust, Safety, Moderation (S-171 … S-176)

### S-171 · Report-message flow
TRUST · ~60 min
**Goal:** Long-press → Report; reason picker (spam, harassment, illegal, other).
**AC:** Report stored with ciphertext snippet only when Terms allow; user notified of receipt.
**Depends on:** S-122.

### S-172 · Block contact
TRUST · ~60 min
**Goal:** Block hides messages and prevents new ones; mutual invisibility.
**AC:** Block reversible; no "you've been blocked" leak.
**Depends on:** S-115.

### S-173 · Auto-moderation: NSFW + CSAM hash matching
TRUST · ~60 min
**Goal:** Hash-match against NCMEC for media uploads; perceptual-hash NSFW flag.
**AC:** Match → block + report per legal duty; non-match never logged.
**Depends on:** S-133.

### S-174 · Anti-spam: rate limits + bulk-message detection
TRUST · ~60 min
**Goal:** Per-account send rate, novel-recipient ratio, link-density heuristics.
**AC:** Spam class precision > 0.9 on labeled set.
**Depends on:** S-115.

### S-175 · Account suspension flow
TRUST · ~60 min
**Goal:** Soft-suspend (read-only 7 days), then hard-suspend, with appeal email.
**AC:** Suspended user sees the Terms §4 wording verbatim.
**Depends on:** S-004.

### S-176 · Transparency-report scaffolding
TRUST · ~60 min
**Goal:** Quarterly report template + the data pipeline that fills it.
**AC:** First placeholder report rendered for Q3 2026.
**Depends on:** S-175.

## 1.9 Observability, Infra, Release (S-181 … S-188)

### S-181 · Structured logging baseline
ENG · ~60 min
**Goal:** JSON logs with `requestId`, `userId` (hashed), `route`, `latencyMs`.
**AC:** Logs flow to Vercel + a long-term store.
**Depends on:** none.

### S-182 · Error tracking (Sentry)
ENG · ~60 min
**Goal:** Sentry wired front + back; release-tagged.
**AC:** First synthetic error visible; PII scrubbed.
**Depends on:** S-181.

### S-183 · RUM (Core Web Vitals)
ENG · ~60 min
**Goal:** CWV captured per route; dashboard published.
**AC:** Landing LCP < 2.5s p75; budget alert configured.
**Depends on:** S-181.

### S-184 · Synthetic monitoring (uptime, OTP path)
ENG · ~60 min
**Goal:** Every 5 min, hit landing + OTP path; alert on 2 consecutive fails.
**AC:** Status page link in `/press` + Profile.
**Depends on:** S-181.

### S-185 · Backup + DR drill (7-day RPO)
ENG · ~60 min
**Goal:** Daily DB snapshot; documented restore drill; 7-day RPO.
**AC:** Drill executed once; runbook in `docs/ops/dr.md`.
**Depends on:** none.

### S-186 · Feature flags (Statsig / OpenFeature wrapper)
ENG · ~60 min
**Goal:** Wrap a flag SDK so VAP, Yogi-cost-throttle, and S-136 all flip via config.
**AC:** First two flags live; default-OFF in production.
**Depends on:** none.

### S-187 · CI/CD: preview-per-PR + main → prod
ENG · ~60 min
**Goal:** Every PR gets a Vercel preview; merging to main deploys after green CI.
**AC:** Branch protections on; required checks listed.
**Depends on:** none.

### S-188 · Load test before launch (1k → 10k concurrent)
ENG · ~60 min
**Goal:** k6 scenario simulating signup → first-message; ramp 1k → 10k.
**AC:** p95 latency < 600ms on signup; no 5xx > 0.1%.
**Depends on:** S-101, S-122.

## 1.10 Phase 1 launch gating (S-191 … S-194)

### S-191 · Beta cohort: invite first 70 users (Rule of 7)
PROD · ~60 min
**Goal:** Curated invite list of 70; in-app banner thanking the cohort.
**AC:** Invite emails + SMS sent; signup conversion tracked.
**Depends on:** S-187, S-188.

### S-192 · Public launch checklist sign-off
TRUST · ~60 min
**Goal:** Run `docs/launch/checklist.md` (legal, security, accessibility, perf).
**AC:** All checks green; sign-off signatures from Paul + Jože.
**Depends on:** S-176, S-184.

### S-193 · Press / partnerships outreach (Slovenia + USA)
BIZ · ~60 min
**Goal:** Send press kit to 7 SI outlets + 7 US outlets; pre-brief 2 podcasters.
**AC:** Outreach tracker updated; embargo until S-194 day.
**Depends on:** S-154.

### S-194 · Phase 1 LAUNCH day
PROD · ~60 min
**Goal:** Flip from invite-only to public; landing CTA → free signup.
**AC:** Status page green for 24h; war-room rotating Paul/Jože/Claude.
**Depends on:** S-191, S-192, S-193.

---

# Phase 2 — Yogi AI, Surveys, B2B Ad Marketplace (Year 2)

> Goal of Phase 2: monetize the trust we built in Phase 1 by adding **Yogi AI** for discovery and search, surveys, and a B2B ad marketplace, with paid Pro and Business tiers.

## 2.1 Yogi AI assistant (S-201 … S-208)

### S-201 · Yogi conversational shell in-app
ENG · ~60 min
**Goal:** "Yogi" entry point in the inbox; chat surface; prompt-history.
**AC:** No user message ever leaves the device unencrypted to Yogi without consent screen.
**Depends on:** S-122.

### S-202 · Yogi suggestion: "Want to grab coffee Friday?"
PROD · ~60 min
**Goal:** Inline "Yogi suggests" chip above the composer (per existing mock).
**AC:** Suggestion accepted with one tap; declined with swipe; learns over time.
**Depends on:** S-201.

### S-203 · Yogi subprocessor selection + DPA
TRUST · ~60 min
**Goal:** Pick the AI subprocessor (Anthropic Claude family, etc.); sign DPA; disclose in Privacy.
**AC:** Privacy §"AI features" updated; SCCs in place if non-EU.
**Depends on:** S-201.

### S-204 · Yogi cost meter + budget guard
ENG · ~60 min
**Goal:** Per-user daily Yogi token budget; meter visible to user.
**AC:** Hitting cap explains why; soft cap at 70% prompts upgrade.
**Depends on:** S-201.

### S-205 · Yogi safety filters (PII, hate, self-harm, CSAM)
TRUST · ~60 min
**Goal:** Pre/post filters around model calls; refusal patterns matched.
**AC:** Red-team set passes 100%; metrics on `yogi.refusal_rate`.
**Depends on:** S-201.

### S-206 · Yogi memory (per-thread, opt-in)
ENG · ~60 min
**Goal:** Yogi may remember thread context for 7 messages; opt-in toggle.
**AC:** Memory wipe on opt-out; user can audit memory.
**Depends on:** S-201.

### S-207 · Yogi-driven smart replies (3 options)
PROD · ~60 min
**Goal:** Tap a chip to send one of 3 Yogi-generated replies (≤ 70 words each).
**AC:** Replies respect Rule-of-7 cap; analytics on accept/decline.
**Depends on:** S-202.

### S-208 · Yogi quality dashboard
ENG · ~60 min
**Goal:** Refusal rate, latency, cost per DAU, accept rate.
**AC:** Live; alert if cost/DAU > target.
**Depends on:** S-204, S-205.

## 2.2 AI search & discovery (S-211 … S-214)

### S-211 · "Find people" search (interest-based)
ENG · ~60 min
**Goal:** Search by up to 7 interest tags (per the original 7-interest-slot design).
**AC:** No real names exposed unless mutual interest; opt-in to be discoverable.
**Depends on:** S-105.

### S-212 · 7-interest profile slots
PROD · ~60 min
**Goal:** Profile lets a user pick exactly up to 7 interest slots.
**AC:** Picker bounded; can swap any time.
**Depends on:** S-151.

### S-213 · Match scoring ("92% MATCH")
ENG · ~60 min
**Goal:** Compute and display a match score on first-contact previews.
**AC:** Score deterministic given the same interest sets; explainer tooltip.
**Depends on:** S-211, S-212.

### S-214 · Discovery rate-limits + safety
TRUST · ~60 min
**Goal:** Cap discovery messages, anti-stalking heuristics, mutual-mute.
**AC:** Heuristics off by default for invited beta; on by default for public.
**Depends on:** S-211.

## 2.3 Surveys (S-221 … S-224)

### S-221 · Survey creator (B2B)
ENG · ~60 min
**Goal:** Business users create a 7-question micro-survey, target by 7 interest tags.
**AC:** Survey saved; preview rendered.
**Depends on:** S-212.

### S-222 · Survey delivery in-app
PROD · ~60 min
**Goal:** Surveys arrive as a special inbox card, capped at 1/day per user.
**AC:** Skip respected; reward (Pro credit) optional.
**Depends on:** S-221.

### S-223 · Survey results dashboard
ENG · ~60 min
**Goal:** Aggregated, anonymized results to the survey owner.
**AC:** k-anonymity ≥ 7 enforced; no result leaks identity.
**Depends on:** S-221.

### S-224 · Survey ethics + Terms update
TRUST · ~60 min
**Goal:** New Terms clause covering paid survey participation and disclosures.
**AC:** Clause added; Privacy mirror.
**Depends on:** S-221.

## 2.4 B2B Ad Marketplace (S-231 … S-238)

### S-231 · Business account onboarding
PROD · ~60 min
**Goal:** Business signup with company info, billing, tax ID.
**AC:** SI VAT validation works (EU); US EIN supported.
**Depends on:** S-152.

### S-232 · Self-serve ad creator
PROD · ~60 min
**Goal:** Existing `/business/ads` polished — copy ≤ 70 words, 1 image, 7 interest tag targets.
**AC:** Preview matches in-app render; lint for banned words.
**Depends on:** S-231, S-211.

### S-233 · Ad delivery slot in inbox (max 1/day)
PROD · ~60 min
**Goal:** Sponsored card; clearly marked "Sponsored"; mute available.
**AC:** Frequency cap honored across devices.
**Depends on:** S-232.

### S-234 · Ad auction + pricing
ENG · ~60 min
**Goal:** Second-price auction over 7 interest tags + region; floor price.
**AC:** Auction settles in < 100ms; logs reproducible.
**Depends on:** S-232.

### S-235 · Advertiser billing + invoices
ENG · ~60 min
**Goal:** Stripe + EU invoicing (Slovenia VAT-MOSS aware).
**AC:** First test invoice issued.
**Depends on:** S-231.

### S-236 · Ad analytics dashboard for advertisers
ENG · ~60 min
**Goal:** Impressions, CTR, conversions, by tag and region.
**AC:** Export CSV; data lives ≥ 13 months.
**Depends on:** S-233.

### S-237 · Ad policy + review queue
TRUST · ~60 min
**Goal:** Content policy, manual review for first 7 ads per advertiser.
**AC:** Reviewer console; SLA 24h.
**Depends on:** S-232.

### S-238 · Ad transparency page (public)
TRUST · ~60 min
**Goal:** Public archive of all running ads (per EU DSA).
**AC:** Page live; downloadable CSV.
**Depends on:** S-233.

## 2.5 Paid tiers (Pro / Business) (S-241 … S-247)

### S-241 · Pro tier: raise the caps
PROD · ~60 min
**Goal:** Pro raises caps: 30 active contacts, last-30 messages retention, 140-word messages.
**AC:** Tier gate applied per cap.
**Depends on:** S-115, S-116, S-111.

### S-242 · Business tier: Yogi pro + ads access
PROD · ~60 min
**Goal:** Business unlocks ad creator, Yogi-pro budgets, surveys.
**AC:** Tier check on each surface.
**Depends on:** S-231.

### S-243 · Stripe checkout + subscription mgmt
ENG · ~60 min
**Goal:** Pro/Business via Stripe; portal for cancel/upgrade.
**AC:** Webhooks idempotent; failed-payment recovery.
**Depends on:** S-152.

### S-244 · EU 14-day cancellation right
TRUST · ~60 min
**Goal:** EU consumers see explicit waiver checkbox to start digital service.
**AC:** Refund flow works; record kept.
**Depends on:** S-243.

### S-245 · Tax handling (US states + EU VAT)
ENG · ~60 min
**Goal:** Stripe Tax enabled; SI VAT, US sales-tax nexus mapped.
**AC:** Sample invoices reviewed by tax advisor.
**Depends on:** S-243.

### S-246 · Promo / referral system (rule-of-7 referrals)
PROD · ~60 min
**Goal:** Refer 7 friends → 7 days Pro free; viral loop instrumentation.
**AC:** No abuse vector; cap per account.
**Depends on:** S-243.

### S-247 · Phase 2 launch checklist + flip
PROD · ~60 min
**Goal:** Flip Pro/Business, ad marketplace, Yogi to public.
**AC:** Status green 24h; revenue flowing.
**Depends on:** S-241..S-246, S-208, S-237.

## 2.6 Phase 2 ops & quality (S-251 … S-256)

### S-251 · A/B test framework
ENG · ~60 min
**Goal:** Wire flag-based A/B with stat-sig calc.
**AC:** First A/B (CTA copy on landing) running.
**Depends on:** S-186.

### S-252 · Cohort analytics (D1, D7, D30)
ENG · ~60 min
**Goal:** Cohort retention chart wired to `/pitch`.
**AC:** Numbers match BI export.
**Depends on:** S-158.

### S-253 · Onboarding funnel optimization
PROD · ~60 min
**Goal:** Identify top 3 drop-off steps and ship 3 fixes.
**AC:** Conversion lifts measured vs A/B.
**Depends on:** S-251, S-252.

### S-254 · Internationalization scaffolding (EN, SI, ES, DE, FR)
ENG · ~60 min
**Goal:** i18n pipeline; first 5 languages.
**AC:** SI ships first (for Jože's market); RTL-ready.
**Depends on:** S-153.

### S-255 · SI launch microsite + press push
BIZ · ~60 min
**Goal:** SI-language landing + press release; coordinate with Pimdom contacts.
**AC:** RTV / Delo / Finance briefed.
**Depends on:** S-254, S-193.

### S-256 · Phase 2 retro + Phase 3 readiness review
PROD · ~60 min
**Goal:** 30-day retro; gate decision to start Phase 3.
**AC:** Decision recorded; Phase 3 sprints unblocked.
**Depends on:** S-247.

---

# Phase 3 — Value Account Pay (Years 3-5)

> Goal of Phase 3: ship **Value Account Pay (VAP)** — a wallet inside CopyMe with a virtual MasterCard, P2P transfers, and merchant payments. This phase is **regulator-gated**: most sprints assume an EMI/BaaS partner is engaged.

## 3.1 Regulatory & partner foundation (S-301 … S-306)

### S-301 · BaaS / EMI partner shortlist
BIZ · ~60 min
**Goal:** Shortlist 5 EU + 3 US partners (Solaris, Modulr, Treezor, Marqeta-via-bank, etc.).
**AC:** Doc with pricing, lead-time, KYC support.
**Depends on:** S-247.

### S-302 · Partner selection + signed term sheet
BIZ · ~60 min
**Goal:** Pick partner; signed term sheet.
**AC:** Term sheet attached to data room.
**Depends on:** S-301.

### S-303 · KYC vendor selection (Onfido / Sumsub / Veriff)
TRUST · ~60 min
**Goal:** Vendor chosen; sandbox connected.
**AC:** Test ID flows in 3 EU + US.
**Depends on:** S-302.

### S-304 · AML / sanctions screening
TRUST · ~60 min
**Goal:** Sanctions list screening (OFAC, EU, UN) for every wallet open.
**AC:** Test cases for hits + false-positive resolution.
**Depends on:** S-303.

### S-305 · PSD2 / SCA compliance design
TRUST · ~60 min
**Goal:** SCA flows for payments > €30 (EU); biometric unlock.
**AC:** Design doc; partner sign-off.
**Depends on:** S-302.

### S-306 · VAP Terms + new fee schedule
TRUST · ~60 min
**Goal:** Add Terms §14 (VAP) + dedicated fee schedule.
**AC:** Lawyer-reviewed; published behind feature flag.
**Depends on:** S-305.

## 3.2 Wallet UI (S-311 … S-316)

### S-311 · Wallet entry point in profile
PROD · ~60 min
**Goal:** "Value Account" tile on profile; opens onboarding.
**AC:** Hidden behind `vap` flag.
**Depends on:** S-186, S-306.

### S-312 · Wallet onboarding flow (KYC handoff)
PROD · ~60 min
**Goal:** In-app KYC handoff; success returns to wallet ready-state.
**AC:** Decline reasons surfaced cleanly.
**Depends on:** S-303, S-311.

### S-313 · Wallet home: balance + recent 7 transactions
PROD · ~60 min
**Goal:** Balance card; last-7 transactions list.
**AC:** Pull-to-refresh; stale ≥ 60s shows refresh CTA.
**Depends on:** S-312.

### S-314 · Top-up via card / SEPA
ENG · ~60 min
**Goal:** Add money via Apple Pay / Google Pay / SEPA.
**AC:** Test top-up succeeds in sandbox.
**Depends on:** S-313.

### S-315 · Withdraw to bank
ENG · ~60 min
**Goal:** SEPA withdrawal; cooldown + 2FA on first.
**AC:** Sandbox withdrawal works.
**Depends on:** S-313.

### S-316 · Statements + receipts
PROD · ~60 min
**Goal:** Monthly PDF statement; per-transaction receipt.
**AC:** PDFs match partner's records.
**Depends on:** S-313.

## 3.3 Virtual MasterCard (S-321 … S-324)

### S-321 · Virtual card issuance
ENG · ~60 min
**Goal:** Tap "Get card" → virtual MasterCard generated via partner.
**AC:** PAN visible only after biometric; card visible in Apple/Google Wallet.
**Depends on:** S-313.

### S-322 · Card controls (freeze, limits, regions)
PROD · ~60 min
**Goal:** Freeze toggle, daily limit, region whitelist.
**AC:** Controls round-trip to partner.
**Depends on:** S-321.

### S-323 · 3DS / SCA challenges in-app
ENG · ~60 min
**Goal:** Receive a 3DS challenge as a CopyMe push; approve in-app.
**AC:** Challenge → approve in < 7s p95.
**Depends on:** S-321, S-305.

### S-324 · Card disputes flow
TRUST · ~60 min
**Goal:** Self-serve dispute; partner SLA tracked.
**AC:** Status visible; resolution time recorded.
**Depends on:** S-321.

## 3.4 P2P transfers + merchants (S-331 … S-335)

### S-331 · P2P transfer to a contact
PROD · ~60 min
**Goal:** From a thread, "Send €" → instant transfer (within CopyMe).
**AC:** Recipient sees a payment card in-thread; Rule-of-7 caveat: max 7 P2P sends/day on free wallet.
**Depends on:** S-313.

### S-332 · Request money from a contact
PROD · ~60 min
**Goal:** "Request €" inline; expires in 7 days.
**AC:** Push notifies, accept/decline tracked.
**Depends on:** S-331.

### S-333 · Split bill (up to 7 people)
PROD · ~60 min
**Goal:** Split a charge across up to 7 contacts.
**AC:** Auto-balanced; remainder to initiator.
**Depends on:** S-331.

### S-334 · Merchant pay (QR / link)
ENG · ~60 min
**Goal:** Scan a merchant QR or open a payment link → pay from wallet.
**AC:** Sandbox merchant flow works.
**Depends on:** S-321.

### S-335 · Cashback / promo credits
PROD · ~60 min
**Goal:** Promotional credits applied as wallet balance.
**AC:** Credits expire per promo Terms.
**Depends on:** S-333.

## 3.5 VAP launch (S-341 … S-345)

### S-341 · Closed beta to 700 wallets (10 × Rule of 7 squared)
PROD · ~60 min
**Goal:** Invite 700 trusted users; whitelist enforced.
**AC:** Pass/fail KPIs predefined.
**Depends on:** S-321, S-331.

### S-342 · Fraud monitoring
TRUST · ~60 min
**Goal:** Velocity rules, device-binding, geo-velocity.
**AC:** Test fraud cases blocked.
**Depends on:** S-341.

### S-343 · Customer-support tooling for VAP
PROD · ~60 min
**Goal:** Internal ticketing with read-only wallet view (no PAN).
**AC:** Two CS agents trained.
**Depends on:** S-341.

### S-344 · Phase 3 public launch
PROD · ~60 min
**Goal:** Flip VAP flag for all eligible regions.
**AC:** Status green 7 days; partner SLA met.
**Depends on:** S-341..S-343.

### S-345 · Phase 3 retro + Series A readiness
BIZ · ~60 min
**Goal:** 90-day retro; Series A deck refresh.
**AC:** Deck v2 in data room.
**Depends on:** S-344.

---

# Parallel — Business / Investor Workstream

> Runs in parallel with engineering. Sprints are 1-hour planning/working units.

### B-001 · Pick the legal home for CopyMe (USA Inc. or SI d.o.o.; or two-co structure)
BIZ · ~60 min
**Goal:** Decide entity structure: most likely **Delaware C-corp + SI d.o.o. operating sub** for EU presence.
**AC:** Decision memo signed by Paul + Jože.
**Depends on:** none.

### B-002 · 50/50 cap-table draft
BIZ · ~60 min
**Goal:** Founder split 50/50; ESOP pool 10%; vesting 4y/1y cliff.
**AC:** Draft cap table in data room.
**Depends on:** B-001.

### B-003 · Engage formation counsel (US + SI)
BIZ · ~60 min
**Goal:** Retain 1 US firm, 1 SI firm; engagement letters signed.
**AC:** Engagement letters in data room.
**Depends on:** B-001.

### B-004 · IP assignment from founders to NewCo
BIZ · ~60 min
**Goal:** All existing IP (repo, brand, designs) assigned to NewCo.
**AC:** Signed IP assignments stored.
**Depends on:** B-003.

### B-005 · Trademark search + filing for "CopyMe" / "CpM" (US, EU, SI)
BIZ · ~60 min
**Goal:** Searches in 3 jurisdictions; file priority.
**AC:** Filing receipts attached.
**Depends on:** B-003.

### B-006 · Define what we offer for €1M angel
BIZ · ~60 min
**Goal:** Term sheet draft: SAFE post-money cap **€10M**, 20% discount, MFN; alternative priced round Series Seed at **€8M pre, €1M new = 11.1% dilution**.
**AC:** Two side-by-side options in a memo.
**Depends on:** B-002.

### B-007 · Investor data-room build (Notion / Docsend mirror of `/pitch`)
BIZ · ~60 min
**Goal:** Mirror the public `/pitch` data room to a private DocSend with NDA-gated extras (cap table, term sheet, contracts).
**AC:** Index page complete.
**Depends on:** S-158, B-002, B-006.

### B-008 · Investor pitch deck v2 (12 slides)
BIZ · ~60 min
**Goal:** Refresh deck: problem, Rule of 7 thesis, traction, roadmap (Phase 1-3), team, ask.
**AC:** PDF in data room; rehearsed once.
**Depends on:** B-007.

### B-009 · Boscarol-track outreach plan (Slovenia)
BIZ · ~60 min
**Goal:** Mapping of intros to Ivo Boscarol (Pipistrel exit); outreach script in SI.
**AC:** First intro asked.
**Depends on:** B-008.

### B-010 · Diversify: 7 more SI/EU angels + 7 US angels
BIZ · ~60 min
**Goal:** Build a 14-name target list; rationale per name.
**AC:** Target list in data room.
**Depends on:** B-008.

### B-011 · Capital plan (use of funds, by quarter)
BIZ · ~60 min
**Goal:** Quarterly burn vs milestones for the €1M; 18-month runway target.
**AC:** Spreadsheet `capital_plan.xlsx` in data room.
**Depends on:** B-006.

### B-012 · Close the round
BIZ · ~60 min
**Goal:** Sign + wire; update cap table; founder + investor announcement (under embargo until press date).
**AC:** Funds in NewCo bank; press post-launch.
**Depends on:** B-009 or B-010.

### B-013 · Use of proceeds — €1M breakdown
BIZ · ~60 min · **NEW per Feedback 3**
**Goal:** Per-line use-of-funds for the €1M, by category and by quarter (Q3 2026 → Q4 2027).
**AC:**
- One-page table in `docs/investor/use_of_proceeds.md` summing exactly to €1,000,000.
- Categories: Engineering, Infra/AI/SMS, Legal/Compliance, Marketing/PR, Product/Design, Operating buffer, Founders' stipend.
- Each row tied to a milestone in this plan.
- Mirrored into the `Capital Plan` tab of the tracker.
**Depends on:** B-006.

### B-014 · Additional investor target list (≥21 names)
BIZ · ~60 min · **NEW per Feedback 3**
**Goal:** Vetted candidate list beyond Boscarol: 7 SI/EU + 7 US + 7 strategic/corporate.
**AC:**
- Saved as `docs/investor/target_list.md` and as a tab in the tracker.
- Each entry: name, fund/role, ticket size, thesis fit, mutual contact, intro path, status.
- Top 5 ranked "do this week".
**Depends on:** B-008.

### B-015 · Timeline-to-launch communique for Jože
BIZ · ~60 min · **NEW per Feedback 3**
**Goal:** 1-page, public-shareable timeline document with the 4 launch gates (G0..G3).
**AC:** Saved as `docs/investor/timeline.md` + `timeline.pdf`.
**Depends on:** none — content is in `FEEDBACK_3_CORRECTION_PLAN.md` §3.

### B-016 · Definition of "Customer-ready" gate
TRUST · ~60 min · **NEW per Feedback 3**
**Goal:** Written definition of the moment new customers can apply (G2).
**AC:** Saved as `docs/launch/customer_ready_gate.md` covering Functional, Trust, Ops, Regional bars + sign-off matrix.
**Depends on:** Phase 1.10 scoping (already complete).

---

## Dependency overview (high-level)

```
Sprint 0  ──▶ Phase 1.1 (Auth)
              │
              ├──▶ 1.2 (Rule-of-7) ──▶ 1.3 (Inbox/Composer) ──▶ 1.4 (Voice/Video)
              ├──▶ 1.5 (Encryption)
              ├──▶ 1.6 (Public pages)
              ├──▶ 1.7 (Mobile packaging)
              ├──▶ 1.8 (Trust & Safety)
              └──▶ 1.9 (Observability) ──▶ 1.10 (Launch gating) ──▶ Phase 1 LIVE

Phase 1 LIVE ──▶ Phase 2 (Yogi → Surveys → Ads → Paid tiers) ──▶ Phase 2 LIVE

Phase 2 LIVE ──▶ Phase 3.1 (Regulatory) ──▶ 3.2 (Wallet UI) ──▶ 3.3 (Card)
                                                             ──▶ 3.4 (P2P/Merchants)
                                                             ──▶ 3.5 (LAUNCH)

Business workstream runs in parallel; B-007/008/009 unlock the €1M close (B-012)
which funds Phase 1 launch and Phase 2 build-out.
```

---

## Risks & mitigations

| Risk | Phase | Mitigation |
|---|---|---|
| Rule-of-7 caps feel punishing on Day 1 | 1 | Soft warnings before hard blocks; clear upgrade path; in-product education |
| Yogi cost runs hot at scale | 2 | S-204 cost meter + S-208 dashboard + tier-gated quotas |
| BaaS partner change forces re-architecture | 3 | S-302 chooses partner with portable API; isolate via internal abstraction |
| Single-investor dependency on Boscarol | BIZ | B-010 diversifies to 14 backups |
| Slovenia/US tax + employment complexity | BIZ | B-001 structure decision early; specialist counsel both sides |
| Open-source / privacy expectation gap | TRUST | Publish T&C diff log; first transparency report (S-176) before LAUNCH |

---

## Cadence & ceremonies (lightweight)

- **Daily:** 10-min stand-up between Paul + Jože + Claude.
- **Weekly:** sprint-tracker review (the `.xlsx`); promote 7 sprints to "this week".
- **Bi-weekly:** demo of shipped sprints to a small advisor circle.
- **Monthly:** investor update email referencing the `/pitch` data room.

---

*This plan is the source of truth for Claude Code execution. The companion `copyme_sprint_tracker.xlsx` is the live status board. Sprints may be added or split, but every sprint must remain ≤ 60 minutes of focused work — if it grows, split it.*
