// Vercel project configuration (v4.14.5).
//
// Replaces the legacy vercel.json with the typed @vercel/config SDK so
// schedule strings, function options, and matchers get IDE intellisense
// and tsc validation.
//
// Reference: https://vercel.com/docs/project-configuration/vercel-ts

import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  // Crons (auth-gated via CRON_SECRET in production).
  crons: [
    {
      path: "/api/cron/daily-digest",
      schedule: "0 16 * * *",
    },
    {
      // v4.15.13 (Sprint 7): nightly call-retention sweep. Privacy
      // policy commits to 90-day retention on call records — this
      // hard-deletes calls + their participants past the window.
      // Runs at 04:00 UTC so it overlaps with low-traffic periods
      // across both US and EU.
      path: "/api/cron/calls-retention",
      schedule: "0 4 * * *",
    },
  ],

  // SSE stream needs longer than the default per-route timeout. Stays
  // intentionally below the 300s platform default so a stuck client
  // can't pin a function forever.
  functions: {
    "src/app/api/messages/stream/route.ts": {
      maxDuration: 60,
    },
  },
};

export default config;
