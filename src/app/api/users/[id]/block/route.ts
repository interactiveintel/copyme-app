import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/users/:id/block      — block a user
// DELETE /api/users/:id/block    — unblock a user
//
// Blocking is asymmetric: it only stops the caller from seeing the blocked
// user (in suggestions, search) and prevents the blocked user from being
// added as a contact. It does NOT auto-delete existing messages or contacts;
// that's a separate user action.
//
// As a side effect, if the blocked user is in the caller's contacts, the
// contact link is removed (block implies "remove from circle").
// ---------------------------------------------------------------------------

interface BlockBody {
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }
  const { id: targetId } = await params;
  if (!targetId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "id is required" } },
      { status: 400 },
    );
  }
  if (targetId === auth.userId) {
    return NextResponse.json(
      { success: false, error: { code: "SELF_BLOCK", message: "You can't block yourself" } },
      { status: 400 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as BlockBody;
    const reason = body.reason?.slice(0, 500);

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 },
      );
    }

    // Idempotent upsert. Concurrent contact deletion: ignore failures —
    // contact may not exist or may already be gone.
    await prisma.$transaction([
      prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId: auth.userId, blockedId: targetId } },
        create: { blockerId: auth.userId, blockedId: targetId, reason },
        update: { reason },
      }),
      prisma.contact.deleteMany({
        where: {
          OR: [
            { userId: auth.userId, contactId: targetId },
            { userId: targetId, contactId: auth.userId },
          ],
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: { blocked: targetId, blockedAt: new Date().toISOString() },
    });
  } catch (error) {
    console.error("[users/[id]/block POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to block user" } },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }
  const { id: targetId } = await params;
  if (!targetId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "id is required" } },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.userBlock.deleteMany({
      where: { blockerId: auth.userId, blockedId: targetId },
    });
    return NextResponse.json({
      success: true,
      data: { unblocked: targetId, removed: result.count },
    });
  } catch (error) {
    console.error("[users/[id]/block DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to unblock user" } },
      { status: 500 },
    );
  }
}
