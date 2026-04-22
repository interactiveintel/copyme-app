import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// DELETE /api/contacts/:contactId
//
// Removes the contact row between the authenticated user and the target.
// Idempotent: deleting a non-existent contact returns 200.
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  const { contactId } = await params;

  if (!contactId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_FIELDS", message: "contactId is required" } },
      { status: 400 },
    );
  }

  try {
    await prisma.contact.deleteMany({
      where: { userId: auth.userId, contactId },
    });
    return NextResponse.json({ success: true, data: { contactId } });
  } catch (error) {
    console.error("[contacts DELETE] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to remove contact" } },
      { status: 500 },
    );
  }
}
