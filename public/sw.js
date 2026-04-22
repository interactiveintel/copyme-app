// CopyMe service worker — minimal. Handles web push delivery + click,
// plus a no-op fetch handler so the SW satisfies PWA install criteria.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Push: show a notification with the payload we sent server-side.
self.addEventListener("push", (event) => {
  let payload = { title: "CopyMe", body: "You have a new notification." };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Payload wasn't JSON — keep the fallback strings.
  }

  const title = payload.title || "CopyMe";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag,
    data: { url: payload.url || "/app", ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Click: focus an existing window pointing at /app, or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const origin = self.location.origin;
      const absolute = new URL(target, origin).href;
      for (const client of list) {
        if (client.url === absolute && "focus" in client) {
          return client.focus();
        }
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
