# S-008 — Cross-device live test (US ↔ SI) — STATUS: BLOCKED

**Sprint:** Sprint 0 · S-008 · PROD
**Last updated:** 2026-05-09
**Owner:** Paul Pereira (US, +1) · Jože Kralj (SI, +386)

## What this sprint requires

Per `COPYME_SPRINT_PLAN.md` S-008 acceptance criteria:

1. Both numbers verify successfully via SMS OTP.
2. A 70-word boundary message and a 7-item media group succeed.
3. A 71-word message is blocked client-side and server-side.
4. Screenshots committed to `docs/qa/2026-05-launch-readiness/`.

## Why it is blocked

S-008 needs:

- **Two physical phones** (one US carrier, one SI carrier) — only Paul and Jože can run this; Claude Code cannot.
- **A live SMS sender** — depends on **S-103 (OTP backend)**, which is in Phase 1 and has not shipped. Today the auth surface uses email-password; there is no `sendOtp()` path wired to a real provider.
- **A deployed Vercel preview** that exposes the new phone-flow UI on the public URL.

## What is unblocked right now (closed by Sprint 0)

Sprint 0 has shipped the *building blocks* S-008 will exercise:

| Sprint | What landed |
| --- | --- |
| S-001…S-004 | Landing + Terms copy that the test phones will read on first open. |
| S-005 / S-006 | Cleaner mark; legacy mark preserved for press kit. Logo variants for review. |
| S-007 | `lib/phone/countries.ts` (SI pinned), `lib/phone/validate.ts` (E.164 + +386), `components/PhoneInput.tsx`, 14 unit tests passing (`npm run test:phone`). The number `+386 31 234 567` validates to `+38631234567`. |

## Unblock checklist (for whoever runs this next)

- [ ] **S-103** (OTP backend) merged. Twilio or fallback is sending SMS in dev.
- [ ] `PhoneInput` from S-007 wired into the sign-up screen (depends on **S-101**).
- [ ] Vercel preview URL shared between Paul + Jože.
- [ ] Both phones complete the OTP round-trip; record screenshots here.
- [ ] Boundary tests recorded:
    - 70-word message → ✅ accepted
    - 71-word message → ❌ rejected client-side AND ❌ rejected server-side
    - 7-item media group → ✅ accepted
    - 8-item media group → ❌ rejected
- [ ] Update `copyme_sprint_tracker.xlsx`: S-008 → `done`.

## Tracker entry

S-008 is recorded as `blocked` in `copyme_sprint_tracker.xlsx`. The blocker
notes point to S-103 (and transitively S-101) as the gating sprints.
