# App Store metadata — CopyMe (S-164)

## Listing

**App name (≤30):** CopyMe — Rule of 7
**Subtitle (≤30):** Less noise. More meaning.
**Promotional text (≤170):**
> Your World's chart of Communication. Seven contacts. Seventy words. Infinite impact.

**Description (≤4000):**
> CopyMe is a messaging platform built around the Rule of 7 — a constraint
> system that replaces noise with meaning. Less is more, giving meaning to
> messages.
>
> • Phone-only sign-up. No email, no password.
> • End-to-end encrypted text & media.
> • A small inbox by design — your seven most important conversations,
>   not a feed.
> • Yogi: an AI assistant that respects your conversation, your time, and
>   your privacy.
>
> Built jointly in the United States and Slovenia. Free tier forever.
>
> Read about the Rule of 7 in our Terms of Service.

**Keywords (≤100, comma-separated):**
> messaging, secure chat, encrypted, ai assistant, rule of 7, communication,
> privacy, copyme, intentional, slow social

**Support URL:** https://copyme-app.vercel.app/press
**Privacy URL:** https://copyme-app.vercel.app/privacy
**Marketing URL:** https://copyme-app.vercel.app/

## Categories

* Primary: **Social Networking**
* Secondary: **Productivity**

## Age rating

* Frequent / Intense Mature/Suggestive: No
* Frequent / Intense Profanity or Crude Humor: No
* User-generated content: **Yes** (with reporting + blocking — S-171, S-172)
* Unrestricted Web Access: No

## Screenshots needed (per device class)

6 screenshots in 6.7" + 6.5" + 5.5" iPhone sizes, plus 12.9" iPad:
1. Hero with new H1 ("Your World's chart of Communication")
2. Inbox with 7 conversations
3. Composer at 64/70 word counter
4. Voice clip recorder mid-record (≤70s ring)
5. Privacy controls screen
6. Yogi suggestion chip

Capture commands (PWA in browser, then export):
```bash
npm run dev
# Then for each device class:
#   open in Safari Responsive Design (or Chrome DevTools)
#   resize to spec
#   ⌘⇧4 → drag area
```

## Submit checklist

- [ ] Capacitor build (S-163) produces a green archive in Xcode
- [ ] TestFlight internal pass (5 testers)
- [ ] Privacy nutrition labels filled (no tracking; data linked only by phone hash)
- [ ] Submit binary to TestFlight track
