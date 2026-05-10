# VAP launch plan (S-341 → S-345)

## Closed beta cohort (S-341)

700 wallets — 10 × Rule of 7 squared. Whitelist enforced via the `vap`
feature flag (S-186). Cohort split:

* 350 SI users (Pimdom + early Phase 1 cohort)
* 250 US users (Paul's network)
* 100 EU "second wave" (DE/AT/HR mostly via referrals)

Inclusion criteria:
- Phase 1 active for ≥ 14 days
- Has completed at least one referral (S-246)
- Has consented to KYC handoff
- Lives in a region the BaaS partner supports

Pass/fail KPIs (Day 30):
- ≥ 70% of invitees complete KYC
- ≥ 50% of completed wallets do at least one P2P
- 0 unreviewed CSAM-grade fraud alerts
- < 1% partner SLA breaches

## Customer support (S-343)

Two CS agents trained before beta opens. Internal ticketing surface in
`/admin/vap/tickets` reads from the BaaS partner's webhook stream. Agents
NEVER see PAN; only last-4 + cardholder name + transaction history.

## Public launch (S-344)

Trigger when:
1. Beta KPIs all green for 2 consecutive weeks
2. Partner SLA met for 30 days
3. Fraud monitoring rules tuned (false-positive rate < 5%)

Cut-over flips `COPYME_VAP_PUBLIC=1` plus adds the `vap` flag to all
eligible regions in the partner's allowed list.

## Phase 3 retro + Series A (S-345)

90-day retro covers:
- Wallets opened, monthly active wallets, ARPU
- Card transaction volume by region + category
- Unit economics: cost per wallet vs revenue per wallet
- Fraud loss rate vs industry benchmark

Series A deck v2 (B-008 evolves into this) emphasizes:
- VAP TAM (€1B+ EU consumer wallets in addressable region)
- Yogi cost-per-DAU stability (S-208)
- Communication retention as the moat
