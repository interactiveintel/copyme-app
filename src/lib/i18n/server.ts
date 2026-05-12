// Server-bound i18n helpers (S-254 / Tier C10).
//
// The default `t()` in ./index.ts reads from a module-level `active` locale,
// which is only valid in the client where there's a single user. Server
// renders are concurrent across requests, so we need a per-request locale
// instead. `tFor(locale)` returns a closure that resolves keys against the
// passed locale (with English fallback), reusing the same STRINGS table.

import { STRINGS, SUPPORTED_LOCALES, type Locale } from "./index";

/** Returns a server-bound `t(key, args?)` that uses the given locale. */
export function tFor(
  locale: Locale,
): (key: string, args?: Record<string, string | number>) => string {
  return (key: string, args?: Record<string, string | number>) => {
    let raw = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        raw = raw.replace(new RegExp(`{${k}}`, "g"), String(v));
      }
    }
    return raw;
  };
}

/** Type guard: narrows an unknown string to a supported `Locale`. */
export function isSupportedLocale(s: string | undefined | null): s is Locale {
  return !!s && (SUPPORTED_LOCALES as readonly string[]).includes(s);
}
