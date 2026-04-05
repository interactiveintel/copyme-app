"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  login: (phone: string, password: string) => Promise<void>;
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

function saveTokens(tokens: AuthTokens) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

function loadTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

function clearTokens() {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// JWT decode (check expiry only — no verification on client)
// ---------------------------------------------------------------------------

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
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

  // Restore session on mount
  useEffect(() => {
    const stored = loadTokens();
    if (stored && stored.accessToken && !isTokenExpired(stored.accessToken)) {
      setState({
        user: stored.user,
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        loading: false,
      });
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const setAuth = useCallback((tokens: AuthTokens) => {
    saveTokens(tokens);
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

  // --- Login ----------------------------------------------------------------

  const login = useCallback(
    async (phone: string, password: string) => {
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

      setAuth(data.data);
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

  const authFetch = useCallback(
    async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (state.accessToken) {
        headers.set("Authorization", `Bearer ${state.accessToken}`);
      }
      return fetch(url, { ...init, headers });
    },
    [state.accessToken],
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
