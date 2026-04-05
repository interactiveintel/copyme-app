import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth";

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

interface LoginBody {
  phone: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginBody;

    // --- Validate required fields -------------------------------------------
    if (!body.phone || !body.password) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "phone and password are required" },
        },
        { status: 400 },
      );
    }

    // --- Look up user by phone hash -----------------------------------------
    const phoneHash = createHash("sha256").update(body.phone).digest("hex");

    const user = await prisma.user.findUnique({
      where: { phoneHash },
      select: {
        id: true,
        displayName: true,
        accountTier: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" },
        },
        { status: 401 },
      );
    }

    // --- Verify password ----------------------------------------------------
    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid phone or password" },
        },
        { status: 401 },
      );
    }

    // --- Update last activity -----------------------------------------------
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActivityAt: new Date() },
    });

    // --- Generate tokens ----------------------------------------------------
    const accessToken = generateAccessToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          accountTier: user.accountTier,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error("[login] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 },
    );
  }
}
