"use client";

// Client-bound i18n provider + hook (S-254 follow-up — in-app i18n breadth).
//
// The base `t()` in ./index.ts reads from a module-level `active` locale
// which works for landing components but doesn't trigger React re-renders
// when the locale changes. This module wraps the same STRINGS table in a
// React Context so in-app screens (BottomNav, ChatScreen, etc.) update
// reactively when the user switches language.
//
// Resolution order on mount:
//   1. localStorage["copyme.locale"]      — last user choice (sync, no flash)
//   2. /api/users/me → preferredLocale   — server source of truth (async)
//   3. navigator.languages                — browser default
//   4. "en"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  STRINGS,
  SUPPORTED_LOCALES,
  detectLocale,
  setLocale as setActiveLocale,
  type Locale,
} from "./index";

type TranslateFn = (key: string, args?: Record<string, string | number>) => string;

interface LocaleContextValue {
  locale: Locale;
  t: TranslateFn;
  setLocale: (l: Locale) => void;
  ready: boolean;
}

const STORAGE_KEY = "copyme.locale";

function isLocale(s: string | undefined | null): s is Locale {
  return !!s && (SUPPORTED_LOCALES as readonly string[]).includes(s);
}

function lookup(locale: Locale, key: string, args?: Record<string, string | number>): string {
  let raw = STRINGS[locale]?.[key] ?? STRINGS.en[key] ?? key;
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      raw = raw.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return raw;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();

  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
    return detectLocale();
  });
  const [ready, setReady] = useState(false);

  // Mirror the React state into the module-level `active` so any code that
  // still imports the bare `t` from ./index.ts (landing fallbacks) sees the
  // same locale.
  useEffect(() => {
    setActiveLocale(locale);
  }, [locale]);

  // Once we have an access token, override with the server's stored
  // preferredLocale. This is the source of truth across devices.
  useEffect(() => {
    if (!accessToken) {
      setReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const remote = data?.data?.preferredLocale as string | undefined;
        if (cancelled) return;
        if (isLocale(remote) && remote !== locale) {
          setLocaleState(remote);
          window.localStorage.setItem(STORAGE_KEY, remote);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally only refetch on token change — locale is otherwise
    // sticky for the session. A profile-side language picker writes
    // localStorage directly via setLocale().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const t = useCallback<TranslateFn>(
    (key, args) => lookup(locale, key, args),
    [locale],
  );

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale, ready }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (ctx) return ctx;
  // Fallback so components can be rendered outside the provider (e.g. on
  // landing routes) without crashing — they get untranslated English.
  return {
    locale: "en",
    t: (key, args) => lookup("en", key, args),
    setLocale: () => undefined,
    ready: true,
  };
}
