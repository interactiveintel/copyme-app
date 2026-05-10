# 06 — Feedback Trail (Jože Kralj → Paul Pereira)

**Source synthesis:** `feedback.docx` (April 2026), `2. feedback.docx` (May 7, 2026), `Feeedback 3.docx` (May 9, 2026), `FEEDBACK_3_CORRECTION_PLAN.md` (May 10, 2026).

The chronological record of founder feedback, what each round asked for,
and what's been done about it. Pair with `copyme_sprint_tracker.xlsx` and
`COPYME_SPRINT_PLAN.md` for sprint-level status.

## Feedback 1 — April 2026 (`feedback.docx`)

The original strategic feedback. Four asks, all still operative as
threads through the program:

| # | Ask | Resolution |
|---|---|---|
| 1 | **Production-Ready App.** Define the launch point where real users can register, try, and enjoy the app. | Spec'd as **G2 (Customer-ready)** in `docs/business/B-016-customer-ready-gate.md`. Target date 2026-06-02. |
| 2 | **Real Cost Assessment.** Investment proposal covering post-launch phases. | `docs/business/B-011-capital-plan.md` + `B-013-use-of-proceeds.md` — €1M / 18mo runway, milestone-gated spend. |
| 3 | **Financial Investor(s).** Startup / business-angel model. SI candidate: Ivo Boscarol. Define what we offer for €1M. | `B-006-angel-terms.md` (SAFE @ €10M cap or priced @ €8M pre) + `B-009-boscarol-outreach.md` + `B-010-angel-target-list.md` (14 names). |
| 4 | **Target Hybrid: B2B + Customers.** Decisions on legal entity (50/50 Paul/Jože board), launch timeline, investor offer. | `B-001-entity-decision.md` (Delaware C-corp + SI d.o.o.) + `B-002-cap-table.md` (50/50 founders + 10% ESOP) + master timeline in `FEEDBACK_3_CORRECTION_PLAN.md` §3. |

## Feedback 2 — 2026-05-07 (`2. feedback.docx`)

Specific edits to the live page + a reaffirmation of the strategic asks.

### Concrete edits

| # | Ask | Sprint | Status |
|---|---|---|---|
| 1 | Hero: "Communication That Matters" with **Copies struck** | **S-001** | Done (corrected per Feedback 3 — see below) |
| 2 | New subhead: "Rule of 7 — A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact." | **S-002** | Done |
| 3 | Move Rule-of-7 mechanics off landing → into Terms §3 | **S-003** | Done (anchor `/terms#rule-of-7`) |
| 4 | T&C "At a glance": rephrase suspension wording from "We can suspend …" to "Accounts that break these rules may be suspended" + fix "suspened" typo | **S-004** | Done |
| 5 | Logo refinement — keep mark, **drop "Rule of 7" subscript** | **S-005** | Done; legacy mark archived to `public/legacy-icon.svg` |
| 6 | Logo variant: globe-with-figure exploration per original paper sketch | **S-006** | Done — 2 SVG variants + 2 OG previews in `design/logo-explorations/` |
| 7 | Add country code **+386 (Slovenia)** to phone-verification flow | **S-007** | Done — `lib/phone/{countries,validate}.ts` + `PhoneInput.tsx`; 14 tests pass |
| 8 | Validate the polished landing on phones for both Paul and Jože | **S-008** | **Blocked** — needs physical phones + S-103 OTP backend deployed |

### Strategic reaffirmation (carried over from Feedback 1)

* Production-ready app definition.
* Initial launching plan.
* Hybrid B2B + Customer rationale.
* Investment proposal (presentation).
* Boscarol candidate (SI).
* Entity 50/50 (Paul + Jože).

## Feedback 3 — 2026-05-09 (`Feeedback 3.docx`)

The course-correction round. **Critical re-reading of Feedback 2.**

### The headline correction

> **S-001 was wrong.** The earlier read of Feedback 2 had me removing
> "Communication That Matters" from the hero. Re-reading Feedback 2 against
> Feedback 3 makes clear: only the word **"Copies"** was struck.
> "Communication That Matters" was always meant to **stay as the H1**, with
> "Your World's chart of Communication" as a **second-tier H2 below it**.
> *(Source: `FEEDBACK_3_CORRECTION_PLAN.md` §1.3, applied 2026-05-10.)*

**Resulting hero structure (live in `Hero.tsx`):**

