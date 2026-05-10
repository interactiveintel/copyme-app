# CopyMe Transparency Report — Q3 2026 (TEMPLATE)

**Reporting period:** 2026-07-01 → 2026-09-30
**Status:** placeholder · published 2026-10-15
**Contact:** interactiveintel@gmail.com

This is the first transparency report scaffold (S-176). Numbers below are
populated by the data pipeline at `/api/admin/transparency-export`; this
file is the public-facing template.

## 1. Account actions

| Metric | Q3 2026 | Q-over-Q |
| --- | ---: | ---: |
| Active accounts (peak DAU) | _TBD_ | — |
| Sign-ups | _TBD_ | — |
| Self-deletions | _TBD_ | — |
| Soft suspensions | _TBD_ | — |
| Hard suspensions | _TBD_ | — |

## 2. Content actions

| Trigger | Removed | Hidden | Edited |
| --- | ---: | ---: | ---: |
| Rule-of-7 word cap | _auto_ | — | — |
| Rule-of-7 media cap | _auto_ | — | — |
| Spam heuristics (S-174) | _TBD_ | _TBD_ | — |
| User reports (S-171) | _TBD_ | _TBD_ | — |
| Auto-moderation NSFW | _TBD_ | _TBD_ | — |
| Auto-moderation CSAM (S-173) | _TBD_ | — | — |

## 3. Government / law-enforcement requests

| Origin | Requests received | Responded | Data produced |
| --- | ---: | ---: | --- |
| US (federal) | 0 | 0 | none |
| US (state) | 0 | 0 | none |
| EU member states | 0 | 0 | none |
| Other | 0 | 0 | none |

## 4. NCMEC reports (CSAM)

| Action | Count |
| --- | ---: |
| Auto-detected hash matches | _auto_ |
| Reports filed with NCMEC | _auto_ |

## 5. Methodology

* Counts are pulled from production read replicas at end-of-quarter.
* "Suspensions" sums new `account_suspensions.startedAt` rows in the period.
* "Removals" sums Rule-of-7 cap-hit breadcrumbs from observability +
  moderator-actioned reports.
* All user identifiers are anonymized: this report is fully aggregate.

## 6. Notes

* Q3 2026 is the first quarter after public launch (S-194). Numbers will be
  small and possibly zero in some categories — that's expected.
* This template auto-fills via `npm run transparency:generate` (planned
  S-176 follow-up). For now the rendered HTML lives at
  `/transparency/2026-q3` and is gated behind an env flag until launch.
