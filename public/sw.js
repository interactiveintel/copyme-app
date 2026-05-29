// CopyMe service worker — minimal. Handles web push delivery + click,
// plus a no-op fetch handler so the SW satisfies PWA install criteria.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push: show a notification with the payload we sent server-side.
//
// v4.15.6: call notifications (tag prefix "call:") get richer
// treatment — requireInteraction so they don't auto-dismiss before
// the user can tap, and a vibrate pattern so phones ring. Regular
// message notifications keep the default behavior.
self.addEventListener("push", (event) => {
  let payload = { title: "CopyMe", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload wasn't JSON — keep the fallback strings.
  }

  const isCall = typeof payload.tag === "string" && payload.tag.startsWith("call:");

  const title = payload.title || "CopyMe";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag,
    // Sticky for calls — the OS shouldn't dismiss the notification
    // automatically before the user has a chance to accept/decline.
    requireInteraction: isCall,
    // Two-tone vibrate pattern for ring-like UX. The browser ignores
    // this on platforms that don't support Vibration API.
    vibrate: isCall ? [400, 200, 400, 200, 400] : undefined,
    // Call notifications get inline actions so the user can answer
    // without opening the app first. The notificationclick handler
    // below routes based on event.action.
    actions: isCall
      ? [
          { action: "accept", title: "Accept" },
          { action: "decline", title: "Decline" },
        ]
      : undefined,
    data: { url: payload.url || "/app", ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click: focus an existing window pointing at /app, or open a new one.
//
// v4.15.6: for call notifications, append a query param so the app
// shell can short-circuit the 3s GlobalCallListener poll and surface
// the incoming-call sheet immediately. For action="decline" we PATCH
// the call to declined here in the SW and don't open the app at all
// (the user explicitly chose not to engage).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const isCall = data.kind === "call" && typeof data.callId === "string";

  // Action: Decline — don't open the app, just PATCH /api/calls/[id].
  // Tokenless: this fetch carries the SW's origin cookies, but our
  // API uses Bearer tokens in localStorage — so the decline POSTed
  // from the SW will return 401. Accept that for v1; the call will
  // still terminate via the 45s "missed" sweep on the server. A
  // future sprint could move auth to httpOnly cookies for SW use.
  if (isCall && event.action === "decline") {
    event.waitUntil(
      fetch(`/api/calls/${encodeURIComponent(data.callId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }).catch(() => undefined),
    );
    return;
  }

  // For accept and default click, open/focus the app. Add ?incomingCall=
  // so the app can jump straight to the IncomingCallSheet without
  // waiting for the 3s poll.
  const baseUrl = data.url || "/app";
  const target = isCall
    ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}incomingCall=${encodeURIComponent(data.callId)}`
    : baseUrl;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const origin = self.location.origin;
      const absolute = new URL(target, origin).href;
      // Prefer focusing an existing tab — but if it's at /app already
      // we still want it to see the incoming-call hint, so post a
      // message to it as a hint.
      for (const client of list) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === origin && clientUrl.pathname.startsWith("/app")) {
            if (isCall) {
              client.postMessage({ type: "copyme:incoming-call", callId: data.callId });
            }
            if ("focus" in client) return client.focus();
          }
        } catch { /* malformed URL — skip */ }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absolute);
      return null;
    }),
  );
});

// Minimal fetch handler so the SW is considered "active" by the browser.
// We don't implement any caching strategy in v1 — everything passes through.
self.addEventListener("fetch", () => {
  /* pass-through */
});
