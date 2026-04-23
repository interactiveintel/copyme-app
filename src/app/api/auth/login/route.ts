import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import {
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
} from "@/lib/auth";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { bumpStreak } from "@/lib/streak";

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

interface LoginBody {
  phone: string;
  password: string;
}

// Rate-limit windows. These are intentionally tight to blunt brute force
// without getting in the way of a user who mistyped their password twice.
const IP_LIMIT = 20; // per IP
const IP_WINDOW_MS = 15 * 60 * 1000; // 15 min
const ACCOUNT_LIMIT = 5; // per phone hash
const ACCOUNT_WINDOW_MS = 15 * 60 * 1000; // 15 min

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

    // --- Rate limit: per-IP and per-account --------------------------------
    const ip = clientIpFromRequest(request);
    const phoneHash = createHash("sha256").update(body.phone).digest("hex");

    const [ipLimit, accountLimit] = await Promise.all([
      rateLimit(`login:ip:${ip}`, IP_LIMIT, IP_WINDOW_MS),
      rateLimit(`login:acct:${phoneHash}`, ACCOUNT_LIMIT, ACCOUNT_WINDOW_MS),
    ]);

    if (!ipLimit.allowed || !accountLimit.allowed) {
      const retryAfterSec = Math.ceil(
        Math.max(ipLimit.retryAfterMs, accountLimit.retryAfterMs) / 1000,
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many login attempts. Try again shortly.",
          },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(retryAfterSec, 1)) },
        },
      );
    }

    // --- Look up user by phone hash -----------------------------------------

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

    // --- Update last activity + streak --------------------------------------
    await bumpStreak(user.id);

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