| Level | Text |
|---|---|
| H1 | "Communication That **Matters**" (with "Matters" in the gradient) |
| H2 | "Your World's chart of Communication." |
| Subhead `<p>` | "Rule of 7 — A revolutionary constraint system that replaces noise with meaning. Less is more, giving meaning to messages. Infinite impact." |

### Genuinely new asks in Feedback 3

| # | Ask | Sprint | Status |
|---|---|---|---|
| A | Contact email migration: `interactiveintel@gmail.com` → `info@copyme1.com` everywhere | **S-009** | Done — 5 user-facing pages updated; DNS / Workspace setup pending operationally |
| B | Hero correction: keep "Communication That Matters" as primary | **S-010** | Done — applied 2026-05-10 |
| C | Search for additional investor targets; provide list | **B-014** | Done — 14 names (7 SI/EU + 7 US); extended to 25 across 3 tiers in `B-014-extended-investor-list.md` |
| D | Establish time estimation when app is technically ready; written definition of customer-apply gate | **B-015 + B-016** | Done — `B-015-timeline-for-joze.md` + `B-016-customer-ready-gate.md` |
| E | Show use of proceeds for €1M | **B-013** | Done — `B-013-use-of-proceeds.md` |

### Open asks Jože raised (operational, need a one-line ✓)

From `FEEDBACK_3_CORRECTION_PLAN.md` §7 — these are the **5 unblocking
items needed this week** to hold the 2026-06-02 G2 date:

1. ⏳ Confirm `copyme1.com` is registered (or authorize Paul to register for €15/yr).
2. ⏳ Confirm email policy — alias-only forwarder, or a real Google Workspace mailbox (€5/user/mo, allows DKIM).
3. ✅ Sign off on the hero correction (S-010) — applied; Jože to confirm visually.
4. ⏳ Confirm Slovenia-side counsel name + engagement letter timing (B-003).
5. ⏳ Approve Boscarol intro script (Slovenian, ~150 words) before B-009 fires.

## Master timeline (from `FEEDBACK_3_CORRECTION_PLAN.md` §3)

| Gate | Date | Definition |
|---|---|---|
| **G0** — Joze's feedback closed | **Tue 2026-05-12 EOD** | Sprint 0 + Feedback-3 corrections shipped to production; Joze + Paul both can install the PWA on phones (US +1 / SI +386), exchange messages, validate Terms wording. |
| **G1** — Phase 1 core complete | **Fri 2026-05-22 EOD** | Auth + Rule-of-7 enforcement + Inbox/Composer + Voice/Video + E2E encryption all working in staging; internal alpha. |
| **G2** — Customer-ready | **Tue 2026-06-02 EOD** | Public pages polished, mobile packaging on TestFlight + Play Internal, Trust & Safety + Observability live, load test passed; **invite-only beta opens to 70 users.** |
| **G3** — Public launch | **Tue 2026-06-09 EOD** | 7-day beta soak passed (status green, no Sev-1), public flag flipped, press embargo lifts. |

## Investor track (parallel)

| Week of | Sprints | Outcome |
|---|---|---|
| 2026-05-11 | B-001 (entity), B-002 (cap table), B-003 (counsel) | Decisions captured; counsel engaged |
| 2026-05-18 | B-004 (IP), B-005 (TM), B-006 (€1M offer) | Term-sheet options drafted |
| 2026-05-25 | B-007 (data room), B-008 (deck v2), B-013 (use of proceeds), B-014 (target list) | Investor packet locked |
| 2026-06-01 | B-009 (Boscarol), B-010 (parallel angels) | First conversations begin |
| 2026-06-15 → 2026-06-30 | B-011 (capital plan refresh), B-012 (close) | Target close inside June |

## What remains genuinely open (for Jože's reply)

The shortest possible list of things waiting on a founder decision:

1. **Logo variant pick** — `design/logo-explorations/README.md` shows variant A and variant B; one tap.
2. **Domain `copyme1.com`** — confirm registered or authorize purchase.
3. **Email policy** — alias-only or full Google Workspace.
4. **SI counsel** — name (Senica / Schoenherr / Jadek & Pensa) + engagement timing.
5. **Boscarol script** — review / approve the SI script in `B-009`.
6. **SAFE vs Priced** — default recommendation is SAFE @ €10M cap; happy to defer to Jože's read.
7. **Cross-device test** — when SMS provider keys are wired (S-103), 30-min QA call to validate the full sign-up flow on Paul's +1 and Jože's +386.
