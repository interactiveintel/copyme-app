// ---------------------------------------------------------------------------
// /api/e2e/bundle — v4.16.9 (Sprint 8 skeleton)
// ---------------------------------------------------------------------------
//
// GET  ?userId=<uuid>  → returns the target user's published PreKeyBundle
//                       (serialized JSON) or 404 if they haven't opted in.
// PUT  body { bundle: string, registrationId: number }
//                     → publishes/updates the CALLER's bundle. Body.bundle
//                       is the serialized libsignal PreKeyBundle JSON
//                       (the client serializes via libsignal exports in
//                       src/lib/e2e/libsignal.ts — opaque to the server).
//
// The server treats bundles as opaque blobs — it never deserializes,
// validates, or inspects the bundle's internal structure. This keeps
// the server crypto-agnostic: if libsignal format evolves, the server
// keeps working unchanged.
//
// Auth: standard bearer-token. Rate-limited per user (publish is
// expensive client-side and only happens at key-rotation time).
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -----------------------------------------------------------------------------
// GET — fetch a peer's bundle (or your own)
// -----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("userId") ?? auth.userId;

  const row = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, e2ePublicBundle: true, e2eRegistrationId: true },
  });

  if (!row || !row.e2ePublicBundle || row.e2eRegistrationId == null) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "User has not published an E2E bundle" } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      userId: row.id,
      bundle: row.e2ePublicBundle,
      registrationId: row.e2eRegistrationId,
    },
  });
}

// -----------------------------------------------------------------------------
// PUT — publish/update the caller's bundle
// -----------------------------------------------------------------------------

interface PutBody {
  bundle?: unknown;
  registrationId?: unknown;
}

// Cap the JSON blob at 64 KB. A full libsignal PreKeyBundle (identity
// key + signed pre-key + signature + Kyber pre-key + Kyber signature
// + one-time pre-key) is well under 4 KB in practice. The cap is a
// defensive bound — refuses pathological payloads without parsing the
// blob.
const MAX_BUNDLE_BYTES = 64 * 1024;

export async function PUT(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  // Per-user rate limit: 5 publishes/hour. Key rotation happens at
  // device install + when the one-time pre-key pool runs low — both
  // rare enough that this is generous.
  const ip = clientIpFromRequest(req);
  const rl = await rateLimit(`e2e:publish:${auth.userId}:${ip}`, 5, 3600_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
    );
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BODY", message: "Body must be JSON" } },
      { status: 400 },
    );
  }

  if (typeof body.bundle !== "string" || body.bundle.length === 0) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_BUNDLE", message: "bundle (string) is required" } },
      { status: 400 },
    );
  }
  if (body.bundle.length > MAX_BUNDLE_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: "BUNDLE_TOO_LARGE", message: `Bundle exceeds ${MAX_BUNDLE_BYTES} bytes` } },
      { status: 400 },
    );
  }
  if (
    typeof body.registrationId !== "number" ||
    !Number.isInteger(body.registrationId) ||
    body.registrationId < 0 ||
    body.registrationId > 0xffff_ffff
  ) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_REGISTRATION_ID", message: "registrationId must be a 32-bit unsigned integer" } },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      e2ePublicBundle: body.bundle,
      e2eRegistrationId: body.registrationId,
    },
  });

  return NextResponse.json({
    success: true,
    data: { userId: auth.userId, enabled: true },
  });
}

// -----------------------------------------------------------------------------
// DELETE — opt out of E2E (clear bundle)
// -----------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED" } },
      { status: 401 },
    );
  }

  await prisma.user.update({
    where: { id: auth.userId },
    data: {
      e2ePublicBundle: null,
      e2eRegistrationId: null,
    },
  });

  return NextResponse.json({
    success: true,
    data: { userId: auth.userId, enabled: false },
  });
}
