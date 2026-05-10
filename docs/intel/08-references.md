# 08 — References

The full source-doc index + live links + cross-references.

## Source documents (read into this pack)

All files live in `/Users/paulpereira/Desktop/CopyMe/`.

| File | Date | Length | Used in |
|---|---|---:|---|
| `feedback.docx` | April 2026 | 1.8K | `06-feedback-trail.md` |
| `2. feedback.docx` | 2026-05-07 | 9.5K | `06-feedback-trail.md`, `00-README.md` |
| `Feeedback 3.docx` | 2026-05-09 | 7.3K | `06-feedback-trail.md`, hero correction |
| `CpM_Developer_Specification.docx` | 2026-04-04 | 25.3K | `01`, `02`, `04` (pricing tables) |
| `CopyMe_Architecture_Review_23Apr2026.docx` | 2026-04-23 | 27.8K | `02-architecture-snapshot.md` |
| `CopyMe_Development_Plan 21 Apr 26.docx` | 2026-04-21 | 8.8K | `07-production-readiness.md`, sprint cadence |
| `Production model instructions.docx` | 2026-04-04 | 2.1K | `07-production-readiness.md`, gap analysis |
| `CopyMe_Full_Competitive_Analysis.docx` | April 2026 | 21.6K | `03-competitive-analysis.md`, `05-viability-assessment.md` |
| `CopyMe_Market_Analysis.docx` | April 2026 | 10.2K | `04-market-and-revenue.md` |
| `CopyMe_Revised_100M_Assessment.docx` | April 2026 | 17.1K | `05-viability-assessment.md`, B2B routing |
| `CopyMe simple terms.docx` | April 2026 | 6.3K | `01-product-overview.md`, plain-English summary |
| `CopyMe Links.docx` | n/a | 0.4K | this file (live links below) |

The original `CopyMe.pdf` (829K) is the historical anchor and is not
re-summarized here — its content has flowed into all of the above.

## Live links (from `CopyMe Links.docx` + `2. feedback.docx`)

| Surface | URL |
|---|---|
| Landing | https://copyme-app.vercel.app/ |
| App | https://copyme-app.vercel.app/app |
| Pricing | https://copyme-app.vercel.app/pricing |
| Business | https://copyme-app.vercel.app/business |
| Self-serve ad creator | https://copyme-app.vercel.app/business/ads |
| Press kit | https://copyme-app.vercel.app/press |
| Privacy | https://copyme-app.vercel.app/privacy |
| Terms | https://copyme-app.vercel.app/terms |
| Investor data room (public) | https://copyme-app.vercel.app/pitch |
| Raw metrics JSON | https://copyme-app.vercel.app/api/pitch/metrics |
| 30-day daily series JSON | https://copyme-app.vercel.app/api/pitch/export |
| OG social preview | https://copyme-app.vercel.app/opengraph-image |
| Logo | https://copyme-app.vercel.app/icon.svg |
| Robots | https://copyme-app.vercel.app/robots.txt |
| Sitemap | https://copyme-app.vercel.app/sitemap.xml |
| GitHub | https://github.com/interactiveintel/copyme-app |
| v1.0.0 release | https://github.com/interactiveintel/copyme-app/releases/tag/v1.0.0 |
| Vercel project | https://vercel.com/interactiveintel-1940s-projects/copyme-app |

**Latest tag (per `2. feedback.docx`):** v4.1.3 — animated Hero phone preview.

**Contact (per Feedback 3 / S-009):** info@copyme1.com (replacing the
original interactiveintel@gmail.com across user-facing surfaces).

## Companion docs in this repo (cross-references)

### Plan + tracker
* `COPYME_SPRINT_PLAN.md` — master plan, 161 sprints across Sprint 0 + Phase 1 + Phase 2 + Phase 3 + Business
* `copyme_sprint_tracker.xlsx` — live status board with per-sprint owner, status, completed-on, notes
* `FEEDBACK_3_CORRECTION_PLAN.md` — the 2026-05-09 correction to S-001 + new sprints (S-009, S-010, B-013–B-016)

