# 09 — Next Steps: From Scaffolded to Production

**Audience:** Paul + Jože · day-by-day operational doc.
**Last updated:** 2026-05-10
**Companion to:** `07-production-readiness.md` (gates G0 → G3) + `06-feedback-trail.md` (open asks).

The Phase 1 codebase is 90% scaffolded. **"Scaffolded" is not "live"** —
APIs exist but need provider keys; UI components exist but need to be wired
into the app shell; docs exist but need execution. This is the critical
path that closes that gap.

## TL;DR — the 4 categories of remaining work

| Category | Owner | Calendar |
|---|---|---|
| **A — Founder unblocks** (5 items) | Paul + Jože | This week (by 2026-05-16) |
| **B — Provider wiring** (8 items) | Paul (with key access) | Week of 2026-05-18 |
| **C — Real engineering work still required** (9 items) | Engineering | Weeks of 2026-05-18 → 2026-05-29 |
| **D — Validation + soak** (5 items) | Paul + Jože | Week of 2026-06-01 → 2026-06-08 |
| **E — Business gates** (parallel) | Counsel + investors | 2026-05-11 → 2026-06-30 |

If A, B, C, D land on schedule, **G2 (customer-ready, 70-user beta opens)
hits 2026-06-02** and **G3 (public launch) hits 2026-06-09** — matching
the timeline in `FEEDBACK_3_CORRECTION_PLAN.md`.

---

## A. Founder unblocks — 5 items, this week

These cost minutes of decision time but block downstream engineering work.

| # | Ask | Decision needed | Blocks |
|---|---|---|---|
| A1 | **Pick a logo variant** | Open `design/logo-explorations/README.md`, choose A or B (or "neither — keep current") | OG image regeneration; press kit shipment; mobile store icons (S-164, S-165) |
| A2 | **Domain `copyme1.com`** | Confirm registered, or authorize Paul to register (€15/yr) | Email migration polish (S-009); contact channel for press + investors |
| A3 | **Email policy** | Alias-only forwarder, or Google Workspace mailbox (€5/user/mo with DKIM) | Email deliverability for OTP, password reset, daily digest, investor inquiries |
| A4 | **Slovenia counsel** | Pick one: Senica · Schoenherr · Jadek & Pensa | Entity formation (B-001 → B-003); IP assignment (B-004); SI Terms review |
| A5 | **Boscarol intro script** | Approve Slovenian-language ~150-word script in `B-009-boscarol-outreach.md` | Investor outreach kickoff; €1M close timing (B-012) |

**Reply format Paul wants:** one-line ✓ / change request per item. 5 lines, ~5 minutes.

---

## B. Provider wiring — 8 items

Engineering work is small here (mostly env vars + smoke tests). The real
constraint is account creation + key procurement.

| # | What | What it unblocks | Owner notes |
|---|---|---|---|
| B1 | **Twilio production account** + verified sender phone | Real SMS OTP (S-103) → S-008 cross-device test → public sign-up | Sandbox is fine for staging; production needs verified sender + DLR |
| B2 | **Stripe live mode** keys + webhook secret | Real ad payments + Pro/Business subscriptions (S-243, S-245) | Today only test-mode; need Stripe Tax enabled for SI VAT |
| B3 | **Sentry DSN** in prod env | Live error tracking + RUM (S-181, S-182) | Already wired code-side; just needs `NEXT_PUBLIC_SENTRY_DSN` set |
| B4 | **Anthropic API key** in prod (already configured per architecture review) | Yogi production responses | Verify per-user $0.10 daily cap holds in production traffic |
| B5 | **VAPID keys** for push (already exist but verify rotation policy) | Web Push notifications (S-129) | Document rotation cadence in DR runbook |
| B6 | **Resend (or alt) production key** | Transactional email (welcome, OTP fallback, digest) | Console-fallback is in place; real key needed for production sender domain |
| B7 | **Apple Developer Program enrollment** ($99/yr) | TestFlight builds (S-164) → App Store submission | 24–48h for verification |
| B8 | **Google Play Developer Console** ($25 one-time) | Internal track (S-165) → Play Store submission | ~24h for verification |

---

## C. Real engineering work still required — 9 items

These are NOT scaffolding — they're the items where current code is a
stand-in or stub and production needs the real thing. Estimated effort
in working days assumes one focused engineer.

