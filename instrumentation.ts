// ---------------------------------------------------------------------------
// Next.js instrumentation hook (App Router, Next 15).
//
// Loaded once per runtime at startup. We use it to:
//   1. Boot Sentry for the matching runtime (Node or Edge) by importing
//      the relevant config file.
//   2. Re-export Sentry.captureRequestError as `onRequestError` so Next.js
//      pipes uncaught route-handler errors straight to Sentry without us
//      having to wrap every handler.
//
// Both the Sentry inits inside those config files are env-gated, so when
// NEXT_PUBLIC_SENTRY_DSN is unset the entire chain becomes a no-op.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Next.js 15+ hook: any error thrown out of a route handler / server action
// flows through here. Sentry exports a ready-made implementation.
export const onRequestError = Sentry.captureRequestError;
