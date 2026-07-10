// Client-side access-token reader for STANDALONE pages (/pricing,
// /profile/billing, etc.) that live outside the <AuthProvider> app shell
// and can't use useAuth().
//
// v4.16.33: fixes a monetization blocker. The app persists auth under
// `copyme_auth` (a JSON blob written by auth-context on login AND
// signup, and kept fresh on token refresh). Several standalone pages
// instead read a flat `copyme.access` key that ONLY the signup page
// writes — so a returning user who LOGGED IN had no such key, and the
// /pricing purchase + /profile/billing pages sent `Bearer null` → 401.
// This reads the canonical store first, with the legacy flat key as a
// fallback for a user who just completed signup in the same tab.

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      const raw = store.getItem("copyme_auth");
      if (raw) {
        const token = (JSON.parse(raw) as { accessToken?: string })?.accessToken;
        if (token) return token;
      }
    } catch {
      /* malformed / unavailable — try the next store */
    }
  }
  try {
    return window.localStorage.getItem("copyme.access");
  } catch {
    return null;
  }
}
