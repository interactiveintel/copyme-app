# Definition of "Customer-ready" gate (B-016)

The single objective bar that decides whether we open beyond the 70-user
beta cohort (S-191) and flip `COPYME_PUBLIC_LAUNCH=1`. If any of the
five conditions fails, we hold.

## The five conditions

1. **Reliability**
   Synthetic monitor (S-184) has been green for 7 consecutive days. No
   Sentry alerts above the alert threshold for 72h.

2. **Performance**
   Landing LCP p75 < 2.5s. First-message round-trip p95 < 600ms in the
   k6 load test (S-188) at 5,000 VU.

3. **Trust & safety**
   - Report flow round-tripped at least 7 times by beta users.
   - Block flow round-tripped at least 7 times.
   - 0 unreviewed CSAM-grade flags from the auto-mod pipeline.
   - First placeholder transparency report rendered (S-176).

4. **Legal**
   - Terms + Privacy reviewed by counsel and signed off.
   - Trademark filings receipts in the data room (B-005).
   - IP assignments signed (B-004).
   - Cookie consent banner live (S-157).

5. **Product**
   - Beta cohort retention D7 ≥ 35% (median across 70 invitees).
   - At least 7 reviews/quotes from the beta cohort (any sentiment) —
     this becomes raw material for press (S-193).
   - Cross-device test (S-008) green: Paul (+1) and Jože (+386) both
     completed a full sign-up + first message + 70-word boundary check.

## The gate ceremony

Sign-off requires both founders to mark each condition green in
`docs/launch/checklist.md`. No condition can be waived; if a condition
fails, we either ship a fix or we delay.

## What this is NOT

* **Not** a product-quality maximum — we'll keep shipping. It's the
  minimum bar to open the gates.
* **Not** a revenue gate — Phase 1 is free.
* **Not** the same as the Phase 2 launch gate — that's S-247 and adds
  payment + ad-marketplace conditions.
