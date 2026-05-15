"use client";

// Global service-worker registration. Mounted once at the root layout so
// every page load ensures /sw.js is registered with the "/" scope.
//
// Why this exists separately from `lib/use-web-push.ts`: that hook only
// runs when the user opts in to push notifications, which means most
// visitors never get the SW registered. PWA install criteria (Chromium /
// Edge / Brave) require an *active* SW with a fetch handler on every page
// load, so without this mount the `beforeinstallprompt` event never
// fires — and our DownloadButton silently falls through to the "manual
// instructions" modal instead of the native install prompt.
//
// Idempotent: re-registering the same script is a no-op for the browser.

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Defer slightly so initial paint isn't competing with the SW handshake.
    const t = setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => {
          // Don't throw — push notifications still work via use-web-push
          // even if this initial registration fails for some reason.
          console.warn("[sw] registration failed:", err);
        });
    }, 1000);
    return () => clearTimeout(t);
  }, []);

  return null;
}
