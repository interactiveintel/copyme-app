import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // A4: strict gating restored. Production builds fail on TS or ESLint errors.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },

  // B6 — Sentry release tagging.
  //
  // Vercel sets VERCEL_GIT_COMMIT_SHA / VERCEL_ENV / VERCEL_DEPLOYMENT_ID on
  // the build runtime, but they are server-only by default. Re-expose them
  // under NEXT_PUBLIC_* names so the browser bundle (instrumentation-client.ts
  // → Sentry.init({ release })) can read them at build time. Without this
  // forwarding, client-side errors would lack a release tag and would pool
  // across versions, making regression triage impossible at our shipping
  // cadence (multiple releases/day).
  //
  // Chose `env:` over Sentry's auto-inject because it's a one-line change
  // that works for any client-side caller that wants the SHA, not just
  // Sentry — keeps the abstraction in our config rather than vendor magic.
  env: {
    NEXT_PUBLIC_GIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
    NEXT_PUBLIC_VERCEL_DEPLOYMENT_ID: process.env.VERCEL_DEPLOYMENT_ID,
  },

  // B1 (libsignal): the official `@signalapp/libsignal-client` ships as a
  // native Node addon (see `prebuilds/<platform>/*.node`). It MUST NOT be
  // bundled into the client chunk and MUST NOT be webpack-traced — Next has
  // to leave it as an external `require(...)` so the right prebuild is
  // dlopen'd at runtime in the Node runtime on Vercel. The Edge runtime
  // cannot load it; any code path that imports `src/lib/e2e/libsignal.ts`
  // must opt into the Node runtime via `export const runtime = "nodejs"`.
  serverExternalPackages: ["@signalapp/libsignal-client"],

  // Security headers — applied to all routes.
  //
  // CSP notes:
  //   - 'unsafe-inline' is still required for scripts/styles because Next
  //     emits inline bootstrap code and Tailwind/Sentry inject inline
  //     styles. Tightening to a nonce-based CSP is a follow-up (would
  //     require wiring the nonce through middleware + each layout).
  //   - img/media allow `data:` and `blob:` for canvas previews + camera
  //     captures (recorded voice/video go through MediaRecorder which
  //     produces blob URLs before upload).
  //   - Vercel Blob CDN is the canonical image host; allow the
  //     `*.public.blob.vercel-storage.com` wildcard rather than enumerating
  //     each store hostname.
  //   - connect-src allows the Sentry ingest endpoints (both regional
  //     subdomains the SDK can pick), Vercel Blob (for direct PUTs from
  //     the browser), and wss:/ws: for socket.io. `'self'` covers the
  //     API surface.
  //   - frame-ancestors 'none' is the CSP equivalent of X-Frame-Options:
  //     DENY (modern browsers honour CSP first).
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
      "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
      "font-src 'self' data:",
      "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io wss: ws:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

// ---------------------------------------------------------------------------
// Sentry build-time integration.
//
// Wraps the Next config with the Sentry webpack plugin to (a) upload source
// maps and (b) hide them from the browser. All of this is conditional on
// SENTRY_AUTH_TOKEN being set in the build environment — locally and on
// forks the wrapper is essentially a no-op (no upload, no plugin work),
// the runtime SDK still functions (or no-ops) based on NEXT_PUBLIC_SENTRY_DSN.
// ---------------------------------------------------------------------------

export default withSentryConfig(nextConfig, {
  // The Sentry org / project that the SDK reports to. Read from env so the
  // values aren't hard-coded in the repo.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppresses build-time logs so the Vercel build output stays tidy.
  silent: true,

  // Upload a wider set of source maps so client bundles get good stack
  // traces. Default is too narrow.
  widenClientFileUpload: true,

  // Sourcemaps — uploaded to Sentry (for stack traces) but hidden from the
  // public bundle. `hideSourceMaps` was the legacy flag; in @sentry/nextjs 10
  // this lives under `sourcemaps.deleteSourcemapsAfterUpload`.
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Tree-shake out the Sentry SDK debug logger in production builds.
  disableLogger: true,
});
