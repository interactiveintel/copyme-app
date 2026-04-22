import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/notifications/subscribe
//
// Body: PushSubscription serialized as JSON (the shape returned by the
// browser's pushManager.subscribe().toJSON()):
//
//   {
//     endpoint: string,
//     keys: { p256dh: string, auth: string }
//   }
//
// Upserts by endpoint so re-subscribing (e.g. after a browser reset)
// doesn't error.
// ---------------------------------------------------------------------------

interface SubBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as SubBody;
    if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "endpoint, keys.p256dh, keys.auth required" },
        },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent")?.slice(0, 255);

    const row = await prisma.pushSubscription.upsert({
      where: { endpoint: body.endpoint },
      create: {
        userId: auth.userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
      update: {
        userId: auth.userId, // re-bind to current user if re-subscribed
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
        userAgent,
      },
      select: { id: true, createdAt: true },
    });

    return NextResponse.json(
      { success: true, data: { id: row.id, createdAt: row.createdAt } },
      { status: 201 },
    );
  } catch (error) {
    console.error("[notifications/subscribe POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to save subscription" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/notifications/subscribe
//
// Body: { endpoint: string }
//
// Idempotent — deleting a non-existent row is a no-op.
// ---------------------------------------------------------------------------

interface UnsubBody {
  endpoint?: string;
}

export async function DELETE(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as UnsubBody;
    if (!body.endpoint) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "endpoint is required" } },
        { status: 400 },
      );
    }

    // Only delete subscriptions the authenticated user actually owns.
    const { count } = await prisma.pushSubscription.deleteMany({
      where: { endpoint: body.endpoint, userId: auth.userId },
    });

    return NextResponse.json({ success: true, data: { deleted: count } });
  } catch (error) {
    console.error("[notifications/subscribe DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to unsubscribe" } },
      { status: 500 },
    );
  }
}
