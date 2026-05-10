# 04 — Market & Revenue

**Source synthesis:** `CopyMe_Market_Analysis.docx`, `CpM_Developer_Specification.docx` §8 (pricing tables), `CopyMe simple terms.docx` "Revenue Potential", `CopyMe_Revised_100M_Assessment.docx` §2.

This report is the *go-to* for fundraising conversations and revenue
modeling. It pairs with `05-viability-assessment.md` (probability + capital
needed) and `B-013-use-of-proceeds.md` (where the €1M gets spent).

## 1. Market context

| Metric | 2025 | Forecast | CAGR |
|---|---|---|---|
| Global instant messaging market | $34.5B (a) / $128.2B (b) | $70.4B by 2034 (a) / $341.4B by 2030 (b) | 9.3% (a) / 21.5% (b) |
| Global super-app market | $121.9B | $838B by 2033 / $968.8B by 2033 | **27.3–30.1%** |
| WeChat alone (annual revenue) | ~$60B | — | benchmark |

(a) Per `CopyMe_Full_Competitive_Analysis.docx`. (b) Per `CopyMe_Market_Analysis.docx`. Discrepancy reflects different research sources; both confirm: **the addressable surface is massive and growing fast.**

## 2. Where CopyMe fits the demand curve

Three documented frustrations that CopyMe sits on top of:

1. **Communication overload.** 120+ messages/day per professional. Apple Screen Time, Google Digital Wellbeing, One Sec, Opal all demonstrate paying willingness for limit-tools. (Source: Full Competitive Analysis §5.)
2. **Discovery friction.** People-finding is fragmented across LinkedIn, Google, dating apps. CopyMe's structured profile (5-level location + 7 interest slots) creates a closed-loop discovery system. (Source: Market Analysis §3.)
3. **Fragmented mobile payments.** WeChat Pay + Alipay dominate Asia; the West has nothing equivalent. WhatsApp Pay limited to India/Brazil. (Source: simple terms / Market Analysis.)

## 3. Revenue streams (the four pillars)

CopyMe's revenue activates progressively across phases. Each source doc
emphasizes that Phase 1 = pure user acquisition; revenue starts in Phase 2.

### Phase 1 (Year 1) — Free communication core
* No direct revenue.
* Comparable user acquisition: $1–3/user in emerging markets, $3–8/user in
  developed markets.
* Target: 10–100M free users (per original spec) — but
  `CopyMe_Revised_100M_Assessment.docx` cuts this to **1–5M for the $100M
  valuation target.**

### Phase 2 (Year 2) — Three streams activate

| Stream | Price | Mechanic |
|---|---|---|
| **Business subscriptions** | $3 / $7 / $50 per 7 days (auto-renew) | Surveys, targeted outreach, AI search caps raised |
| **E-commerce campaigns** | $15K – $1M / year | Annual large-scale targeting (150K – 3.5M users / 6 mo) |
| **AD inbox (CPM-based)** | Auction-priced via second-price (S-234) | 7 active ads in user's AD inbox, refreshed every 7 hours |

### Phase 3 (Years 3–5) — Payment ecosystem

| Stream | Fee | Min |
|---|---|---|
| Internal VAP transfer (first 7/month) | **0%** | n/a |
| Internal VAP transfer (after 7/month) | 1% | $1 |
| Mediator transfer (external) | 1% | $10 |
| Receive via bank transfer | 0% | n/a |
| Receive via credit card | 1% | n/a |
| ATM withdrawal (VAP card) | 1.75% | $1 |
| ATM withdrawal (prepaid) | 2% | $2.50 |
| POS transactions | 0% | n/a |
| Virtual MasterCard (first) | Free | n/a |
| Virtual MasterCard (additional) | $3 one-time | n/a |
| Annual card fee | $10 | n/a |
| Currency change (after first) | $3 one-time | once / 6mo |
| Inactivity fee | $3 / 6mo | waived if ≥$10 txn |

### Phase 2 — full pricing tables (from spec §8)

**User tiers**

| Tier | Fee | Period | Survey cap | Contact cap |
|---|---|---|---|---|
| Basic Private | Free | n/a | None | 7 at once / 49 per week |
| Business Tier 1 | $3 / €3 | 7d auto-renew | 70 participants | 70 at once / 70 per week |
| Business Tier 2 | $7 / €7 | 7d auto-renew | 70 participants | 70 at once / 490 per week |
| Business Tier 3 | $50 / €50 | 7d auto-renew | 700 participants | 700 at once / 4,900 per week |

Tier 3 scales by 10× / 100× / 1000× multipliers for proportionally larger audiences.

**E-commerce annual tiers**

| Package | Annual | Target reach (7×) | Window |
|---|---|---|---|
| Starter | $15,000 | 7 × 150,000 | 6 months |
| Growth | $30,000 | 7 × 200,000 | 6 months |
| Scale | $50,000 | 7 × 300,000 | 6 months |
| Enterprise | $100,000 | 7 × 500,000 | 6 months |
| Premium | $500,000 | 7 × 1,500,000 | 6 months |
| Ultimate | $1,000,000 | 7 × 3,500,000 | 6 months |

