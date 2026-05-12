// ---------------------------------------------------------------------------
// Sentry — Edge runtime init.
//
// Loaded by ./instrumentation.ts when NEXT_RUNTIME === "edge". The edge
// runtime ships a reduced integration set (no Node-only stuff like the
// http integration), but error capture, breadcrumbs, and tracing all work.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.VERCEL_ENV || "development",

    // B6 — release tagging. See sentry.server.config.ts for rationale.
    release:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7) ??
      "local-dev",

    // B6 — `dist` distinguishes preview deployments that share a SHA.
    dist: process.env.VERCEL_DEPLOYMENT_ID || undefined,

    tracesSampleRate: process.env.VERCEL_ENV === "production" ? 0.2 : 1.0,
    sendDefaultPii: false,
    debug: false,
  });
}
