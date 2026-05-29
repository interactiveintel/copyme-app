"use client";

// GlobalCallListener — app-shell-level component that:
//   1. Polls /api/calls/incoming every 3s while the user is logged in
//   2. Mounts IncomingCallSheet when a ringing call is detected
//   3. Mounts CallSheet once the user accepts
//
// Lives at the app shell (src/app/app/page.tsx) rather than inside any
// individual screen so a ring shows wherever the user is — inbox,
// chat, profile, search.
//
// Sprint 4 will replace the poll with a push notification listener.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import IncomingCallSheet from "./IncomingCallSheet";
import CallSheet from "./CallSheet";

const POLL_MS = 3_000;

interface ActiveCall {
  callId: string;
  peerName: string;
  peerAvatarUrl: string | null;
  callType: "voice" | "video";
}

// Outbound-call event bridge. ChatScreen (or anywhere) can dispatch
// `copyme:start-outbound-call` with { calleeId, calleeName, callType }
// and the listener below handles the POST /api/calls + mounting the
// CallSheet at app-shell level so leaving the chat doesn't kill the
// call. Sprint 2 may swap this for a React context — the event bridge
// is intentionally lightweight for Sprint 1.
export interface StartOutboundCallDetail {
  calleeId: string;
  calleeName: string;
  calleeAvatarUrl?: string | null;
  callType: "voice" | "video";
}

export function startOutboundCall(detail: StartOutboundCallDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("copyme:start-outbound-call", { detail }));
}

export default function GlobalCallListener() {
  const { user, authFetch } = useAuth();
  const [incoming, setIncoming] = useState<ActiveCall | null>(null);
  const [active, setActive] = useState<ActiveCall | null>(null);
  // Track the call id we just dismissed so the next poll doesn't
  // immediately re-show it before the server flips its status.
  const recentlyDismissedRef = useRef<Set<string>>(new Set());

  // Listen for outbound-call requests. POST /api/calls, then mount
  // CallSheet — caller's side of the ring.
  useEffect(() => {
    if (!user) return;
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<StartOutboundCallDetail>).detail;
      if (!detail || active) return; // already on a call → ignore
      try {
        const res = await authFetch("/api/calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            calleeId: detail.calleeId,
            callType: detail.callType,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          // Surface as a one-shot toast via console for now;
          // Sprint 2 will give this a proper UI.
          console.warn("call.start failed:", data?.error?.code ?? res.status);
          return;
        }
        setActive({
          callId: data.data.callId,
          peerName: detail.calleeName,
          peerAvatarUrl: detail.calleeAvatarUrl ?? null,
          callType: detail.callType,
        });
      } catch {
        console.warn("call.start: network error");
      }
    };
    window.addEventListener("copyme:start-outbound-call", handler);
    return () => window.removeEventListener("copyme:start-outbound-call", handler);
  }, [user, authFetch, active]);

  // v4.15.6: short-circuit the 3s poll when the service worker tells
  // us a call notification was tapped. The SW posts
  // { type: "copyme:incoming-call", callId } to the page so we can
  // surface the IncomingCallSheet immediately rather than waiting up
  // to 3s for the next poll. We refetch /api/calls/incoming for the
  // enriched caller name/avatar (same path the poll uses, so the data
  // shape is identical — no risk of UI divergence).
  useEffect(() => {
    if (!user) return;
    const onSwMessage = async (e: MessageEvent) => {
      const data = e.data;
      if (!data || data.type !== "copyme:incoming-call" || !data.callId) return;
      if (active && active.callId === data.callId) return;
      if (incoming && incoming.callId === data.callId) return;
      try {
        const res = await authFetch("/api/calls/incoming");
        if (!res.ok) return;
        const body = await res.json();
        const payload = body?.data;
        // The SW tap might be for a different (older) call than what's
        // currently ringing — only surface when the ids match.
        if (!payload || payload.callId !== data.callId) return;
        setIncoming({
          callId: payload.callId,
          peerName: payload.callerName ?? "Unknown",
          peerAvatarUrl: payload.callerAvatarUrl ?? null,
          callType: payload.callType ?? "voice",
        });
      } catch {
        /* fall back to the regular poll */
      }
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener("message", onSwMessage);
  }, [user, authFetch, active, incoming]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await authFetch("/api/calls/incoming");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const payload = data?.data;
        if (!payload) {
          // No active ring — clear stale incoming state if any.
          if (incoming) setIncoming(null);
          return;
        }
        // Suppress if we already dismissed this id (server hasn't
        // caught up yet) or if we're already on a call.
        if (recentlyDismissedRef.current.has(payload.callId)) return;
        if (active && active.callId === payload.callId) return;
        if (incoming && incoming.callId === payload.callId) return;
        setIncoming({
          callId: payload.callId,
          peerName: payload.callerName ?? "Unknown",
          peerAvatarUrl: payload.callerAvatarUrl ?? null,
          callType: payload.callType ?? "voice",
        });
      } catch {
        /* silent — poll resumes next tick */
      }
    };

    void tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // We intentionally don't depend on `incoming`/`active` here — the
    // tick reads the latest via closure and re-renders are cheap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authFetch]);

  const onAccepted = () => {
    if (!incoming) return;
    // Mount the in-call sheet with the same peer metadata.
    setActive(incoming);
    setIncoming(null);
  };

  const onDismissed = () => {
    if (incoming) {
      recentlyDismissedRef.current.add(incoming.callId);
      // Forget after a minute so genuine re-dials still surface.
      setTimeout(() => {
        recentlyDismissedRef.current.delete(incoming.callId);
      }, 60_000);
    }
    setIncoming(null);
  };

  const onCallEnded = () => {
    if (active) {
      recentlyDismissedRef.current.add(active.callId);
      setTimeout(() => {
        recentlyDismissedRef.current.delete(active.callId);
      }, 60_000);
    }
    setActive(null);
  };

  return (
    <>
      <AnimatePresence>
        {incoming && !active && (
          <IncomingCallSheet
            callId={incoming.callId}
            callerName={incoming.peerName}
            callerAvatarUrl={incoming.peerAvatarUrl}
            callType={incoming.callType}
            authFetch={authFetch}
            onAccepted={onAccepted}
            onDismissed={onDismissed}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {active && (
          <CallSheet
            callId={active.callId}
            peerName={active.peerName}
            peerAvatarUrl={active.peerAvatarUrl}
            callType={active.callType}
            authFetch={authFetch}
            onClose={onCallEnded}
          />
        )}
      </AnimatePresence>
    </>
  );
}
