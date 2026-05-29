import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { validateDisplayName, validateInterest } from "@/lib/ruleOf7";

// Auth-bound, per-user response. Next 15 doesn't cache route-handler GETs
// by default, but pinning force-dynamic here is a defensive marker so a
// future code change that adds cache hints won't silently serve user A's
// data to user B.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/users/me — Return current user profile
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
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        displayName: true,
        profileType: true,
        accountTier: true,
        vapEnabled: true,
        preferredCurrency: true,
        preferredLocale: true,
        avatarUrl: true,
        lastActivityAt: true,
        streakDays: true,
        streakLastDayAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        location: true,
        interests: {
          orderBy: { slotNumber: "asc" },
        },
        descriptions: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("[users/me GET] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/users/me — Update current user profile
// ---------------------------------------------------------------------------

interface UpdateProfileBody {
  displayName?: string;
  profileType?: string;
  preferredCurrency?: string;
  /** BCP-47 locale (e.g. "en", "sl", "es"). Controls incoming translation (A3). */
  preferredLocale?: string;
  location?: {
    globalArea?: string;
    countryPhoneCode?: string;
    region?: string;
    cityZip?: string;
    localDescription?: string;
    locationVisible?: boolean;
  };
  interests?: Array<{ slotNumber: number; interestText: string }>;
  descriptions?: Array<{
    category?: string;
    level?: string | null;
    location?: string | null;
    institution?: string | null;
    typeDescription?: string | null;
  }>;
}

// The DescriptionCategory enum in Prisma only accepts these values; the
// UI lets the user type freely, so we normalize before persisting.
const ALLOWED_CATEGORIES = ["education", "business", "religion", "other"] as const;
type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

function normalizeCategory(input: string | undefined | null): AllowedCategory {
  if (!input) return "other";
  const lower = input.trim().toLowerCase();
  if ((ALLOWED_CATEGORIES as readonly string[]).includes(lower)) {
    return lower as AllowedCategory;
  }
  return "other";
}

export async function PUT(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as UpdateProfileBody;

    // --- Validate display name if provided ----------------------------------
    if (body.displayName !== undefined) {
      const nameCheck = validateDisplayName(body.displayName);
      if (!nameCheck.valid) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_DISPLAY_NAME", message: nameCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Validate interests if provided (max 7 slots) -----------------------
    if (body.interests) {
      if (body.interests.length > 7) {
        return NextResponse.json(
          { success: false, error: { code: "TOO_MANY_INTERESTS", message: "Maximum 7 interest slots allowed" } },
          { status: 400 },
        );
      }
      for (const interest of body.interests) {
        if (interest.slotNumber < 1 || interest.slotNumber > 7) {
          return NextResponse.json(
            { success: false, error: { code: "INVALID_SLOT", message: "Interest slot must be between 1 and 7" } },
            { status: 400 },
          );
        }
        const check = validateInterest(interest.interestText);
        if (!check.valid) {
          return NextResponse.json(
            { success: false, error: { code: "INVALID_INTEREST", message: check.error! } },
            { status: 400 },
          );
        }
      }
    }

    // --- Build user update data ---------------------------------------------
    const userUpdate: Record<string, unknown> = {};
    if (body.displayName !== undefined) userUpdate.displayName = body.displayName;
    if (body.profileType !== undefined) userUpdate.profileType = body.profileType;
    // v4.16.2 (F6a): validate currency against the Currency enum
    // (USD | EUR). Anything else is rejected — sending raw upstream
    // would surface as a Prisma error and 500 the request.
    if (body.preferredCurrency !== undefined) {
      if (body.preferredCurrency !== "USD" && body.preferredCurrency !== "EUR") {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_CURRENCY", message: "Currency must be USD or EUR" } },
          { status: 400 },
        );
      }
      userUpdate.preferredCurrency = body.preferredCurrency;
    }
    if (body.preferredLocale !== undefined) {
      // Whitelist BCP-47 short codes we ship UI for + any 2-letter tag.
      if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(body.preferredLocale)) {
        return NextResponse.json(
          { success: false, error: { code: "INVALID_LOCALE", message: "Use a BCP-47 tag like 'en' or 'en-US'" } },
          { status: 400 },
        );
      }
      userUpdate.preferredLocale = body.preferredLocale;
    }

    // --- Update user base fields --------------------------------------------
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: userUpdate,
      });
    }

    // --- v4.16.2 (F6a): propagate preferredCurrency to existing
    //     VapAccount. updateMany returns count 0 if the user has no
    //     account yet (lazy-create path will pick up the new currency
    //     on first /api/vap/account call). No-op if currency unchanged.
    if (body.preferredCurrency !== undefined) {
      await prisma.vapAccount.updateMany({
        where: { userId: auth.userId },
        data: { currency: body.preferredCurrency as "USD" | "EUR" },
      });
    }

    // --- Update location (upsert) -------------------------------------------
    if (body.location) {
      await prisma.userLocation.upsert({
        where: { userId: auth.userId },
        create: {
          userId: auth.userId,
          ...body.location,
        },
        update: body.location,
      });
    }

    // --- Update interests (delete + recreate) -------------------------------
    if (body.interests) {
      await prisma.userInterest.deleteMany({
        where: { userId: auth.userId },
      });
      if (body.interests.length > 0) {
        await prisma.userInterest.createMany({
          data: body.interests.map((i) => ({
            userId: auth.userId,
            slotNumber: i.slotNumber,
            interestText: i.interestText,
          })),
        });
      }
    }

    // --- Update descriptions (delete + recreate) ----------------------------
    if (body.descriptions) {
      await prisma.userDescription.deleteMany({
        where: { userId: auth.userId },
      });
      const nonEmpty = body.descriptions.filter(
        (d) => d.level || d.institution || d.typeDescription || d.category,
      );
      if (nonEmpty.length > 0) {
        await prisma.userDescription.createMany({
          data: nonEmpty.map((d) => ({
            userId: auth.userId,
            category: normalizeCategory(d.category),
            level: d.level || null,
            location: d.location || null,
            institution: d.institution || null,
            typeDescription: d.typeDescription || null,
          })),
        });
      }
    }

    // --- Return updated profile ---------------------------------------------
    const updated = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        displayName: true,
        profileType: true,
        accountTier: true,
        vapEnabled: true,
        preferredCurrency: true,
        lastActivityAt: true,
        streakDays: true,
        streakLastDayAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        location: true,
        interests: {
          orderBy: { slotNumber: "asc" },
        },
        descriptions: true,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("[users/me PUT] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/users/me — Permanently delete the authenticated user's account.
//
// Required body: { confirmation: "DELETE" }
//
// Implements the GDPR right to erasure (Art. 17). All owned rows are removed
// via Prisma cascade rules on the Contact, UserInterest, UserDescription,
// UserLocation, Message, Subscription, VapAccount, VapTransaction, and
// token tables. Operational logs outside Postgres (e.g. CDN access logs)
// are retained only as long as documented in the Privacy Policy.
// ---------------------------------------------------------------------------

interface DeleteBody {
  confirmation?: string;
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
    const body = (await request.json().catch(() => ({}))) as DeleteBody;
    if (body.confirmation !== "DELETE") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CONFIRMATION_REQUIRED",
            message: 'Send { "confirmation": "DELETE" } to permanently delete your account.',
          },
        },
        { status: 400 },
      );
    }

    // Verify user still exists so we return a meaningful 404 rather than
    // silently succeeding on an already-deleted account.
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "User not found" } },
        { status: 404 },
      );
    }

    // Prisma schema has onDelete: Cascade on every dependent relation, so a
    // single delete on users cascades to all owned rows (location, interests,
    // descriptions, messages, contacts, subscriptions, password-reset and
    // verification tokens, VAP account & transactions).
    await prisma.user.delete({ where: { id: auth.userId } });

    return NextResponse.json({
      success: true,
      data: {
        userId: auth.userId,
        deletedAt: new Date().toISOString(),
        message: "Account and associated personal data have been deleted.",
      },
    });
  } catch (error) {
    console.error("[users/me DELETE] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to delete account" } },
      { status: 500 },
    );
  }
}
