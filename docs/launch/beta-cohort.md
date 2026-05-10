# Beta cohort (S-191) — first 70 users

Curated invite list of 70 (Rule of 7 squared, naturally). The goal is a
seed of users who will give substantive feedback before the public flip.

## Targets (categories)

| Bucket | Count | Why |
| --- | ---: | --- |
| Slovenia (Pimdom network) | 21 | Jože's circle — frank feedback, +386 testing |
| US (InteractiveIntel) | 21 | Paul's circle — +1 testing, design feedback |
| Founders / operators | 14 | Build-in-public sounding board |
| Journalists (embargoed) | 7 | Pre-brief for launch coverage |
| Academic / privacy researchers | 7 | E2E + Rule-of-7 thesis review |

Total: 70.

## Invite mechanics

* Personal SMS + email from Paul or Jože (no automated mass blast).
* Invite link: `/signup?ref=beta70` — referral code grants 7 days of Pro
  preview when paid tiers ship (S-243).
* In-app banner thanks the cohort for the first 30 days post-launch.

## Conversion tracking

Analytics events in `lib/analytics.ts`:
- `beta_invite_sent` (manual log)
- `beta_invite_clicked` (referral source = `beta70`)
- `beta_signup_completed` (referral source = `beta70`)
- `beta_first_message_sent`

Conversion goal: ≥ 50/70 sign-up, ≥ 35/70 send a message in week 1.
