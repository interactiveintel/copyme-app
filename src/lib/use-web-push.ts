"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";

// ---------------------------------------------------------------------------
// useWebPush — single source of truth for browser push state.
//
// Lifecycle:
//   1. On mount, check browser support (serviceWorker + PushManager + Notification).
//   2. Register /sw.js if not already.
//   3. Read the current Notification.permission.
//   4. If permission === 'granted', read the existing pushManager subscription
//      (don't create a new one — that re-uses the browser's cached endpoint).
//
// Consumers call `enable()` to trigger the permission prompt + subscription
// creation, and `disable()` to unsubscribe.
// ---------------------------------------------------------------------------

type Status = "loading" | "unsupported" | "not_configured" | "denied" | "off" | "on";

interface UseWebPushState {
  status: Status;
  error?: string;
}

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function subscriptionToJson(sub: PushSubscription): {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    keys: {
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    },
  };
}

export function useWebPush() {
  const { user, authFetch } = useAuth();
  const [state, setState] = useState<UseWebPushState>({ status: "loading" });
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Detect browser support + refresh current subscription state.
  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      setState({ status: "unsupported" });
      return;
    }

    // Fetch the public key — if the server hasn't configured VAPID, hide the UI.
    if (!publicKey) {
      try {
        const res = await fetch("/api/notifications/public-key");
        if (res.status === 503) {
          setState({ status: "not_configured" });
          return;
        }
        const data = await res.json();
        if (data?.data?.publicKey) setPublicKey(data.data.publicKey);
      } catch {
        setState({ status: "not_configured" });
        return;
      }
    }

    // Ensure the SW is registered (don't block if it's not yet).
    let reg: ServiceWorkerRegistration | null = null;
    try {
      reg = (await navigator.serviceWorker.getRegistration("/")) ?? null;
      if (!reg) reg = await navigator.serviceWorker.register("/sw.js");
    } catch {
      setState({ status: "unsupported", error: "service worker failed" });
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setState({ status: "denied" });
      return;
    }

    const existing = await reg.pushManager.getSubscription().catch(() => null);
    if (permission === "granted" && existing) {
      setState({ status: "on" });
    } else {
      setState({ status: "off" });
    }
  }, [publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Request permission, create a subscription, POST it to the server.
  const enable = useCallback(async () => {
    if (!user) {
      setState({ status: "off", error: "Sign in to enable notifications." });
      return;
    }
    if (!publicKey) {
      setState({ status: "not_configured" });
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ status: permission === "denied" ? "denied" : "off" });
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.register("/sw.js"));

      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const res = await authFetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscriptionToJson(sub)),
      });
      if (!res.ok) {
        setState({ status: "off", error: "Subscribe failed on server." });
        return;
      }
      setState({ status: "on" });
    } catch (err) {
      setState({
        status: "off",
        error: err instanceof Error ? err.message : "enable failed",
      });
    }
  }, [user, authFetch, publicKey]);

  // Unsubscribe locally + on the server.
  const disable = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if (user) {
          await authFetch("/api/notifications/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          }).catch(() => {});
        }
      }
      setState({ status: "off" });
    } catch (err) {
      setState({
        status: "off",
        error: err instanceof Error ? err.message : "disable failed",
      });
    }
  }, [user, authFetch]);

  return { ...state, enable, disable, refresh };
}
