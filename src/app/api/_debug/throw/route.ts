// ---------------------------------------------------------------------------
// B6 — Synthetic Sentry error trigger.
//
// Hits this route to verify two things end-to-end on a deployed build:
//   1. The error reaches Sentry at all (DSN + auth token + uploader wired).
//   2. The error is tagged with the right `release` (commit short SHA), so we
//      can group errors per-version and tell new regressions from old ones.
//
// Usage on a live deploy (Vercel-managed env):
//   curl https://copyme1.com/api/_debug/throw
//
// In production this is gated behind COPYME_DEBUG_THROW=1, so a stray hit
// from a scraper / monitor doesn't fire a Sentry event. Locally / on preview
// (NODE_ENV !== "production") the gate is open so devs can iterate.
//
// The 500 response body echoes the release tag so a single curl proves
// "this build is on release X" without needing Sentry UI access.
//
// Behavior:
//   - Gate closed → 404 (route is invisible to outsiders).
//   - Gate open → captures an Error to Sentry directly via captureException
//     (with a stable message that's good for grouping), then returns a 500
//     JSON body containing the release tag. We capture explicitly rather than
//     letting the throw propagate so the response body can include `release`
//     — that lets a single curl prove "this build is on release X" without
//     needing Sentry UI access.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Use the Node runtime so we get the full server-side Sentry init (the edge
// runtime would also work, but the server runtime is what most route handlers
// run under, so this validates the most common code path).
export const runtime = "nodejs";

// Don't cache / prerender — the gate must be evaluated per request.
export const dynamic = "force-dynamic";

function getRelease(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.NEXT_PUBLIC_GIT_SHA?.slice(0, 7) ??
    "local-dev"
  );
}

export async function GET() {
  const isProd = process.env.NODE_ENV === "production";
  const debugFlag = process.env.COPYME_DEBUG_THROW === "1";

  // Closed in production unless the operator opts in via the env flag.
  if (isProd && !debugFlag) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const release = getRelease();
  const env = process.env.VERCEL_ENV ?? "development";

  // Build a controlled, stably-named error. The message includes the release
  // so even Sentry's grouping fingerprint will pick up the version separation
  // if for some reason the release tag itself doesn't flow through.
  const error = new Error(
    `[copyme-debug-throw] synthetic error from release=${release} env=${env}`,
  );

  // Capture explicitly so we can return a structured 500 body that includes
  // the release tag — a single curl proves which release the route was served
  // from, without needing Sentry UI access. eventId lets the operator search
  // Sentry directly for this event.
  const eventId = Sentry.captureException(error, {
    tags: { source: "copyme-debug-throw", release, env },
  });

  // Flush so the event is in flight before the function instance freezes
  // (Vercel may suspend the runtime once the response is sent).
  await Sentry.flush(2000).catch(() => {
    // Swallow — flush failure shouldn't change the response shape.
  });

  return NextResponse.json(
    {
      ok: false,
      message: "Synthetic error captured to Sentry. Check the dashboard.",
      release,
      env,
      eventId,
    },
    { status: 500 },
  );
}