### Architecture + design
* `copyme-app/docs/architecture/2026-05-encryption-protocol.md` — Signal Protocol decision + key plan
* `copyme-app/docs/regulatory/baas-shortlist.md` — 8 BaaS partners (EU + US) for Phase 3
* `copyme-app/docs/regulatory/kyc-aml-sca.md` — Sumsub + sanctions + PSD2/SCA design
* `copyme-app/docs/mobile/capacitor.md` — Capacitor wrapper recipe
* `copyme-app/docs/mobile/appstore.md` + `playstore.md` — store metadata templates
* `design/logo-explorations/README.md` — globe-with-figure variants for Jože to pick

### Operations
* `copyme-app/docs/ops/dr.md` — disaster recovery runbook + drill log
* `copyme-app/docs/launch/checklist.md` — full G2 sign-off matrix
* `copyme-app/docs/launch/beta-cohort.md` — 70-user beta plan
* `copyme-app/docs/launch/launch-day.md` — G3 day-of runbook
* `copyme-app/docs/launch/si-microsite.md` — S-255 SI launch coordination
* `copyme-app/docs/launch/vap-launch.md` — Phase 3 closed beta plan
* `copyme-app/docs/outreach/press-kit-distribution.md` — 7 SI + 7 US + 2 podcasts
* `copyme-app/docs/qa/2026-05-launch-readiness/S-008-status.md` — cross-device test unblock checklist
* `copyme-app/docs/transparency/2026-Q3-template.md` — first transparency report template

### Business + investor
* `copyme-app/docs/business/B-001-entity-decision.md` — Delaware C-corp + SI d.o.o.
* `copyme-app/docs/business/B-002-cap-table.md` — 50/50 founders + 10% ESOP
* `copyme-app/docs/business/B-003-counsel.md` — US + SI counsel shortlist
* `copyme-app/docs/business/B-004-ip-assignment.md` — IP assignment template
* `copyme-app/docs/business/B-005-trademarks.md` — trademark search + filing matrix
* `copyme-app/docs/business/B-006-angel-terms.md` — SAFE @ €10M cap + priced @ €8M pre
* `copyme-app/docs/dataroom/index.md` — investor data room index
* `copyme-app/docs/business/B-008-deck-v2.md` — 12-slide investor deck outline
* `copyme-app/docs/business/B-009-boscarol-outreach.md` — Boscarol paths + script
* `copyme-app/docs/business/B-010-angel-target-list.md` — 14-name angel shortlist
* `copyme-app/docs/business/B-011-capital-plan.md` — €1M / 18-month runway
* `copyme-app/docs/business/B-012-close.md` — closing runbook
* `copyme-app/docs/business/B-013-use-of-proceeds.md` — €1M per-line breakdown
* `copyme-app/docs/business/B-014-extended-investor-list.md` — 25-name extended angel list
* `copyme-app/docs/business/B-015-timeline-for-joze.md` — communique to Jože
* `copyme-app/docs/business/B-016-customer-ready-gate.md` — G2 definition

## How to keep this pack fresh

When a new docx is added to `/Users/paulpereira/Desktop/CopyMe/`, re-read it
and update the relevant report. The cadence is event-driven, not periodic
— most updates will be after a new founder feedback round (Feedback 4, 5,
…) or a major external doc (legal opinion, partner term sheet,
investor diligence questionnaire).

**Suggested update cadence:**
* After each new feedback round → update `06-feedback-trail.md`.
* After each architecture review → update `02-architecture-snapshot.md`.
* After each sprint phase completes → update `07-production-readiness.md`.
* Otherwise leave the rest as a stable reference.

## Provenance

This intel pack was synthesized 2026-05-10 by reading every source doc in
the project root, cross-checking against the current state of the
`copyme-app` repo (post-Sprint 0 + Phase 1 work landed), and the live
sprint tracker. Where a claim depends on a specific number or behavior, the
source is named in-text. Where two source docs disagree (e.g., the original
$500M analysis vs the revised $100M analysis), both are cited and the
later one is treated as canonical.
