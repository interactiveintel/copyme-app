# CopyMe — Intel Pack

**Audience:** CopyMe (CCop) founders + Claude Code + investor diligence
**Owners:** Paul Pereira (US) · Jože Kralj (SI)
**Last sync:** 2026-05-10 · sources read into this pack: 12 documents (April 4 → May 9, 2026)

This folder is a **synthesis** of every reference document in the project root
(`/Users/paulpereira/Desktop/CopyMe/*.docx`), collapsed into the smallest set
of canonical reports a new contributor or investor can read end-to-end in
under an hour. Each report attributes its load-bearing claims back to the
source doc.

## How to use this pack

* **New to the project?** Read in order: `01` → `02` → `03` → `04` → `05`.
* **Investor diligence?** Read `00` (this index) → `04` → `05` → `06` → `07`.
* **Engineering only?** Read `02` → `07`, then `COPYME_SPRINT_PLAN.md`.
* **Looking for the latest founder asks?** Read `06`.

## Reports

| # | File | What it covers |
|---|---|---|
| 00 | [README.md](README.md) (this file) | Index + executive summary + how to use |
| 01 | [01-product-overview.md](01-product-overview.md) | What CopyMe is in plain English. Rule of 7. Three-phase roadmap. |
| 02 | [02-architecture-snapshot.md](02-architecture-snapshot.md) | Tech stack, data model, API surface, what's shipped vs. scaffolded. |
| 03 | [03-competitive-analysis.md](03-competitive-analysis.md) | Global messaging landscape. Where CopyMe wins / where it doesn't. |
| 04 | [04-market-and-revenue.md](04-market-and-revenue.md) | Market sizing, revenue streams, projections, comparables. |
| 05 | [05-viability-assessment.md](05-viability-assessment.md) | $100M target. 3 routes (B2B / Niche / Hybrid). Probability + capital needed. |
| 06 | [06-feedback-trail.md](06-feedback-trail.md) | Feedback 1 (Apr 2026) → 2 (May 7) → 3 (May 9). What's done, what's pending. |
| 07 | [07-production-readiness.md](07-production-readiness.md) | Gap analysis vs the spec. Maps to Phase 1 sprints. |
| 08 | [08-references.md](08-references.md) | Live links + index of every source document. |
| 09 | [09-next-steps.md](09-next-steps.md) | **Operational checklist** — A (founder unblocks) / B (provider keys) / C (real eng work) / D (validation) / E (business gates). Critical path to G3. |

## Executive summary (read me first)

**What:** CopyMe is a phone-first messaging app that enforces a **constraint
system called "Rule of 7"** — 70-word messages, 7 active contacts, last 7
messages retained, 70-second voice/video, 7 interest slots. The constraint
is the product. (Source: `CpM_Developer_Specification.docx` §1, `feedback*.docx`)

**Why now:** Documented "communication overload" (120+ msgs/day per
professional), digital-wellness movement (BeReal proved appetite), and the
absence of any Western "super app" combining communication + AI discovery +
payments. (Source: `CopyMe_Full_Competitive_Analysis.docx` §3)

**Status (2026-05-10):**
- Production app live at https://copyme1.com (tag v4.1.3 baseline)
- All Sprint 0 + Phase 1 sprints scaffolded (per `COPYME_SPRINT_PLAN.md`)
- Auth, Rule-of-7 enforcement, Yogi AI, ads marketplace, Stripe — live or
  scaffolded
- Phase 2 + Phase 3 sprints scaffolded as code/docs; regulator-gated items
  (KYC, EMI license, BaaS partner) honestly marked blocked

**Three roads to $100M valuation** (per `CopyMe_Revised_100M_Assessment.docx`):

| Route | Capital | Time | Probability |
|---|---|---|---|
| **A — B2B Enterprise (recommended)** | €2–10M | 3–4 yrs | **35–45%** |
| B — Niche Community | €3–15M | 3–5 yrs | 25–35% |
| C — Hybrid (consumer + B2B + early payments) | €8–25M | 3–6 yrs | 20–30% |
| Original "global super app" plan | €50–300M+ | 5+ yrs | 2–5% |

**Funding ask:** €1M angel round. SAFE @ €10M post-money cap, 20% discount
(default) or priced @ €8M pre (alternative). Lead candidate: **Ivo Boscarol**
(Slovenia, Pipistrel exit). 21-name diversified target list in
`docs/business/B-014-extended-investor-list.md`. (Source: `feedback.docx`,
`Feeedback 3.docx` + B-006 / B-009 / B-014)

**Critical gates** (per `B-016`):
1. **G0 — Founder feedback closed:** Sprint 0 + Feedback 3 corrections shipped (target: 2026-05-12)
2. **G1 — Phase 1 core complete:** Auth + Rule-of-7 + messaging working in staging (target: 2026-05-22)
3. **G2 — Customer-ready:** Mobile builds, T&S, observability, k6 passed; 70-user beta opens (target: 2026-06-02)
4. **G3 — Public launch:** 7-day beta soak, status green, press embargo lifts (target: 2026-06-09)

**Top three risks** (synthesized across all docs):
1. **Cold-start in messaging.** Network effects favor incumbents (3B WhatsApp). Mitigation: B2B-first (Route A) sidesteps this — companies mandate adoption top-down.
2. **Rule of 7 unvalidated at scale.** BeReal proved appetite for constraint then lost 60% of users. Mitigation: enterprise framing where constraint = productivity feature.
3. **Capital + regulatory drag of Phase 3 (VAP).** Revolut spent decade + billions on equivalent. Mitigation: defer Phase 3 until $100M reached from Phase 1+2; pursue from strength, not speculation.

## What this pack is NOT

* **Not a replacement for source docs** — every `.docx` in the project root
  remains the official record. This pack is a navigable summary.
* **Not a sprint plan** — sprint detail lives in `COPYME_SPRINT_PLAN.md` +
  `copyme_sprint_tracker.xlsx`. This pack is the strategic context that
  surrounds the sprints.
* **Not a pitch deck** — `docs/business/B-008-deck-v2.md` outlines the
  pitch; this pack provides the underlying evidence.
