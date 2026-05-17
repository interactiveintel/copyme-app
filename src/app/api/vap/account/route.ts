// GET /api/vap/account — current user's VapAccount state.
// Lazy-creates the account on first call so we don't need a signup hook.

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { getOrCreateAccount } from "@/lib/vap/account";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }
  const account = await getOrCreateAccount(auth.userId);
  return NextResponse.json({ success: true, data: account });
}
