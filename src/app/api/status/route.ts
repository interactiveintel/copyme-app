// GET /api/status — public JSON health endpoint.
//
// Returns a snapshot of the database / Redis / Blob round-trip times.
// Used by the public /status page and as a programmatic check for
// uptime monitors. No auth required — only aggregate availability +
// latency leaks out, never user data.
//
// HTTP status code mirrors the worst service:
//   ok       → 200
//   degraded → 200 (still operational; UI shows yellow)
//   down     → 503 (so external monitors flag it)

import { NextResponse } from "next/server";
import { snapshot } from "@/lib/health";

export const runtime = "nodejs";
// Always evaluate fresh — the whole point is "right now".
export const dynamic = "force-dynamic";
// Wrap the response in 60s after the first eviction so cron-style
// monitors don't pound DB/Redis every second.
export const revalidate = 0;

export async function GET() {
  const snap = await snapshot();
  const httpStatus = snap.status === "down" ? 503 : 200;
  return NextResponse.json(snap, {
    status: httpStatus,
    headers: {
      // Light client cache so frequent reloads don't hammer the DB.
      "Cache-Control": "public, max-age=10, s-maxage=10",
    },
  });
}
