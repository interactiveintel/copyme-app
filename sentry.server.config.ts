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

    // B6 — release tagging. Short SHA is unambiguous in our scale and reads
    // nicely in the Sentry UI ("a1b2c3d" vs the 40-char form). Falls back to
    // NEXT_PUBLIC_GIT_SHA (forwarded in next.config.ts for parity with the
    // browser bundle), then "local-dev" so we never crash when the env vars
    // aren't set (local `next dev`, fork builds).
    release:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7) ??
      "local-dev",

    // B6 — `dist` distinguishes preview deployments that share a SHA but
    // were built into different bundles (rebuild, env-only redeploy).
    dist: process.env.VERCEL_DEPLOYMENT_ID || undefined,

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
