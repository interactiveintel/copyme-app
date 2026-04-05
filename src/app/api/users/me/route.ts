import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { validateDisplayName, validateInterest } from "@/lib/ruleOf7";

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
        lastActivityAt: true,
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
  location?: {
    globalArea?: string;
    countryPhoneCode?: string;
    region?: string;
    cityZip?: string;
    localDescription?: string;
    locationVisible?: boolean;
  };
  interests?: Array<{ slotNumber: number; interestText: string }>;
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
    if (body.preferredCurrency !== undefined) userUpdate.preferredCurrency = body.preferredCurrency;

    // --- Update user base fields --------------------------------------------
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: auth.userId },
        data: userUpdate,
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
