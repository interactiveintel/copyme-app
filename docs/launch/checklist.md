# Phase 1 launch checklist (S-192)

**Day-of owner:** Paul + Jože · war-room rotation
**Cut-over moment:** when `COPYME_PUBLIC_LAUNCH=1` flips in Vercel.

Each box must be checked + signed before the cut-over.

## Legal

- [ ] Terms current and merged (S-156). Last reviewed: ___
- [ ] Privacy current and references Yogi subprocessor (S-155).
- [ ] Cookie consent banner live in EU (S-157).
- [ ] EU 14-day cancellation flow live (S-244 — defer if Phase 1 free-only).
- [ ] Trademark filings receipts in data room (B-005).
- [ ] IP assignments signed (B-004).

## Security

- [ ] No `console.log` of phone, email, OTP, or token. (`grep`-clean.)
- [ ] Sentry catches a synthetic error in production (S-182).
- [ ] CSP headers shipped on landing + app shell (S-181).
- [ ] Rate limits exercised on /api/auth/phone/send (S-103).
- [ ] CSAM hash list URL configured for production (S-173).
- [ ] DR drill executed at least once (S-185 / `docs/ops/dr.md`).

## Accessibility

- [ ] Lighthouse a11y ≥ 95 on `/`, `/signup`, `/app` (mobile + desktop).
- [ ] Keyboard nav: signup flow completable without a mouse.
- [ ] Screen-reader test on `/` hero, navbar, composer.
- [ ] Reduced-motion respected by Hero / Inbox animations.

## Performance

- [ ] Landing LCP p75 < 2.5s (S-183).
- [ ] First message round-trip p95 < 600ms in load test (S-188).
- [ ] OG image renders in < 1s under cold start.

## Trust & safety

- [ ] Report flow round-trip verified (S-171).
- [ ] Block flow round-trip verified (S-172).
- [ ] Suspension flow round-trip verified (S-175).
- [ ] First placeholder transparency report rendered (S-176).

## Mobile

- [ ] PWA Lighthouse score 100 (S-161).
- [ ] iOS install overlay verified on iPhone (S-162).
- [ ] Capacitor build green for iOS + Android (S-163).
- [ ] App Store + Play Store listings drafted (S-164 / S-165).

## Sign-off

| Area | Owner | Signed |
| --- | --- | --- |
| Legal | Paul + Jože + counsel | ___ |
| Security | Paul | ___ |
| Accessibility | Jože | ___ |
| Performance | Paul | ___ |
| Trust & safety | Paul + Jože | ___ |
| Mobile | Paul | ___ |
| Brand / copy | Jože | ___ |
