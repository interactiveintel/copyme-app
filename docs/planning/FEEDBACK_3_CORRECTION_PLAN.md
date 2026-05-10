# CopyMe — Feedback 3 Correction Plan & Timeline

**For:** Jože Kralj (Pimdom d.o.o., Slovenia)
**From:** Paul Pereira (InteractiveIntel, USA) + Claude
**Date:** 2026-05-10 · **Source file:** `Feeedback 3.docx` · **Plan companion:** `SPRINT_PLAN.md`, `sprint_tracker.xlsx`

---

## TL;DR for Jože

Of the 14 markings in Feedback 3, **9 were already covered** by Sprint 0 in the existing plan, **5 are new asks** that I've added as concrete sprints (`S-009`, `S-010`, `B-013`, `B-014`, `B-015`, `B-016`). Sprint 0 + the new corrections will close in the **first 3 working days** (target finished by **Tue 2026-05-12 EOD**). Phase 1 (the full free communication app) is on track to be **launch-ready by Tue 2026-06-02**, with public launch **Tue 2026-06-09** after a 7-day beta soak. The €1M angel materials (use of proceeds, target list, deck v2) finalize **Fri 2026-05-29**, in time for a Boscarol-track ask the week of **2026-06-01**.

---

## 1. What changed between Feedback 2 (2026-05-07) and Feedback 3

### 1.1 Reconfirmed asks (already in Sprint 0)

| # | Feedback 3 marking | Already addressed by |
|---|---|---|
| 1 | Strike "Built on the / Seven / Seventy words" — keep the new subhead wording | **S-002** Hero subhead rewrite |
| 2 | T&C "At a glance" — collapse Rule-of-7 details into "by the Rule of 7 (underlined)" | **S-003** Move Rule-of-7 mechanics into Terms §3 |
| 3 | T&C — replace "We can suspend" with "accounts that break these rules could be suspended" (and fix `suspened` typo) | **S-004** Suspension wording fix |
| 4 | Logo — keep mark, drop "Rule of 7" script | **S-005** |
| 5 | Logo — explore "small globe with man in front" per original paper | **S-006** |
| 6 | Production-ready definition / when launch | Phase 1.10 (S-191..S-194) |
| 7 | Initial launching plan | Phase 1.10 + this timeline |
| 8 | Hybrid B2B + Customer rationale | Phase 2 (B2B ad marketplace) |
| 9 | Boscarol candidate (Slovenia) | **B-009** |

### 1.2 Genuinely new asks in Feedback 3

| # | Feedback 3 marking | New sprint | Why it's new |
|---|---|---|---|
| A | **Contact email change** — `interactiveintel@gmail.com` → `info@copyme1.com` (Terms §13 and everywhere it appears) | **S-009** | Brand-new domain `copyme1.com` introduced; not present in Feedback 2 |
| B | **Hero correction** — Keep "Communication That Matters" as primary headline; add "Your World's chart of Communication" as a **second** headline (not a replacement) | **S-010** (also revises **S-001**) | I previously read Feedback 2 as a replacement; Feedback 3 makes clear both headlines stay |
| C | **"Search for other potential targets or investment. Provide list"** | **B-014** | Diversify beyond Boscarol; previously only one named candidate |
| D | **"Establish a Time estimation when app is technically ready to run and grow" + "Where is the point where clients can apply"** | **B-015** + **B-016** | Joze wants a single dated communique he can show partners + a written definition of the customer-apply gate |
| E | **"Show use of proceeds"** for the €1M | **B-013** | Previously only a top-line capital plan; now needs a per-line use-of-funds breakdown |

### 1.3 Correction to the prior plan

I'm flagging this because it materially changes Sprint 0:

