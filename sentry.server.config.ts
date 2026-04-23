// ---------------------------------------------------------------------------
// Sentry — Node runtime init (server-side route handlers, server components,
// API routes that run on Node, instrumentation hook).
//
// Loaded by ./instrumentation.ts when NEXT_RUNTIME === "nodejs".
//
// Env-gated: when NEXT_PUBLIC_SENTRY_DSN is unset (dev / preview / fork),
// Sentry.init becomes a no-op. The library is still imported, but no events
// are queued or sent — keeps fork builds clean.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,

    // Sample 20% of transactions in production, 100% in preview/dev so we can
    // actually see traces during testing.
    tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.2 : 1.0,

    // Don't send PII automatically — we strip tokens / phone hashes from
    // breadcrumbs ourselves where it matters.
    sendDefaultPii: false,

    // Quieter logs in prod build.
    debug: false,
  });
}
