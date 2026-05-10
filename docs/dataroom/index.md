# Investor data room — index (B-007)

**Mirror of:** the public `/pitch` surface + NDA-gated extras.
**Tooling:** Notion or DocSend (Notion preferred for inline + comments).
**Access:** named-link per investor; audit log retained.

## Public (also at /pitch)

| Section | Where it lives in /pitch |
| --- | --- |
| Live DAU/WAU/MAU | `/pitch` top metrics |
| Funnel (signup → first message → 7-day return) | `/pitch` retention chart |
| Yogi cost-per-DAU | `/pitch` cost panel |
| Ad revenue (current run-rate) | `/pitch` revenue panel |
| Press kit | `/press` |

## NDA-gated

| Section | Source file |
| --- | --- |
| Cap table | `docs/business/B-002-cap-table.md` |
| Term sheet options | `docs/business/B-006-angel-terms.md` |
| Capital plan | `docs/business/B-011-capital-plan.md` |
| Counsel engagement letters | (not in repo; physical copies) |
| IP assignments (signed) | (not in repo; physical copies) |
| Trademark filings | `docs/business/B-005-trademarks.md` |
| Board minutes | (none yet — pre-incorp) |
| Founder agreements | (not in repo; physical copies) |
| Detailed engineering roadmap | `COPYME_SPRINT_PLAN.md` |
| Sprint tracker (live) | `copyme_sprint_tracker.xlsx` |

## NDA template

Standard mutual NDA, 2-year term, no carve-outs other than statutory
disclosure. Enforced by US (DE) law for US investors, SI law for EU.

## Hygiene

* **Per-investor watermark** on every PDF.
* **DocSend disabled-download mode** for cap table + term sheet.
* **Access log** reviewed weekly during the raise.
* **Rotate access** after close (B-012).
