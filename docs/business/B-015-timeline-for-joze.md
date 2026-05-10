# Timeline-to-launch communique for Jože (B-015)

**Date:** 2026-05-10
**From:** Paul + Claude
**To:** Jože Kralj
**Subject:** Where we are, where we're going, what I need from you

---

Hi Jože —

Quick state-of-the-union since your 2026-05-07 feedback round:

## What's done (last 24 hours)

Sprint 0 (your 2026-05-07 edits) is fully landed:
* Hero now reads exactly your phrasing.
* Rule-of-7 numerics moved off the landing into Terms §3 with a back-link.
* Suspension wording fixed in T&Cs.
* Logo cleaned (no more "Rule of 7" subscript); two globe-with-figure
  variants for you to pick at `design/logo-explorations/README.md`.
* +386 country code wired into the phone module with 14 passing tests.

Phase 1 (full Year-1 communication core) is also scaffolded — 60 sprints
of code + docs across auth, Rule-of-7 enforcement, inbox/composer,
voice/video, encryption (Signal Protocol decision doc), public pages,
mobile packaging, trust & safety, observability, and launch gating.

Phase 2 (Yogi + ads + paid tiers) and Phase 3 (Value Account Pay) are
scaffolded as decision docs + APIs + lib stubs, with regulator-gated
items honestly marked blocked.

Business workstream (B-001..B-014) — entity, cap table, counsel, IP,
trademarks, term sheet options (SAFE @ €10M cap or priced @ €8M pre),
data room index, deck v2 outline, Boscarol outreach plan, capital plan,
extended angel list — all drafted and waiting on your sign-off.

## What I need from you in the next 7 days

1. **Pick a logo variant** (5 min): open
   `design/logo-explorations/README.md`, look at the two SVGs, and tell
   me A or B. We then port the winner into `public/icon.svg`.
2. **Cross-device test on your iPhone** (S-008, 30 min): once we have a
   real SMS provider key (Twilio sandbox is enough), I'll send you a
   test link. We try +386 ↔ +1 sign-up + a 70-word boundary message.
3. **Confirm the entity decision** (B-001, 15 min over a call):
   Delaware C-corp + SI d.o.o. — yes/no. Once you confirm, counsel
   engages.
4. **Approve the SAFE-vs-priced angel terms** (B-006, 30 min): I have a
   default recommendation (SAFE @ €10M cap), happy to defer to your
   read.
5. **Boscarol outreach** (B-009): which Pimdom path do we use first?

## Launch target

If we keep this cadence, Phase 1 LAUNCH (S-194) lands within 6 weeks
once we close on legal entity + first angel commitment. The full sprint
plan is `COPYME_SPRINT_PLAN.md`; live status in
`copyme_sprint_tracker.xlsx`.

Yours,
Paul (with Claude)
