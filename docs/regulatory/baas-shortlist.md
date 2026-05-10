# BaaS / EMI partner shortlist (S-301)

**Status:** initial shortlist — no commitments. Owner: Paul + Jože + counsel.
**Decision target:** end of Q4 2026 (S-302).

## EU candidates

| Partner | Licence | Card-issuance | KYC support | Rough pricing | Lead time | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Solaris (DE)** | Full bank | ✅ MasterCard via FinTecSystems | Onfido + in-house | €0.50/account/mo + interchange | 4-6 months | Most mature; recent compliance scrutiny |
| **Modulr (UK + NL)** | EMI | 🟡 Apple/Google Pay first; cards via partner | Sumsub | £0.20/payment | 3-4 months | Strong B2B focus |
| **Treezor (FR, Société Générale)** | EMI | ✅ MasterCard | Onfido | €1/account/mo | 4-6 months | Group-backed; SEPA-strong |
| **Swan (FR)** | EMI | ✅ MasterCard | In-house | €0.30/transaction | 3-4 months | Best DX docs; scalable |
| **Fidor (DE, BPCE)** | Bank | ✅ | In-house | Custom | 6-9 months | Slower but bank licence |

## US candidates

| Partner | Licence | Card-issuance | KYC support | Rough pricing | Lead time | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| **Marqeta (via partner bank)** | n/a (issuer) | ✅ Visa + MasterCard | Sumsub | $0.40/transaction | 3-4 months | Most flexible; need a sponsor bank |
| **Lithic (via partner bank)** | n/a | ✅ MasterCard | Veriff | $0.30/transaction | 2-3 months | Fast onboarding; good API |
| **Synctera** | Sponsor-bank network | ✅ | Onfido + Persona | Custom | 4-6 months | Multi-bank failover |

## Decision criteria

1. **Geographic coverage** — must support SI, US, and ≥ 5 EU markets day-1.
2. **Settlement currency** — EUR + USD native; Stripe-style FX is acceptable.
3. **API quality** — webhook reliability, idempotency, sandbox parity.
4. **Compliance support** — does the partner help with PSD2/SCA (S-305) and AML?
5. **Pricing transparency** — flat per-transaction beats hidden interchange splits.
6. **Time-to-pilot** — Phase 3 closed beta (S-341) needs a working sandbox by Q1 2027.

## Next steps

- [ ] Counsel reviews term-sheet templates from each (S-302).
- [ ] Run a 30-minute discovery call with each EU partner (Paul + Jože).
- [ ] Decide and sign by end of Q4 2026.
