# Phase 1 LAUNCH day runbook (S-194)

## T-2 days

* All sprints in 1.10 green per `checklist.md`.
* Beta cohort (S-191) sign-ups complete.
* Press embargo notes confirm receipt (S-193).

## T-day

| Time (UTC) | Action | Owner |
| --- | --- | --- |
| 06:00 | Status page green check | Paul |
| 07:00 | Final synthetic monitor pass | Paul |
| 08:00 | Embargo lifts; press goes out | Jože |
| 08:05 | Flip `COPYME_PUBLIC_LAUNCH=1` (Vercel env) | Paul |
| 08:10 | Landing CTA → free signup (verify) | Jože |
| 08:15 | Send launch email to beta cohort | Paul |
| 08:30 | Tweet thread + LinkedIn post | Both |
| 09:00–17:00 | Rotate war-room (Paul ↔ Jože) | Both |
| Hourly | Sentry triage + status page nudge | On-call |
| 17:00 | Day-1 summary post + thank-yous | Both |

## War-room channels

* Slack: `#copyme-launch` (Paul + Jože + Claude)
* Phone tree: Paul → Jože → fallback (counsel)
* Status page: status.copyme1.com

## Roll-back trigger

If any of the following persists for > 15 min:
* Synthetic monitor red on landing OR signup OR send-message.
* Sentry error rate > 1% of requests.
* DAU drop > 50% vs baseline (impossibly noisy on launch day — use eyeball
  judgment).

… execute `vercel rollback` to the pre-launch deploy and post a status
update before any further investigation.

## Day-after

* Post-mortem within 24h, even if launch goes clean.
* Update transparency-report scaffold (S-176) with launch-day numbers.
* Schedule the next sprint (Phase 2.1 Yogi shell — S-201).
