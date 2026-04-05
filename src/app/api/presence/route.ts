import { NextRequest, NextResponse } from "next/server";
import { setOnlineStatus, isOnline } from "@/lib/redis";

// ---------------------------------------------------------------------------
// POST /api/presence — heartbeat to mark self online
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Auth required" } },
      { status: 401 },
    );
  }

  try {
    await setOnlineStatus(userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true }); // degrade gracefully
  }
}

// ---------------------------------------------------------------------------
// GET /api/presence?ids=uuid1,uuid2 — check who is online
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Auth required" } },
      { status: 401 },
    );
  }

  const ids = request.nextUrl.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];
  if (ids.length === 0) {
    return NextResponse.json({ success: true, data: {} });
  }

  try {
    const statuses: Record<string, boolean> = {};
    await Promise.all(
      ids.map(async (id) => {
        statuses[id] = await isOnline(id);
      }),
    );
    return NextResponse.json({ success: true, data: statuses });
  } catch {
    return NextResponse.json({ success: true, data: {} });
  }
}
