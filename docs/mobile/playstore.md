# Google Play metadata — CopyMe (S-165)

## Listing

**App name (≤30):** CopyMe — Rule of 7
**Short description (≤80):**
> Your World's chart of Communication. Less noise. More meaning. Rule of 7.

**Full description (≤4000):** see `docs/mobile/appstore.md` — same body.

## Categories + tags

* Category: **Communication**
* Tags: messaging, encrypted, social-networking, productivity

## Content rating

Run the IARC questionnaire choosing:
* No violence, sexual content, controlled substances, gambling, profanity.
* User-generated content + chat → **Yes** (declare reporting & blocking).
* Sharing personal info → **Phone number only**, hashed.

Expected rating: **PEGI 12 / Teen**.

## Data safety

| Type | Collected | Shared | Reason |
| --- | --- | --- | --- |
| Phone number | Yes (hashed) | No | Account creation |
| Display name | Yes | Optional (visible to your contacts) | Identity |
| Messages | Encrypted; ciphertext only | Recipient device | Core function |
| Media | Encrypted | Recipient device | Core function |
| Yogi AI prompts | Yes (only when used) | Anthropic | AI assistant |
| Crash reports | Yes | Sentry | Stability |
| Analytics | Optional, opt-in EU | First-party only | Product |

## Screenshots

8 phone, 4 tablet, 1 feature graphic (1024×500). Same content as
App Store list.

## Submit checklist

- [ ] Capacitor produces a signed AAB
- [ ] Internal Testing track passes (10 testers)
- [ ] Data safety form mirrors the table above
- [ ] Privacy URL points to /privacy
- [ ] Upload AAB to Internal track
