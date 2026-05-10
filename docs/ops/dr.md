# Disaster recovery runbook (S-185)

**Owner:** Paul Pereira
**Last drill:** _pending — schedule before launch (S-194)_
**RPO target:** 7 days (matches Rule-of-7 retention; we shouldn't need older)
**RTO target:** 4 hours (single-region restore)

## What is backed up

| Asset | Mechanism | Frequency | Retention |
| --- | --- | --- | --- |
| Postgres (Vercel/Neon) | Automatic continuous backups | Continuous | 7 days (Neon free) / 30 days (paid) |
| User-uploaded media | Vercel Blob storage | Replicated | Provider-managed |
| Sentry events | Sentry retention | n/a | 90 days |
| Stripe records | Stripe (post-S-243) | n/a | Stripe-managed |

CopyMe is intentionally low-state: messages prune to last-7-per-thread and
sessions/OTPs are short-lived. The blast radius of a DB loss is small.

## Restore procedure

1. **Detect** — synthetic monitor (S-184) reports two consecutive failures.
2. **Assess** — page on-call (rotation: Paul → Jože), check Sentry for the
   error pattern, check provider status pages (Vercel, Neon, Anthropic).
3. **Decide** — partial outage (Yogi down → degrade to text-only), full DB
   loss (proceed to step 4), full app down (proceed to step 5).
4. **DB restore** —
   ```bash
   # Neon
   neon branches create --parent main --name dr-$(date +%s)
   neon connection-string dr-$(date +%s)  # update DATABASE_URL in Vercel
   ```
   Then trigger a redeploy. RTO < 30 min on Neon's "Restore from point in
   time" UI.
5. **Full app down** — last-known-good Vercel deployment via
   `vercel rollback` against the previous production deploy ID. RTO < 5 min.
6. **Communicate** — status page banner (S-184), then a post-mortem email
   to all active users within 72h per Terms §11.

## Drill checklist

Run quarterly. Required to be green before S-194 launch.

- [ ] Spin a Neon branch from a 24h-old PITR point.
- [ ] Run a smoke test: sign up a synthetic user, send a message, retrieve.
- [ ] Roll back the Vercel deploy (preview-only).
- [ ] Verify synthetic monitor alerts fire on simulated outage.
- [ ] Document drill date here.

## Drill log

| Date | Outcome | RTO observed | Notes |
| --- | --- | --- | --- |
| _pending_ | _pending_ | _pending_ | First drill: schedule with S-194 |
