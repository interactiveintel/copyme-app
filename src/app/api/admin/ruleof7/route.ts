// GET /api/admin/ruleof7 — cap-hit counters dashboard data (S-117).
//
// Internal-only: requires the user id to be in the admin allowlist.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { snapshotCounters } from "@/lib/ruleOf7-metrics";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth || !isAdmin(auth.userId)) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  return NextResponse.json({
    counters: snapshotCounters(),
    notes: [
      "Counters are per-process and reset on deploy.",
      "Production dashboard scrapes Sentry breadcrumbs (`ruleof7.cap_hit`).",
      "Alert if any cap shows < 0.5% trigger rate vs total messages — means it isn't biting.",
    ],
  });
}