> **S-001 was wrong.** I had Sprint S-001 as "Replace H1 with 'Your World's chart of Communication' and remove 'Communication That Matters'." Re-reading Feedback 2 against Feedback 3, only "Copies" was struck — "Communication That Matters" was always meant to stay. **S-010** corrects this: keep "Communication That Matters" as H1, add "Your World's chart of Communication" as a sub-headline (above the Rule-of-7 paragraph). The S-001 description in `SPRINT_PLAN.md` and the tracker has been updated.

---

## 2. The 6 new sprints (Feedback 3)

### S-009 · Contact email migration to `info@copyme1.com`
Sprint 0 · TRUST · ~60 min
**Goal:** Replace `interactiveintel@gmail.com` with `info@copyme1.com` everywhere it's user-facing or contractual.
**Acceptance criteria:**
- `grep -ri "interactiveintel@gmail.com"` returns 0 hits across the repo (excluding git history and CHANGELOG).
- Updated in `app/terms/page.tsx` §13, `app/privacy/page.tsx`, `app/press/page.tsx`, `README.md`, `app/contact/*` if present.
- DNS for `copyme1.com` resolves; MX + SPF + DKIM + DMARC published.
- A test email to `info@copyme1.com` is received and auto-replied.
- Old gmail address kept as a passive alias for 90 days to catch stragglers.
**Touches:** `app/terms/page.tsx`, `app/privacy/page.tsx`, `app/press/page.tsx`, `README.md`, repo grep, DNS provider.
**Depends on:** none (DNS prerequisite — register domain if not yet held).
**Risk:** if `copyme1.com` is unregistered, S-009 first-run produces a domain-purchase order; budget €15/yr.

### S-010 · Hero correction — restore "Communication That Matters" as primary
Sprint 0 · PROD · ~60 min · **Supersedes part of S-001**
**Goal:** H1 reads "Communication That Matters". Below it, a second-tier headline reads "Your World's chart of Communication". The Rule-of-7 paragraph (per S-002) sits below both.
**Acceptance criteria:**
- DOM order on `/`: H1 ("Communication That Matters") → H2 ("Your World's chart of Communication") → subhead paragraph (S-002 wording).
- "Copies" string removed from the hero (the word `Copies` is only struck in Feedback 3).
- OG image regenerated with the correct H1 and H2.
- Lighthouse a11y score ≥95 unchanged.
**Touches:** `app/page.tsx`, OG image route.
**Depends on:** none. **Note to Claude Code:** if S-001 was already merged with the wrong wording, S-010 is the rollback + correct.

### B-013 · Use of proceeds — €1M breakdown
Business · BIZ · ~60 min
**Goal:** Per-line use-of-funds for the €1M raise, broken down by category and by quarter, ready to drop into the deck and DocSend.
**Acceptance criteria:**
- One-page table in `docs/investor/use_of_proceeds.md` covering 6 quarters: Q3 2026 → Q4 2027.
- Categories: Engineering salaries, Infra/AI compute/SMS, Legal & compliance, Marketing & PR, Product/design, Operating buffer.
- Sums to €1,000,000 exactly.
- Each row tied to a milestone in the master plan (e.g. "Engineering Q3 2026 funds Phase 1.5 + 1.6 + 1.7").
**Touches:** `copyme_sprint_tracker.xlsx` Capital Plan tab; new `docs/investor/use_of_proceeds.md`.
**Depends on:** B-006 (offer definition).