## 4. Revenue projections (the canonical scenarios)

(Source: `CopyMe_Market_Analysis.docx` §4.3 + `simple terms.docx`.)

| Scenario | Year-2 users | B2B conversion | Est. annual revenue |
|---|---:|---:|---:|
| **Conservative** | 10M | 1% | **$15–30M** |
| **Moderate** | 50M | 2% | **$150–400M** |
| **Aggressive** | 100M | 3% + Phase 3 | **$500M – $1B+** |

**Important caveat from the revised assessment:** these scenarios assume
the original "global super-app" plan. The revised $100M strategy
(`05-viability-assessment.md`) achieves $100M at **1–5M users with
B2B-first revenue**, not 10–100M.

## 5. Comparables — what $100M looks like

| Company | Valuation at marker | Users | Revenue | Time |
|---|---|---|---|---|
| BeReal | €500M (sale) | 40M MAU | ~$30M/yr | 4 yrs |
| Discord (2015 era) | $500M | ~25M | ~$50M/yr | 3 yrs |
| Telegram (2018) | $500M+ raise | 200M | $0 (pre-rev) | 5 yrs |
| Slack (2015) | $500M | 1.1M DAU | ~$25M ARR | 2 yrs |

**Pattern:** companies that reached the $500M marker either had explosive
viral growth (Telegram), deep niche retention (Discord, Slack), or both.
None tried to be everything to everyone from day one.

## 6. Revenue math at $100M target (from revised assessment)

At standard SaaS / consumer-tech multiples, $100M valuation requires one of:

| Revenue model | Required ARR | Multiple | User base needed |
|---|---|---|---|
| **B2B SaaS** | $10–12.5M | 8–10× ARR | **50K–125K seats** |
| Consumer subscription | $15–20M | 5–7× ARR | 1–5M users |
| Hybrid (B2B + consumer) | $10–15M | 7–10× ARR | 25K seats + 500K users |
| Transaction fees (payments) | $20–25M | 4–5× revenue | 2–5M active users |

**Key insight:** at $100M, CopyMe does **not** need to be a global
messaging giant. **50K–125K enterprise seats or 1–5M engaged consumer users
is sufficient.** This is achievable in 3–4 years with the right wedge.

## 7. Highest-margin revenue: Phase 3 transactions

Per `CopyMe_Market_Analysis.docx` §4.3:

> "If CopyMe reaches 50M+ users and even 10% activate Value Account Pay,
> transaction fee revenue alone (at 1% per transfer) on modest average
> transactions could generate hundreds of millions annually."

This mirrors WeChat Pay → Tencent's fastest-growing segment. **However**,
per the revised assessment, Phase 3 is gated behind:
* €3–8M and 12–24 months of regulatory work (EMI license, PCI DSS).
* Dependence on a BaaS partner (Solaris / Modulr / Treezor / Marqeta — see `docs/regulatory/baas-shortlist.md`).
* Best pursued from a position of revenue strength, **not** speculation.

## 8. Critical success factors

(Distilled from Market Analysis §5.)

1. **Phase 1 user acquisition is everything.** Without the user base, Phase 2/3 revenue has no foundation.
2. **Market selection.** Launch where WhatsApp/Telegram are weakest — parts of Africa, Eastern Europe, US-niche communities.
3. **The constraint must feel empowering, not restrictive.** Marketing + UX framing is load-bearing.
4. **AI quality.** Yogi + smart-match must deliver genuinely useful results. Poor matching undermines the primary discovery monetization.
5. **B2B framing externally.** Per Route A — most capital-efficient path to $100M.

## 9. Risks (revenue-specific)

| Risk | Mitigation |
|---|---|
| Constraint kills retention (BeReal pattern) | Beta cohort (S-191) measures D7 ≥ 35% before scaling marketing |
| Yogi cost-per-DAU runs hot | S-204 budget guard + S-208 dashboard + per-tier daily token caps |
| Stripe sub conversion < 5% | Pro tier raises caps, not just adds features — clearer value prop than Slack-style "premium" |
| EMI license delay | Phase 3 deferred until $100M is reached without it; not on critical path |
| Ad inventory gluts (low fill) | Second-price auction (S-234) + 7-slot cap protects user UX even at low fill |

## 10. Funding ask

(Cross-references `B-006-angel-terms.md`, `B-011-capital-plan.md`, `B-013-use-of-proceeds.md`.)

* **€1M angel round.**
* Default: **SAFE @ €10M post-money cap, 20% discount, MFN.**
* Alternative: priced **Seed @ €8M pre, €1M new = 11.1% dilution.**
* **Use of proceeds**: 50.5% engineering, 33.5% marketing+PR, 13.7% infra, 2.9% legal+compliance.
* **Runway:** ~18 months from close → reach Phase 2 LIVE (S-247) with first €5K MRR before Series A conversation.

The €1M is **not** a bet on global super-app dominance — it's the seed for
**Route A (B2B-first)** with **Route B (niche community, SI/EU diaspora)**
running as a low-cost parallel growth channel.
