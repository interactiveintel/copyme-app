import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// GET /api/notifications/public-key
//
// Returns the VAPID public key the browser needs to create a
// PushSubscription. If VAPID_PUBLIC_KEY is unset we return a 503 so the
// client can hide the "enable notifications" UI gracefully.
//
// This endpoint is intentionally PUBLIC (no auth) and returns the key
// directly; it's safe because the key is public by design.
// ---------------------------------------------------------------------------

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_CONFIGURED", message: "Push notifications are not configured." } },
      { status: 503 },
    );
  }
  return NextResponse.json({ success: true, data: { publicKey: key } });
}
