"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  displayName: string;
  accountTier?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  /** Log in. `persist` (default true) controls whether tokens survive a
   *  tab close: true → localStorage; false → sessionStorage. v4.15.2:
   *  Joze flagged that there was no visible "stay signed in" affordance,
   *  even though the app does persist by default — surfacing the choice
   *  also lets shared-device users opt out. */
  login: (phone: string, password: string, persist?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

export interface RegisterData {
  displayName: string;
  phone: string;
  email?: string;
  password: string;
}

interface AuthTokens {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_KEY = "copyme_auth";

/**
 * Save tokens to either localStorage (persists across tab close) or
 * sessionStorage (cleared when the tab closes — for shared devices).
 * The non-chosen store is cleared so a stale "stay signed in" token
 * can't shadow a fresh "don't" choice (and vice versa).
 */
function saveTokens(tokens: AuthTokens, persist: boolean) {
  const payload = JSON.stringify(tokens);
  if (persist) {
    localStorage.setItem(STORAGE_KEY, payload);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
  } else {
    try { sessionStorage.setItem(STORAGE_KEY, payload); } catch {
      // sessionStorage disabled (e.g. some embedded webviews) — fall
      // back to localStorage so the session isn't lost mid-use. The
      // user's preference is best-effort.
      localStorage.setItem(STORAGE_KEY, payload);
    }
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
}

/**
 * Read tokens from whichever store currently holds them. Returns the
 * source so callers can mirror the persistence choice on subsequent
 * refreshes. Checks sessionStorage first (a session-only login should
 * "win" over a stale persisted one if both somehow exist; saveTokens
 * normally prevents that, but a manual localStorage edit could).
 */
function loadTokens(): { tokens: AuthTokens; persist: boolean } | null {
  try {
    const session = sessionStorage.getItem(STORAGE_KEY);
    if (session) return { tokens: JSON.parse(session) as AuthTokens, persist: false };
  } catch { /* ignore */ }
  try {
    const local = localStorage.getItem(STORAGE_KEY);
    if (!local) return null;
    return { tokens: JSON.parse(local) as AuthTokens, persist: true };
  } catch {
    return null;
  }
}

function clearTokens() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// JWT decode (check expiry only — no verification on client)
// ---------------------------------------------------------------------------

function getTokenExpiryMs(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (typeof payload.exp !== "number") return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = getTokenExpiryMs(token);
  if (exp === null) return true;
  return exp < Date.now();
}

// Consider a token "about to expire" if less than 90 seconds remain — we
// proactively refresh so an in-flight API call never fails with 401.
const REFRESH_BUFFER_MS = 90_000;

function isTokenAboutToExpire(token: string): boolean {
  const exp = getTokenExpiryMs(token);
  if (exp === null) return true;
  return exp - Date.now() < REFRESH_BUFFER_MS;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: true,
  });

  // Keep a ref to tokens so authFetch / refresh logic always sees the latest
  // value without being recreated on every render.
  const tokensRef = useRef<{ accessToken: string | null; refreshToken: string | null }>({
    accessToken: null,
    refreshToken: null,
  });
  tokensRef.current = {
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
  };

  // Guard against multiple parallel refresh attempts — all callers await the
  // same in-flight promise.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  // Remember which storage tier the current session lives in so silent
  // token refreshes write back to the same place. Default true matches
  // historical behavior (always persist) so any existing session
  // doesn't get downgraded on first read after upgrade.
  const persistRef = useRef<boolean>(true);

  const setAuth = useCallback((tokens: AuthTokens, persist?: boolean) => {
    if (typeof persist === "boolean") persistRef.current = persist;
    saveTokens(tokens, persistRef.current);
    setState({
      user: tokens.user,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      loading: false,
    });
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setState({ user: null, accessToken: null, refreshToken: null, loading: false });
  }, []);

  // Attempt to refresh the access token. Returns the new access token on
  // success, or null if the refresh token is missing / invalid (caller should
  // then log out).
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const rt = tokensRef.current.refreshToken;
    if (!rt || isTokenExpired(rt)) {
      logout();
      return null;
    }

    const promise = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!res.ok) {
          logout();
          return null;
        }
        const data = await res.json();
        if (!data?.data?.accessToken || !data?.data?.refreshToken) {
          logout();
          return null;
        }
        setAuth(data.data);
        return data.data.accessToken as string;
      } catch {
        // Network error — don't log out, the user may just be offline.
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = promise;
    return promise;
  }, [logout, setAuth]);

  // Restore session on mount. If the access token is expired but the refresh
  // token is still valid, we trigger a silent refresh.
  useEffect(() => {
    const loaded = loadTokens();
    if (!loaded?.tokens?.accessToken) {
      setState((s) => ({ ...s, loading: false }));
      return;
    }

    // Mirror the persistence tier the tokens came from so silent refreshes
    // don't promote a sessionStorage-only login to localStorage.
    persistRef.current = loaded.persist;

    const stored = loaded.tokens;

    if (!isTokenExpired(stored.accessToken)) {
      setState({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        loading: false,
      });
      return;
    }

    // Access expired — try to refresh.
    if (stored.refreshToken && !isTokenExpired(stored.refreshToken)) {
      tokensRef.current = {
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
      };
      setState((s) => ({ ...s, refreshToken: stored.refreshToken, loading: true }));
      refreshAccessToken().finally(() => {
        setState((s) => ({ ...s, loading: false }));
      });
    } else {
      clearTokens();
      setState((s) => ({ ...s, loading: false }));
    }
  }, [refreshAccessToken]);

  // --- Login ----------------------------------------------------------------

  const login = useCallback(
    async (phone: string, password: string, persist: boolean = true) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Login failed";
        throw new Error(msg);
      }

      setAuth(data.data, persist);
    },
    [setAuth],
  );

  // --- Register -------------------------------------------------------------

  const register = useCallback(
    async (body: RegisterData) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || "Registration failed";
        throw new Error(msg);
      }

      setAuth(data.data);
    },
    [setAuth],
  );

  // --- Authenticated fetch --------------------------------------------------
  //
  // Before each request we check if the access token is about to expire and
  // proactively refresh. If the server still returns 401 (e.g. token was
  // revoked), we retry once after a refresh.
  //
  const authFetch = useCallback(
    async (url: string, init?: RequestInit): Promise<Response> => {
      let accessToken = tokensRef.current.accessToken;

      if (accessToken && isTokenAboutToExpire(accessToken)) {
        const next = await refreshAccessToken();
        if (next) accessToken = next;
      }

      const headers = new Headers(init?.headers);
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }

      let res = await fetch(url, { ...init, headers });

      // Retry once on 401 in case the token expired between the check above
      // and the request reaching the server.
      if (res.status === 401 && tokensRef.current.refreshToken) {
        const next = await refreshAccessToken();
        if (next) {
          const retryHeaders = new Headers(init?.headers);
          retryHeaders.set("Authorization", `Bearer ${next}`);
          res = await fetch(url, { ...init, headers: retryHeaders });
        }
      }

      return res;
    },
    [refreshAccessToken],
  );

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        authFetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
