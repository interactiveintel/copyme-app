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
