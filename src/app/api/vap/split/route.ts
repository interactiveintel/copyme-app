// POST /api/vap/split — create N parallel requests sharing a splitGroupId.
//
// Body: {
//   recipients: [{ userId, cents? }, ...],  // 1–7 entries
//   totalCents: number,
//   mode: "equal" | "custom",
//   note?: string
// }
//
// "equal" splits totalCents evenly; any rounding pennies go to the
// first recipient. "custom" requires each recipient to carry `cents`
// and the sum must equal totalCents.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { createSplit, type SplitMode } from "@/lib/vap/split";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface SplitBody {
  recipients?: Array<{ userId: string; cents?: number }>;
  totalCents?: number;
  mode?: SplitMode;
  note?: string;
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`vap:split:${auth.userId}:${ip}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as SplitBody;
  if (!body.recipients || typeof body.totalCents !== "number" || !body.mode) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS" } },
      { status: 400 },
    );
  }

  const result = await createSplit({
    fromUserId: auth.userId,
    recipients: body.recipients,
    totalCents: body.totalCents,
    mode: body.mode,
    note: body.note,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { code: result.reason },
        data: {
          splitGroupId: result.splitGroupId,
          partiallyCreatedRequestIds: result.partiallyCreatedRequestIds,
        },
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      splitGroupId: result.splitGroupId,
      requestIds: result.requestIds,
    },
  });
}
