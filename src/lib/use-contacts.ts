"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// Shape returned from GET /api/contacts — a thin profile slice.
// ---------------------------------------------------------------------------

export interface ContactSummary {
  id: string;
  displayName: string;
  accountTier: string;
  lastActivityAt: string | null;
  interests: Array<{ slotNumber: number; interestText: string }>;
  addedAt: string;
}

export interface ContactLimitInfo {
  limit: number;
  current: number;
  tier: string;
}

interface ContactsState {
  contacts: ContactSummary[];
  loading: boolean;
  error: string;
  /** True when the user is in demo mode (no auth) and contacts are local-only. */
  demoMode: boolean;
}

interface ContactsApi extends ContactsState {
  refresh: () => Promise<void>;
  addContact: (contactId: string) => Promise<{ ok: true } | { ok: false; error: string; limit?: ContactLimitInfo }>;
  removeContact: (contactId: string) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// useContacts — single source of truth for the authenticated user's
// contacts. In demo mode (!user) returns an empty list; consumers can fall
// back to MOCK_PROFILES to keep the demo experience intact.
// ---------------------------------------------------------------------------

export function useContacts(): ContactsApi {
  const { user, authFetch } = useAuth();
  const [state, setState] = useState<ContactsState>({
    contacts: [],
    loading: false,
    error: "",
    demoMode: !user,
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setState((s) => ({ ...s, demoMode: true, loading: false, contacts: [], error: "" }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const res = await authFetch("/api/contacts");
      const data = await res.json();
      if (!res.ok || !data.success) {
        setState((s) => ({ ...s, loading: false, error: data?.error?.message || "Failed to load contacts" }));
        return;
      }
      setState({
        contacts: (data.data?.contacts as ContactSummary[]) ?? [],
        loading: false,
        error: "",
        demoMode: false,
      });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Network error" }));
    }
  }, [user, authFetch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addContact = useCallback(
    async (contactId: string): Promise<{ ok: true } | { ok: false; error: string; limit?: ContactLimitInfo }> => {
      if (!user) return { ok: false, error: "Sign in to add contacts" };
      try {
        const res = await authFetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return {
            ok: false,
            error: data?.error?.message || "Couldn't add contact",
            limit: data?.error?.meta as ContactLimitInfo | undefined,
          };
        }
        await refresh();
        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    [user, authFetch, refresh],
  );

  const removeContact = useCallback(
    async (contactId: string): Promise<boolean> => {
      if (!user) return false;
      try {
        const res = await authFetch(`/api/contacts/${encodeURIComponent(contactId)}`, {
          method: "DELETE",
        });
        if (!res.ok) return false;
        // Optimistic local prune + server refresh
        setState((s) => ({ ...s, contacts: s.contacts.filter((c) => c.id !== contactId) }));
        return true;
      } catch {
        return false;
      }
    },
    [user, authFetch],
  );

  return { ...state, refresh, addContact, removeContact };
}
