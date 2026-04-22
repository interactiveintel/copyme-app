// ---------------------------------------------------------------------------
// Server-side product analytics.
//
// We capture a tight list of service-usage events via PostHog's HTTP capture
// endpoint. No SDK dependency — we call the public API directly, the same
// way src/lib/mailer.ts calls Resend. If POSTHOG_API_KEY is unset the
// helper is a no-op, so local dev and feature previews don't need the key.
//
// Legal basis (GDPR Art. 6(1)(f) legitimate interests): measuring service
// usage to operate and improve the product. Events carry only the user's
// UUID (distinct_id) plus a small set of event-specific numeric / boolean
// properties. No name, email, phone, or message content is ever sent.
//
// Events emitted here are INSTRUMENTAL — "did X happen?" — and are kept
// intentionally small so PostHog's 1M-events/mo free tier covers us.
// ---------------------------------------------------------------------------

export const ANALYTICS_EVENTS = {
  Signup: "signup",
  FirstMessage: "first_message",
  CycleCompleted: "cycle_completed",
  ContactAdded: "contact_added",
  YogiChatStarted: "yogi_chat_started",
} as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

type EventProps = Record<string, string | number | boolean | null | undefined>;

function posthogHost(): string {
  // Default to US cloud. EU users can set POSTHOG_HOST=https://eu.posthog.com
  return (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");
}

function enabled(): boolean {
  return typeof process.env.POSTHOG_API_KEY === "string" && process.env.POSTHOG_API_KEY.length > 0;
}

/**
 * Fire-and-forget server-side event capture.
 *
 * Does not throw. Does not block the caller. Safe to call inside any API
 * handler without awaiting — the fetch is intentionally not tied to the
 * request lifecycle (errors are logged, not surfaced).
 */
export function capture(
  distinctId: string,
  event: AnalyticsEvent,
  properties?: EventProps,
): void {
  if (!enabled()) return;
  if (!distinctId) return;

  const payload = {
    api_key: process.env.POSTHOG_API_KEY,
    event,
    distinct_id: distinctId,
    timestamp: new Date().toISOString(),
    properties: {
      ...(properties ?? {}),
      // Mark events as server-origin so PostHog dashboards can segment
      // server vs. client capture if we add browser instrumentation later.
      $lib: "copyme-server",
      $lib_version: "3.4.0",
    },
  };

  // Kick off the request but don't wait. We deliberately swallow all
  // errors — analytics must never break a user-facing request.
  fetch(`${posthogHost()}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch((err) => {
    console.warn("[analytics] capture failed:", err instanceof Error ? err.message : err);
  });
}
