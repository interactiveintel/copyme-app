"use client";

// useUnreadCount — total unread message count across all peers.
//
// Polls /api/messages/inbox (no contactId) on a short interval and sums
// `unreadCount` across the returned conversations. Used by the app
// shell to feed the BottomNav badge — replaces the hardcoded "11" /
// "0" placeholder that lived there before v4.15.5.
//
// Why poll rather than ride the existing SSE stream: the stream is
// per-conversation (ChatScreen subscribes to one peer at a time). The
// app shell is conversation-agnostic and needs a global view, so a
// cheap 10s poll is the right shape. When v4.15.6 ships the push
// pipeline at the OS level, the badge becomes a fallback for users
// who haven't enabled web push.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

const POLL_MS = 10_000;

export function useUnreadCount(): number {
  const { user, authFetch } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }
    try {
      const res = await authFetch("/api/messages/inbox");
      if (!res.ok) return;
      const data = await res.json();
      const convos = (data?.data ?? []) as Array<{ unreadCount?: number }>;
      const total = convos.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
      setCount(total);
    } catch {
      // network blip — keep showing the previous count rather than
      // resetting to 0 (which would look like a bug, not an outage).
    }
  }, [user, authFetch]);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    void fetchCount();
    const id = setInterval(fetchCount, POLL_MS);
    // Refresh when the tab becomes visible again — covers the common
    // "background tab catching up after the user returns" case.
    const onVis = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, fetchCount]);

  return count;
}