### B-014 · Additional investor target list (≥14 names)
Business · BIZ · ~60 min
**Goal:** A vetted list of investor candidates beyond Ivo Boscarol, with rationale, fit score, and intro path.
**Acceptance criteria:**
- 7 SI/EU candidates + 7 US candidates + 7 strategic/corporate (21 names total — Rule of 7 echoed).
- Each entry: name, fund/role, ticket size, thesis fit, mutual contact (if any), intro path, status.
- Ranked by likelihood × fit; top 5 marked "do this week".
- Saved as `docs/investor/target_list.md` and as a tab in `copyme_sprint_tracker.xlsx`.
**Touches:** new `docs/investor/target_list.md`; tracker.
**Depends on:** B-008 (deck v2 — so we know what we're pitching).

### B-015 · Timeline-to-launch communique for Jože
Business · BIZ · ~60 min
**Goal:** A 1-page, public-shareable timeline Joze can hand to Boscarol or any investor: dates, gates, what unlocks at each.
**Acceptance criteria:**
- Single page, mobile-readable, with the 4 launch gates from §3 below.
- Saved as `docs/investor/timeline.md` and exported to `docs/investor/timeline.pdf`.
- Mirrors what's in §3 of this document but in investor-friendly language.
**Touches:** new `docs/investor/timeline.{md,pdf}`.
**Depends on:** none — this document supplies the content.

### B-016 · Definition of "Customer-ready" gate
Business · TRUST · ~60 min
**Goal:** A written, checkable definition of *the moment new customers can apply* — the gate Joze keeps asking about.
**Acceptance criteria:**
- One page in `docs/launch/customer_ready_gate.md` defining: (1) functional bar (what works); (2) trust bar (Terms, Privacy, Cookie banner, age gate, T&S in place); (3) ops bar (uptime, error budget, on-call); (4) regional bar (which countries open, which are gated); (5) the formal sign-off matrix (Paul + Joze + counsel).
- Cross-references the relevant Phase 1 sprints (S-191, S-192).
- Includes the test plan to validate each bar.
**Touches:** new `docs/launch/customer_ready_gate.md`.
**Depends on:** Phase 1.10 sprints scoped (already done).

---

## 3. Timeline (you asked — here it is)

All dates assume execution starts **Mon 2026-05-11** at a sustained cadence of ≈6 sprints/day on engineering and 2 sprints/day on the business track running in parallel. Working days are Mon–Fri.

### Gate-by-gate

| Gate | Date | Definition | Sprints behind it |
|---|---|---|---|
| **G0 — Joze's feedback closed** | **Tue 2026-05-12 EOD** | Sprint 0 + Feedback-3 corrections shipped to production; Joze + Paul both can install the PWA on phones (US +1 / SI +386), exchange messages, and validate Terms wording | S-001 → S-010 |
| **G1 — Phase 1 core complete** | **Fri 2026-05-22 EOD** | Auth + Rule-of-7 enforcement (server-side) + Inbox/Composer + Voice/Video + E2E encryption all working in staging; internal alpha | S-101..S-146 |
| **G2 — Customer-ready** | **Tue 2026-06-02 EOD** | Public pages polished, mobile packaging on TestFlight + Play Internal, Trust & Safety + Observability live, load test passed, **invite-only beta opens to 70 users** | S-151..S-191 |
| **G3 — Public launch** | **Tue 2026-06-09 EOD** | 7-day beta soak passed (status green, no Sev-1), public flag flipped, press embargo lifts | S-192..S-194 |

### Week-by-week build

```
Week of Mon 2026-05-11 ──────────────────────────────
  Mon  S-001..S-008  (Sprint 0 — Joze's reconfirmed edits)
  Tue  S-009, S-010, B-015, B-016 (Feedback 3 deltas) → G0 hit
  Wed  S-101..S-110 (Auth & Onboarding)
  Thu  S-111..S-118 (Rule-of-7 enforcement)
  Fri  S-121..S-126 (Inbox & Composer, part 1)
  >> Saturday 2026-05-16: send Joze a Loom showing Sprint 0 + Auth on phones

Week of Mon 2026-05-18 ──────────────────────────────
  Mon  S-127..S-130 (Composer wrap), S-131..S-132 (Voice/Video start)
  Tue  S-133..S-136 (Voice/Video wrap)
  Wed  S-141..S-146 (E2E encryption) → G1 hit by EOD Fri
  Thu  S-151..S-156 (Profile, Pricing, Press, Privacy, Terms diff)
  Fri  S-157..S-158 (Cookie banner, Pitch polish) → G1 hit ✓
  >> Saturday 2026-05-23: investor packet readiness review (B-006..B-008)

Week of Mon 2026-05-25 ──────────────────────────────
  Mon  S-161..S-166 (Mobile packaging — PWA + Capacitor + stores)
  Tue  S-171..S-176 (Trust & Safety — report, block, hash matching, suspension)
  Wed  S-181..S-184 (Logging, Sentry, RUM, synthetic monitoring)
  Thu  S-185..S-188 (Backups, flags, CI/CD, load test)
  Fri  S-191 (Beta cohort invite to 70) → G2 hit
  >> Friday 2026-05-29: deck v2 + use-of-proceeds + investor list ready

Week of Mon 2026-06-01 ──────────────────────────────
  Mon  S-192 (Launch checklist sign-off)
  Tue  S-193 (Press outreach) → G2 customer-ready ✓
  Wed–Mon  Beta soak (7 days)
  >> Monday 2026-06-08: go/no-go meeting — Paul + Joze + counsel

Week of Mon 2026-06-08 ──────────────────────────────
  Tue  S-194 — Phase 1 PUBLIC LAUNCH → G3 hit ✓
```

### Investor track (parallel, ≈2 sprints/day)

| Week of | Investor sprints | Outcome |
|---|---|---|
| 2026-05-11 | B-001 (entity), B-002 (cap table), B-003 (counsel) | Decisions captured; counsel engaged |
| 2026-05-18 | B-004 (IP assignment), B-005 (TM filings), B-006 (€1M offer) | Term-sheet options drafted |
| 2026-05-25 | B-007 (data room), B-008 (deck v2), B-013 (use of proceeds), B-014 (target list) | Investor packet locked |
| 2026-06-01 | B-009 (Boscarol ask), B-010 (parallel angels) | First conversations begin |
| 2026-06-15 → 2026-06-30 | B-011 (capital plan refresh), B-012 (close) | Target close inside June |

### Phase 2 & Phase 3 (high-level)

- **Phase 2** (Yogi AI, surveys, ad marketplace, paid tiers): ramp begins **Mon 2026-06-15**, target Phase 2 launch **Mon 2026-08-31**.
- **Phase 3** (Value Account Pay): regulatory partner selection starts **Sept 2026**; closed beta to 700 wallets target **Q2 2027**; public VAP launch target **Q4 2027**.

---

## 4. Use-of-proceeds preview (full draft in B-013)

To save Joze a step before B-013 closes, here's the targeted shape of the €1M:

| Category | €  | % | What it funds |
|---|---:|---:|---|
| Engineering (2 senior devs + Claude Code) | 360,000 | 36% | Phase 1 + Phase 2 build through Q4 2027 |
| Infra: Vercel, Supabase/Postgres, SMS (Twilio), AI compute (Yogi) | 110,000 | 11% | Hosting, OTP traffic, Yogi token spend |
| Legal & compliance | 75,000 | 7.5% | Entity setup (US + SI), counsel, DPA, T&C reviews, TM filings, CSAM/GDPR |
| Marketing & PR | 280,000 | 28% | Pre-launch teaser, SI launch microsite, paid acquisition for first 100k users, press kit refresh |
| Product / design | 40,000 | 4% | Brand evolution, illustration, motion |
| Operating buffer | 95,000 | 9.5% | 18-month runway protection |
| Founders' modest stipend (Paul + Joze) | 40,000 | 4% | Tax-efficient, optional |
| **Total** | **1,000,000** | **100%** | |

This is the same shape that's in the `Capital Plan` tab of the tracker but reorganized as use-of-funds for the deck.

---

## 5. Investor target seed (full list in B-014)

The list below is a **starter** — B-014 will harden each entry with intro path, ticket, and last-known fund signal.

**Slovenia / EU angels (top 7)**
1. **Ivo Boscarol** — exit Pipistrel; aviation/SI patriotism angle; lead candidate
2. **Andraž Tori** — Zemanta co-founder; comms + adtech relevance
3. **Marko Suhadolnik** — SI Business Angels Network
4. **Sandi Češko** — Studio Moderna founder; B2C scale
5. **Dušan Olaj** — Duol; deep-pocket SI builder
6. **Martin Frey** — TabTrader; mobile-app distribution angle
7. **Jure Nemec** — Bitstamp early team; fintech/VAP relevance

**US angels / micro-VCs (top 7)**
1. **Hunter Walk** — Homebrew; consumer/comms thesis
2. **Naval Ravikant** — AngelList; long-tail consumer
3. **Charles Hudson** — Precursor Ventures
4. **Susa Ventures** (Eva Ho)
5. **Ben Ling** — Bling Capital; consumer
6. **Nikhyl Singhal** — Friends&Family; ex-Meta product
7. **Lattice Ventures**

**Strategic / corporate (top 7)**
1. **Telekom Slovenije** — SI carrier; SMS + mobile launch partner
2. **Iskratel** — comms/legacy SI brand
3. **Outfit7** (Talking Tom — Slovenian!) — consumer mobile expertise
4. **Ericsson Ventures** — telco/messaging
5. **Wise Ventures** — fintech adjacency for VAP
6. **Mastercard Start Path** — direct VAP relevance Phase 3
7. **EU Innovation Fund** — non-dilutive grant track

The sequencing: Boscarol week of 2026-06-01; SI parallel asks 2026-06-08; US warm intros 2026-06-15.

---

## 6. Definition of "Customer-ready" (preview of B-016)

Customer-ready (G2 above) = ALL of the following true on the production environment:

**Functional bar**
- Phone signup (US +1, SI +386, plus full ITU list) works end-to-end with OTP
- A new user can add up to 7 contacts and exchange 70-word messages
- Server-side enforcement of all 5 Rule-of-7 caps verified by integration tests
- E2E encryption in place; safety-number verification works
- Voice + video clips ≤70s upload + play
- Push notifications fire within 5s p95

**Trust bar**
- Terms, Privacy, Cookie banner, 16+ age gate live and consistent
- Report-message, block, account-suspension flows operational
- CSAM/NCMEC hash-matching live
- Data-export ZIP and account hard-delete both functional
- `info@copyme1.com` is the live, monitored contact channel

**Ops bar**
- Uptime ≥99.5% measured over the prior 7 days
- p95 signup latency <600ms; p95 send <250ms
- Sentry receiving releases; synthetic monitor green; status page public
- 1k → 10k k6 load test passed in staging
- DR drill executed within last 30 days

**Regional bar**
- Open: US, SI, all EU/UK
- Gated: jurisdictions on OFAC list and any country requiring a local data-protection authority registration we don't yet hold

**Sign-off matrix**
- Paul Pereira ✓ · Jože Kralj ✓ · Outside counsel (US) ✓ · Outside counsel (SI/EU) ✓

---

## 7. What I need from Joze to keep the timeline

To hold the **2026-06-02 G2** date, the following blockers need clearing this week:

1. **Confirm `copyme1.com` is registered** (or authorize me to register it for €15/yr).
2. **Confirm the email policy** — alias-only forwarder, or a real Google Workspace mailbox? (Workspace = €5/user/month; allows DKIM signing.)
3. **Sign off on the hero correction in S-010** — confirm "Communication That Matters" stays as H1, "Your World's chart of Communication" as H2.
4. **Confirm the Slovenia-side counsel** for entity setup (B-003); name and engagement letter timing.
5. **Approve the Boscarol intro script** before B-009 fires — Slovenian-language wording, ~150 words.

Reply on any of these with a one-line ✓ / change request and we keep moving.

---

*This correction plan is the source of truth for Feedback 3. The master `SPRINT_PLAN.md` and `sprint_tracker.xlsx` have been updated to incorporate every item above.*
