// ---------------------------------------------------------------------------
// Observability — thin facade over Sentry.
//
// Why a wrapper rather than importing @sentry/nextjs directly everywhere:
//   1. Env-gated. If SENTRY_DSN is unset (dev / preview / fork), every call
//      here becomes a console.error. Production code paths don't need
//      `if (sentry)` checks.
//   2. Edge / Node ambiguity. Some routes run on the Edge runtime where
//      not every Sentry helper is available. The wrapper picks the right
//      thing at module-load time.
//   3. Single chokepoint to add fields (release, deployment URL, request
//      ID) without touching every callsite.
//
// Usage:
//   import { reportError, addBreadcrumb } from "@/lib/observability";
//   try { ... } catch (e) { reportError(e, { context: "foo" }); }
// ---------------------------------------------------------------------------

type Scope = Record<string, unknown>;

let sentry: typeof import("@sentry/nextjs") | null = null;

// Lazy import so dev / preview without DSN don't pay the Sentry init cost.
async function getSentry() {
  if (sentry) return sentry;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN) return null;
  try {
    sentry = await import("@sentry/nextjs");
    return sentry;
  } catch {
    return null;
  }
}

/**
 * Report a non-fatal error. In production with SENTRY_DSN set, sends to
 * Sentry. Otherwise logs to console with the same shape so dev output is
 * usable. Never throws — error reporting must not crash the request.
 */
export function reportError(error: unknown, scope: Scope = {}): void {
  // Always log so the dev console + Vercel logs see it.
  console.error("[observability]", scope.context ?? "error", error, scope);

  // Fire-and-forget Sentry call. We deliberately don't await — the request
  // path shouldn't block on observability.
  void getSentry().then((s) => {
    if (!s) return;
    try {
      s.withScope((sc) => {
        for (const [k, v] of Object.entries(scope)) {
          sc.setExtra(k, v);
        }
        s.captureException(error);
      });
    } catch {
      /* swallow — never let observability break the request */
    }
  });
}

/**
 * Add a breadcrumb to the next captured event. Cheap; safe to call on hot
 * paths. No-op when Sentry isn't configured.
 */
export function addBreadcrumb(message: string, data: Scope = {}): void {
  void getSentry().then((s) => {
    if (!s) return;
    try {
      s.addBreadcrumb({
        message,
        level: "info",
        data,
        timestamp: Date.now() / 1000,
      });
    } catch {
      /* swallow */
    }
  });
}

/**
 * True when Sentry will actually receive events. Use to gate expensive
 * scope-decoration work — there's no point building a heavy context object
 * if no one's listening.
 */
export function isObservabilityActive(): boolean {
  return !!(process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN);
}