| # | What | Why it matters | Effort | Sprint ref |
|---|---|---|---|---|
| C1 | **Replace polling with realtime** | At >100K MAU pure polling chokes DB + cache. socket.io worker on a separate Node service (or Vercel Edge streaming). Keep polling as fallback. | 3–5d | follow-up to S-194 |
| C2 | **Wire EXIF strip + MIME sniff into upload route** | `lib/media/exif-strip.ts` + `lib/media/sniff.ts` exist but aren't called from `/api/messages/send` for image uploads. GPS leak risk if not wired. | 0.5d | S-133 follow-up |
| C3 | **Avatar / media upload pipeline to Vercel Blob** | Display-name + avatar (S-105) and chat media (S-133, S-134) need actual object storage + signed URLs. Currently slot exists. | 1–2d | S-105 / S-134 follow-up |
| C4 | **libsignal proper (replace WebCrypto stand-in)** | Today `lib/e2e/cipher.ts` uses ECDH-P256 + AES-GCM as a stand-in. Production should use `@signalapp/libsignal-client` wasm with X3DH + Double Ratchet. | 4–6d | S-142 follow-up |
| C5 | **Translation pipeline** | `Message.languageOriginal/Translated/translatedText` columns exist; no service call. Wire Anthropic Claude (cheap) or DeepL on send when receiver's preferred language differs. | 1–2d | post-launch |
| C6 | **Re-enable TS + ESLint errors during build** | `next.config.ts` currently silences both; CI catches but local builds can ship broken. | 0.5d | pre-G3 |
| C7 | **Test coverage expansion** | Today: 25 tests (phone + ruleof7). Need: auth (login, refresh, replay), sessions (rotation), Stripe webhook (signature verify), surveys (k≥7), e2e cipher. | 3–4d | rolling |
| C8 | **Capacitor build green** | `mobile/` project doesn't exist yet — need to run the recipe in `docs/mobile/capacitor.md`, get iOS + Android shells building, wire push tokens. | 2–3d | S-163 |
| C9 | **Admin moderation queue UI** | API exists (`/api/admin/suspensions`, reports) but no admin UI page. Reviewer SLA in S-237 needs a screen. | 1–2d | S-237 follow-up |

**Total engineering load:** ~16–25 working days = **3–5 weeks of one
engineer** to close all of C1–C9. Realistically C1 (realtime) and C8
(Capacitor) are the long poles; C2, C3, C6, C9 land in days.

---

## D. Validation + soak — 5 items

These are the gates between "code complete" and "press embargo lifts."
None can be self-executed — they need real users + calendar time.

| # | What | When | Pass criteria |
|---|---|---|---|
| D1 | **Cross-device test (S-008)** | After B1 (Twilio prod) + B7/B8 (TestFlight/Internal builds) | Paul (+1) and Jože (+386) complete sign-up + send messages + verify Rule-of-7 caps + screenshot to `docs/qa/2026-05-launch-readiness/` |
| D2 | **DR drill (S-185)** | Once production DB is live | Restore from PITR snapshot in <30 min, smoke test passes, document outcome in `docs/ops/dr.md` drill log |
| D3 | **k6 load test (S-188)** | Against staging with seeded data | p95 signup <600ms at 5K VUs, 5xx <0.1%, Yogi cost stays in budget |
| D4 | **Beta cohort soak (S-191)** | G2 → G3 (7 days) | Invite 70 per `docs/launch/beta-cohort.md`. Pass: ≥50/70 sign up, ≥35/70 send a message, no Sev-1, status green for 7 days |
| D5 | **Press embargo coordination (S-193)** | T-7 to T-day for G3 | 7 SI + 7 US outlets briefed; 2 podcasters pre-recorded; embargo lift at G3 + 0 |

---

## E. Business gates (running parallel) — won't block code, will block close

| # | What | When | Output |
|---|---|---|---|
| E1 | Entity formation (B-001 / B-003) | Week of 2026-05-11 | Delaware C-corp incorporated; SI d.o.o. set up; counsel engaged in both jurisdictions |
| E2 | Cap table + IP assignment (B-002 / B-004) | Week of 2026-05-18 | 50/50 founders + 10% ESOP; IP assigned to NewCo before any equity issued |
| E3 | Trademark filings (B-005) | Week of 2026-05-18 | "CopyMe" + "CpM" filed in US, EU, SI (classes 9, 38, 42) |
| E4 | Term sheet locked (B-006) | Week of 2026-05-18 | SAFE @ €10M cap (default) or priced @ €8M pre (alternative); Jože's choice on table |
| E5 | Investor packet locked (B-007 / B-008 / B-013 / B-014) | Week of 2026-05-25 | Data room live, deck v2 rehearsed, use-of-funds + 25-name angel list ready |
| E6 | Boscarol ask (B-009) | Week of 2026-06-01 | First conversation booked |
| E7 | Parallel angels (B-010) | Week of 2026-06-08 | 14-name target list active; warm intros in progress |
| E8 | Round close (B-012) | 2026-06-15 → 2026-06-30 | Funds in NewCo bank; cap table updated |

