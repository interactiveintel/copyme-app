// Vercel project configuration (v4.14.5).
//
// Replaces the legacy vercel.json with the typed @vercel/config SDK so
// schedule strings, function options, and matchers get IDE intellisense
// and tsc validation.
//
// Reference: https://vercel.com/docs/project-configuration/vercel-ts

import { type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  // Daily digest cron — fires at 16:00 UTC (the route is auth-gated
  // via CRON_SECRET).
  crons: [
    {
      path: "/api/cron/daily-digest",
      schedule: "0 16 * * *",
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
