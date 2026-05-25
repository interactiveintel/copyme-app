import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getContactAtOnceLimit } from "@/lib/ruleOf7";
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";

// Auth-bound, per-user contact list. Defensive force-dynamic.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/contacts
//
// Returns the authenticated user's contacts with a thin profile slice of
// each contact (enough for list rendering: id, displayName, accountTier,
// last activity, a few interests).
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const rows = await prisma.contact.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        createdAt: true,
        contact: {
          select: {
            id: true,
            displayName: true,
            accountTier: true,
            lastActivityAt: true,
            interests: {
              orderBy: { slotNumber: "asc" },
              take: 3,
              select: { slotNumber: true, interestText: true },
            },
          },
        },
      },
    });

    const contacts = rows.map((r) => ({
      ...r.contact,
      addedAt: r.createdAt,
    }));

    return NextResponse.json({ success: true, data: { contacts } });
  } catch (error) {
    console.error("[contacts GET] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load contacts" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/contacts
//
// Body: { contactId: string }
//
// Adds a contact for the authenticated user, honoring the tier's
// `contactsAtOnce` cap (Rule of 7 basic tier = 7). Idempotent: adding an
// existing contact is a no-op that returns 200.
// ---------------------------------------------------------------------------

interface AddBody {
  contactId?: string;
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
    const body = (await request.json().catch(() => ({}))) as AddBody;
    if (!body.contactId || typeof body.contactId !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "contactId is required" } },
        { status: 400 },
      );
    }
    if (body.contactId === auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "SELF_CONTACT", message: "You can't add yourself as a contact" } },
        { status: 400 },
      );
    }

    // --- Confirm target exists ---------------------------------------------
    const target = await prisma.user.findUnique({
      where: { id: body.contactId },
      select: { id: true, displayName: true, accountTier: true },
    });
    if (!target) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Target user not found" } },
        { status: 404 },
      );
    }

    // --- Idempotent add ----------------------------------------------------
    const existing = await prisma.contact.findUnique({
      where: {
        userId_contactId: { userId: auth.userId, contactId: body.contactId },
      },
    });
    if (existing) {
      return NextResponse.json({
        success: true,
        data: { contact: target, addedAt: existing.createdAt, alreadyPresent: true },
      });
    }

    // --- Enforce Rule of 7 "at once" cap -----------------------------------
    const me = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { accountTier: true, _count: { select: { contacts: true } } },
    });
    if (!me) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "User not found" } },
        { status: 401 },
      );
    }
    const limit = getContactAtOnceLimit(me.accountTier);
    if (me._count.contacts >= limit) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONTACT_LIMIT_REACHED",
            message: `You've reached your ${limit}-contact limit. Remove one to add another, or upgrade your plan.`,
            meta: { limit, current: me._count.contacts, tier: me.accountTier },
          },
        },
        { status: 409 },
      );
    }

    // --- Create row --------------------------------------------------------
    const row = await prisma.contact.create({
      data: { userId: auth.userId, contactId: body.contactId },
    });

    // --- Analytics -------------------------------------------------------
    capture(auth.userId, ANALYTICS_EVENTS.ContactAdded, {
      contactCountAfter: me._count.contacts + 1,
      tier: me.accountTier,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          contact: target,
          addedAt: row.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[contacts POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to add contact" } },
      { status: 500 },
    );
  }
}
