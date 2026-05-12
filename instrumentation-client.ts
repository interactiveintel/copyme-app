// ---------------------------------------------------------------------------
// Sentry — browser runtime init.
//
// In SDK v10 this file replaces the old sentry.client.config.ts pattern.
// Next.js loads it automatically on the client during the app bootstrap.
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.NEXT_PUBLIC_VERCEL_ENV ||
      "development",

    // B6 — release tagging. Vercel does NOT auto-expose VERCEL_GIT_COMMIT_SHA
    // to the client bundle, so next.config.ts forwards it as
    // NEXT_PUBLIC_GIT_SHA at build time. Short SHA matches server/edge inits
    // so events from all three runtimes group under the same release in
    // Sentry. "local-dev" fallback keeps `next dev` clean.
    release:
      process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7) ??
      process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
      "local-dev",

    // B6 — `dist` distinguishes preview deployments that share a SHA.
    dist: process.env.NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID || undefined,

    // Session replay is opt-in and noisy at scale — leave off until we
    // explicitly want it.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // 20% of page-load traces in prod is plenty for a small audience; 100%
    // in preview/dev so testing produces visible spans.
    tracesSampleRate: process.env.NEXT_PUBLIC_VERCEL_ENV === "production" ? 0.2 : 1.0,

    sendDefaultPii: false,
    debug: false,
  });
}

// Next.js 15+ navigation hook: tells Sentry when a soft client-side route
// change starts so it can attach the right breadcrumbs to following errors.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
