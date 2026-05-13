# G2 Beta Cohort — Co-Founder Hand-Off Playbook

Status as of v4.12.3: gate is **enforcing** on copyme1.com, **70 single-use codes** are minted in production, and you have everything you need to invite the cohort.

This doc is everything you need to know. The codes themselves are in a separate file (see Step 0) — not in this repo.

---

## Step 0 — Get the codes

Paul will send you `g2-cohort-codes.txt` via **1Password / encrypted channel** (not Slack, not plain email). It's a 70-line text file, one `BETA-XXXXXXX` code per line.

**Treat it like a password.** Each code = one signup slot. If a code leaks, anyone who finds it can claim a beta seat ahead of an intended invitee. Burn-and-replace is annoying — store the file with `chmod 600` somewhere local-only.

If Paul didn't send it: ping him. Don't try to mint your own — that requires production DB access and there's no recovery if you mint a duplicate set.

---

## Step 1 — Pair codes with intended invitees

Open the codes file alongside a fresh sheet (Numbers / Sheets / Notion). One row per code:

| name | email | channel | code | sent_at | redeemed |
|---|---|---|---|---|---|
| Jane Doe | jane@… | personal email | BETA-MJZUJWP | | |

You don't have to fill `redeemed` — the DB tracks it. The other columns let you nudge people who haven't signed up after a week.

---

## Step 2 — Pick a delivery cut

For 70 invitees, a sensible split is:

- **10–15 personal sends** (your highest-intent contacts; people whose feedback you actually want). Use your real email or DM. These become product-feedback channels.
- **55–60 batched email** (broader cohort). One subject line, one template, vary only the recipient name + code.

Don't blast all 70 at once and call it done — the personal sends convert ~3× better and give you the bug reports you'll need before G3.

---

## Step 3 — Message template

Adapt per recipient. Keep it short.

**Subject:** `You're in the CopyMe beta`

```
Hey {first_name} —

CopyMe is the messaging app I've been building. It's invite-only this
month — here's your code:

    {BETA-XXXXXXX}

Sign up at https://copyme1.com/signup

What it is: messaging built around the Rule of 7 — every message is
capped at 70 words, you keep ≤7 active contacts, and Yogi (a personal
AI) learns how you communicate. Less noise, more meaning.

If anything breaks, reply to this email — I want the bug.

— {your_name}
```

Optional polish if you want a little extra warmth: pre-record a 30-sec Loom of you opening the app and paste the link below the code.

---

## Step 4 — Send

Right now there's no automated batch sender — invitees get the code by copy/paste. If the cohort really pushes back on UX friction, ping Paul to ship one of these (each is 15 min):

- `?invite=BETA-XXX` URL prefill so the link auto-fills the code
- `scripts/send-beta-invites.mjs` Resend blaster that takes the CSV and fires per-row using the existing `lib/mailer.ts`

Until then, manual is fine for 70.

---

## Step 5 — Watch the funnel

**Quickest read on who has redeemed** (no admin setup needed):

```bash
cd ~/Desktop/CopyMe/copyme-app    # wherever you cloned the repo
npx vercel env pull .env.production.local --environment=production --yes
DATABASE_URL_UNPOOLED="$(grep '^DATABASE_URL_UNPOOLED=' .env.production.local | cut -d= -f2- | tr -d '"')" \
  node -e '
    import("@prisma/client/index.js").then(async ({PrismaClient}) => {
      const {PrismaPg} = await import("@prisma/adapter-pg");
      const p = new PrismaClient({adapter: new PrismaPg(process.env.DATABASE_URL_UNPOOLED)});
      const r = await p.inviteCode.findMany({
        select: {code:true, usedCount:true, maxUses:true, createdAt:true},
        orderBy: {createdAt:"desc"},
      });
      console.table(r);
      await p.$disconnect();
    });
  '
rm .env.production.local
```

Outputs a table with `usedCount` per code. Cross-reference with your invite spreadsheet to see who's signed up.

**Aggregate view:** `https://copyme1.com/api/status` (public, no auth) — shows DB / Redis / Blob health. Bookmark it.

---

## Step 6 — When you need to mint more codes

If you blow through the 70 and want a second cohort:

```bash
cd ~/Desktop/CopyMe/copyme-app
npx vercel env pull .env.production.local --environment=production --yes
DATABASE_URL_UNPOOLED="$(grep '^DATABASE_URL_UNPOOLED=' .env.production.local | cut -d= -f2- | tr -d '"')" \
  node scripts/seed-invite-codes.mjs --count=50 --note="G2 cohort 2" \
  > ~/Desktop/CopyMe/g2-cohort-2-codes.txt
rm .env.production.local
```

Confirm it before sharing:

```bash
wc -l ~/Desktop/CopyMe/g2-cohort-2-codes.txt    # should be 50
head -3 ~/Desktop/CopyMe/g2-cohort-2-codes.txt
```

---

## Step 7 — When you want to OPEN the app to public signup (G3)

Just unset the two flags + push any commit (or trigger a redeploy):

```bash
npx vercel env rm BETA_INVITE_REQUIRED production --yes
npx vercel env rm NEXT_PUBLIC_BETA_INVITE_REQUIRED production --yes
git commit --allow-empty -m "G3: open public signup"
git push origin main
```

The schema and endpoints stay in place — you can re-flip the gate on for future cohorts without a migration.

---

## Step 8 — If something goes wrong

| Symptom | Fix |
|---|---|
| Invitee says "code rejected" | Check the DB: did they typo? Has the code already been used? Use the query in Step 5. |
| Code shows EXHAUSTED but you didn't share it | Someone got the file. Burn it: contact Paul, plan a code rotation. |
| Site is down | Check `https://copyme1.com/api/status`. Red = ping Paul. |
| Need to delete a test/abuse account | `cd ~/Desktop/CopyMe/copyme-app && npx vercel env pull … && DATABASE_URL_UNPOOLED=… node scripts/delete-users.mjs <user-uuid>` |
| Hit Sentry alerts | Sentry release tags are wired (build SHA visible at `/api/status`) — alerts route to whatever you've wired up at the Sentry org level. |

---

## Quick reference

- **Production:** https://copyme1.com
- **Status:** https://copyme1.com/api/status
- **Repo:** github.com/interactiveintel/copyme-app
- **Deploy:** auto from `main` via Vercel
- **DB:** Neon (managed via Vercel Marketplace — no pgAdmin access needed)
- **Latest tag:** `v4.12.3`
