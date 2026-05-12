# Capacitor wrapper — set-up notes (S-163)

We wrap the Next.js PWA with Capacitor 7 to ship to App Store & Play. The
shell project lives in `mobile/` (sibling of `copyme-app/`); this doc is
the recipe for creating it.

## Why Capacitor

* Same React tree, no rewrite of app surface.
* Push notifications via `@capacitor/push-notifications` (FCM + APNs)
  bind cleanly to our existing `lib/push.ts`.
* Universal Links / App Links handled by Capacitor's `App` plugin
  reading the `.well-known` files we already serve (S-166).

## One-time set-up

```bash
mkdir -p mobile && cd mobile
npm init -y
npm install --save \
  @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android \
  @capacitor/push-notifications @capacitor/app @capacitor/preferences \
  @capacitor/status-bar @capacitor/splash-screen
npx cap init "CopyMe" "com.copyme.app" --web-dir=../copyme-app/.next/standalone/.next
npx cap add ios
npx cap add android
```

`capacitor.config.ts` (in `mobile/`):

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.copyme.app",
  appName: "CopyMe",
  // For Capacitor 7 we point the web view at the deployed PWA so HMR-style
  // updates don't require a store re-submission. Switch to bundled assets
  // once we land app-bound code reviews (TestFlight + Play Internal).
  server: {
    url: process.env.COPYME_PWA_URL ?? "https://copyme1.com",
    cleartext: false,
  },
  plugins: {
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
```

## Build matrix

| Platform | Command | Output |
| --- | --- | --- |
| iOS | `npx cap open ios` then Xcode → Archive | `.ipa` for TestFlight |
| Android | `npx cap open android` then Studio → Build Bundle (AAB) | `.aab` for Internal Testing |

## Push wiring

```ts
import { PushNotifications } from "@capacitor/push-notifications";

PushNotifications.requestPermissions().then(({ receive }) => {
  if (receive === "granted") PushNotifications.register();
});

PushNotifications.addListener("registration", ({ value: token }) => {
  // POST to /api/notifications/register with { token, platform: 'ios'|'android' }
});
```

## Status

| Sprint | What | Status |
| --- | --- | --- |
| S-163 | Capacitor project scaffold | **doc-only** (this file). Run the commands above when ready to ship. |
| S-164 | App Store metadata + screenshots | template at `docs/mobile/appstore.md` |
| S-165 | Play Store metadata + screenshots | template at `docs/mobile/playstore.md` |
| S-166 | Deep links (`copyme://thread/<id>`) | code shipped — well-known files at `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` |

## Blockers for actual store submission

1. Apple Developer Program enrollment (US + EU paid accounts)
2. Google Play Developer account ($25 one-time)
3. Push provider keys: FCM service account JSON, APNs auth key (.p8)
4. Privacy nutrition labels copy (already aligned with `/privacy`)
5. Content rating questionnaires (based on `/terms` §3 + §4)
