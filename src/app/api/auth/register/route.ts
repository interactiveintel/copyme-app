import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { hashPassword, generateAccessToken, generateRefreshToken } from "@/lib/auth";
import { validateDisplayName } from "@/lib/ruleOf7";
import { issueEmailVerification } from "@/lib/email-verification";

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

interface RegisterBody {
  displayName: string;
  phone: string;
  email?: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RegisterBody;

    // --- Validate required fields -------------------------------------------
    if (!body.displayName || !body.phone || !body.password) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "displayName, phone, and password are required" } },
        { status: 400 },
      );
    }

    // --- Validate display name (Rule of 7) ----------------------------------
    const nameCheck = validateDisplayName(body.displayName);
    if (!nameCheck.valid) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_DISPLAY_NAME", message: nameCheck.error! } },
        { status: 400 },
      );
    }

    // --- Validate password length -------------------------------------------
    if (body.password.length < 8) {
      return NextResponse.json(
        { success: false, error: { code: "WEAK_PASSWORD", message: "Password must be at least 8 characters" } },
        { status: 400 },
      );
    }

    // --- Hash identifiers for uniqueness ------------------------------------
    const phoneHash = createHash("sha256").update(body.phone).digest("hex");
    const emailHash = body.email
      ? createHash("sha256").update(body.email).digest("hex")
      : null;

    // --- Check for duplicates -----------------------------------------------
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { phoneHash },
          ...(emailHash ? [{ emailHash }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: "DUPLICATE_USER", message: "A user with this phone or email already exists" } },
        { status: 409 },
      );
    }

    // --- Hash password ------------------------------------------------------
    const passwordHash = await hashPassword(body.password);

    // --- Create user --------------------------------------------------------
    const user = await prisma.user.create({
      data: {
        displayName: body.displayName,
        phoneHash,
        emailHash,
        passwordHash,
      },
      select: {
        id: true,
        displayName: true,
        accountTier: true,
        createdAt: true,
      },
    });

    // --- Fire verification email (non-blocking best-effort) ----------------
    // Only meaningful when an email was supplied. We intentionally don't
    // await long or fail registration if the mailer is misconfigured.
    if (body.email) {
      issueEmailVerification(user.id, body.email).catch((err) => {
        console.warn("[register] verification email failed:", err);
      });
    }

    // --- Generate tokens ----------------------------------------------------
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: user.id,
            displayName: user.displayName,
          },
          accessToken,
          refreshToken,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[register] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
