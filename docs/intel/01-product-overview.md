# 01 — Product Overview

**Source synthesis:** `CpM_Developer_Specification.docx` §1, `CopyMe simple terms.docx`, `CopyMe_Market_Analysis.docx` §1.

## What CopyMe is, in one sentence

CopyMe is a **mobile-first messaging platform** that maps how people and
organizations actually communicate (rather than just relaying messages),
**enforces a constraint system called the Rule of 7** to replace noise with
meaning, and is designed to evolve into a **complete communication +
discovery + payments super-app** — a Western answer to WeChat, anchored on
intentionality rather than maximalism.

## What it does for a user, in plain terms

> "Think of it as a communication app that mirrors real-world social
> structures (businesses, communities, governments) and turns them into a
> living, searchable network. … less is more — forcing intentional,
> high-signal communication instead of endless noise."
> — `CopyMe simple terms.docx`

You sign up with your phone number (no email, no password). You set up a
display name, a few interests, and pick up to 7 active contacts. You can
send messages — but each one is capped at 70 words, voice/video at 70
seconds, media at 7 items. You see only the last 7 messages per
conversation. An AI assistant ("Yogi") suggests smart replies and helps you
stay focused. The whole product is built around the question: **what if you
made less communication?**

## The Rule of 7 (the canonical table)

The Rule of 7 is enforced in code (server + client + DB) and is a load-
bearing product axis, not marketing.

| Constraint | Basic (free) | Pro | Business | E-commerce |
|---|---:|---:|---:|---:|
| Inbox items per contact | 7 | 30 | 70 | 700 |
| Message word cap | 70 | 140 | 700 | 7,000 |
| Media items per message | 7 | 14 | 70 | 700 |
| Voice / video clip length (s) | 70 | 140 | 700 | 7,000 |
| Concurrent contacts | 7 | 30 | 70 | 700 |
| Contacts per 7-day period | 49 (7×7) | 210 | 490 | 4,900 |
| Group size | 7 | 14 | 70 | 700 |
| Interest slots | 7 | 7 | 7 | 7 |
| AD inbox slots | 7 | 7 | 7 | 70 |
| AD rotation cycle (h) | 7 | 7 | 7 | 7 |
| Display name max chars | 45 | 45 | 45 | 45 |
| VAP free internal transfers / month | 7 | 7 | 7 | 7 |

(Source: `CpM_Developer_Specification.docx` §5, reconciled with
`copyme-app/src/lib/ruleOf7.ts` and `copyme-app/src/lib/tiers.ts`.)

The cap **scales by tier but never disappears.** Per Terms §3:
> "Paid tiers raise these caps but do not remove them."

## Three-phase roadmap

| Phase | Year | Focus | Revenue |
|---|---|---|---|
| **Phase 1** | Year 1 | Free communication core. 10–100M user target. | None — pure user acquisition |
| **Phase 2** | Year 2 | Yogi AI assistant, surveys, B2B ad marketplace, paid Pro/Business tiers | Subscriptions ($3–$50/wk), e-commerce campaigns ($15K–$1M/yr), AD CPM |
| **Phase 3** | Years 3–5 | Value Account Pay (VAP) + virtual MasterCard + P2P + merchant pay | Transaction fees (1%), card fees, business payment tiers |

(Source: `CpM_Developer_Specification.docx` §1.3 + §7, `CopyMe_Market_Analysis.docx` §1.)

## The structured profile

Beyond messaging, every user has a structured, searchable profile. This is
the foundation for Phase 2 AI discovery.

* **5-level location hierarchy** — global area · country phone code · region · city/zip · local description (each opt-in visible).
* **7 interest slots** — each a short tag (≤7 words / ≤45 chars) that drives matching.
* **Description categories** — education / business / religion / other.
* **Profile type** — personal / social / legal_entity (the last enables
  business surfaces).
* **AI-enriched 70-word background description** — visible only to the user
  and Yogi; never returned in search.

(Source: `CpM_Developer_Specification.docx` §3.1.)

## Yogi (the AI layer)

Yogi is an in-app AI assistant powered by Anthropic Claude. The current
production implementation:

* Per-user **personality memory** (tone, humor, empathy) updated from
  message history (emoji ratio, question density, exclamation density,
  keyword clusters).
* **Cost-capped at $0.10/user/day** (configurable via `YOGI_DAILY_COST_CAP_USD`).
* **Rate-limited at 10 req/min/user** (Redis sliding window).
* **Prompt caching** on system + personality + summary blocks for cost reduction.
* **Smart-reply chips**: 3 suggestions ≤70 words, post-filtered for
  hate/self-harm/CSAM/weapons.
* **Privacy:** subprocessor disclosure in `/privacy`; opt-in toggle in
  Profile → Privacy controls.

(Source: `CopyMe_Architecture_Review_23Apr2026.docx` §5.3, reconciled with
`copyme-app/src/lib/agents/yogi.ts` and `copyme-app/src/lib/yogi-cost.ts`.)

## What ships in Phase 1 (the free communication core)

The Phase 1 surface is what most users will see. Per the spec + the
Sprint 0 / Phase 1 work landed:

* **Phone-first sign-up** — country picker (SI + US pinned), SMS OTP,
  display name + birthdate + age gate.
* **Inbox** — 7 active conversations, last-7-messages-per-thread,
  pull-to-refresh, presence + typing indicators.
* **Composer** — live word counter (amber 60+, red 70, hard-stop 70).
  Trim-on-paste with toast.
* **Voice / video clips** — hold-to-record (audio waveform), front/back
  camera (video, 720p), 70-second hard cap with countdown ring.
* **Reactions** — limited to 7 emoji (❤️ 👍 😂 😮 😢 🔥 💜).
* **Reply / quote** — inline reply to a specific message. **No forward** by
  design.
* **Local-first search** over the last-7 window per thread.
* **Offline send queue** — capped at 7 messages, auto-flush on reconnect.
* **End-to-end encryption** — Signal Protocol decision; ECDH-P256 + AES-GCM
  scaffold with 7-day session key rotation.
* **Privacy controls** — single panel for presence, last-seen, receipts,
  typing, transcripts, discoverability.
* **PWA install** — Chromium beforeinstallprompt + iOS Safari overlay.
* **Capacitor wrapper** — recipe ready for App Store (TestFlight) +
  Play Store (Internal).

## What's deferred to Phase 2 / Phase 3

* Yogi conversational shell as a top-level inbox tab (Phase 2.1)
* AI search & discovery surface — interest-tag matching with score (Phase 2.2)
* Surveys — 7-question micro-surveys, k-anonymity ≥7 results (Phase 2.3)
* B2B ad marketplace — ad creator, second-price auction, EU DSA archive (Phase 2.4)
* Paid tiers via Stripe (Phase 2.5)
* Value Account Pay (VAP), virtual MasterCard, P2P, merchant pay (Phase 3 — regulator-gated)

## What CopyMe is NOT

* **Not** a feed-based social network (no algorithmic timeline).
* **Not** unlimited (no infinite scroll, no group chats > 7 on free).
* **Not** anonymous (phone-verified identity is required).
* **Not** a "WeChat clone" in the sense of mini-programs — the super-app
  framing is a long-term arc, not a Phase 1 feature.
* **Not** an "AI-first" product — Yogi is an enhancement, not the substrate.