E5–E8 happen *after* G2 so the deck can lead with real beta-cohort numbers
rather than pre-product slides.

---

## Critical path (the dependency chain)

```
A1 (logo)        ──────────────┐
A2 (domain)  ──┐               ├──► press kit ship → D5 press embargo
A3 (email)   ──┴──► B6 Resend ─┘

A4 (counsel) ──► E1 entity ──► E2 cap+IP ──► E3 TM ──► E4 term sheet ──► E8 close
                                                            │
A5 (Boscarol script) ──► E6 ask ────────────────────────────┘

B1 (Twilio) ──► C2 (EXIF wire) ─┐
B2 (Stripe) ──► C7 (webhook test)─┤
B3 (Sentry) ──► (live)            ├──► D2 DR ─┐
B4 (Anthropic) ──► (verify cap)   │           ├──► G2 customer-ready
B5 (VAPID) ──► (verify)           │           │
B6 (Resend) ──► (live)            │           │
B7 (Apple) ──► C8 Capacitor ────► D1 cross-device ──► D4 beta soak ──► G3 launch
B8 (Play)  ──► C8 Capacitor ────────┘                                    │
                                                                         │
C1 (realtime) ──► (post-launch upgrade if MAU > 100K)                    │
C3 (avatars) ────────────────────────────────────────► D3 k6 ────────────┤
C4 (libsignal) ──► (Phase 1.5 post-launch hardening)                     │
C5 (translation) ──► (Phase 2 international rollout)                     │
C6 (TS strict)  ──► CI gate ─────────────────────────────────────────────┤
C9 (admin UI)  ──► moderation ready ─────────────────────────────────────┘
```

The single longest item is **B7/B8 → C8 (Capacitor) → D1 (cross-device)**.
That's the chain that gates a real mobile install + the founder QA pass.
Start B7/B8 today.

---

## What's NOT on this list (deliberately)

These are post-G3 / post-launch items. Don't let them slow Phase 1:

* **Phase 2 (Yogi top-level surface, surveys UI, ad marketplace UI polish)** — code is scaffolded; UI surface ships in Phase 2.1.
* **Phase 3 VAP (wallet, virtual MasterCard, P2P, merchant pay)** — gated on signed BaaS partner (S-302 — blocked) and Series A funding.
* **Translation, libsignal proper, real-time WebSocket** — items C1, C4, C5 above are *enhancements* to a working Phase 1, not pre-conditions for it.
* **App Store featuring / Play Editorial** — chase post-launch with traction numbers.
* **EU DSA full transparency report** — Q3 2026 first report (template ready in `docs/transparency/2026-Q3-template.md`).

---

## The 7 things to stop doing

(Common ways founders + engineers slow themselves down. Naming explicitly so we don't.)

1. **Don't add Phase 2 features before G3.** Yogi's already in production; surveys + ad marketplace polish wait until Phase 2.1.
2. **Don't ship a Phase 3 surface "for the deck."** Investors react worse to a half-built wallet than to a clearly deferred one.
3. **Don't hire a sales team before pilot data.** Route A says 10–20 pilots first; sales hires are funded out of Series A, not the angel round.
4. **Don't lead with "Western WeChat."** External pitches use "anti-noise communication platform." Internal vision can stay aspirational.
5. **Don't run a paid acquisition campaign before D4 retention proves.** Beta cohort D7 ≥35% is the gate; below that, paid spend is wasted.
6. **Don't skip the DR drill.** Once is enough pre-G3 but it must be once.
7. **Don't promise public launch before E1 (entity) closes.** Trademark + IP + counsel signoff need a legal home that exists.

---

## Suggested cadence

* **Daily** (M–F, 10 min) — Paul + Jože + Claude standup. Review tracker. Promote 7 sprints to "this week."
* **Weekly** — Friday EOD: tag a version (`vX.Y.Z`), deploy to prod, share a 10-minute Loom with Jože.
* **Bi-weekly** — Demo to a small advisor circle.
* **Monthly** — Investor update email (referencing `/pitch` data room).

---

## What this doc is for

This is the *operational sequel* to `07-production-readiness.md`. That
document tells you **the gates** (G0 → G3) and **the dates** (2026-05-12 →
2026-06-09). This document tells you **the items** that have to happen
**inside those dates** and **who owns each one.**

Update this doc:
* When an item flips done (mark with ✅ inline).
* When a new blocker surfaces (add a row).
* After each gate (G0 / G1 / G2 / G3) — collapse completed sections,
  surface the next gate's items.
