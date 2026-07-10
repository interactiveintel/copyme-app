import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
// v4.16.18 (stay-signed-in root fix): mint DB-backed sessions instead
// of bare JWTs. The v4.3.0 refresh rewrite (S-107 single-use rotation)
// only accepts tokens with a matching `sessions` row — bare JWTs from
// this route could never refresh, so every password login hard-died
// ~15 minutes in (access TTL), wiping storage and bouncing the user
// back to the sign-in form no matter what "stay signed in" said.
import { issueSession } from "@/lib/sessions";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { bumpStreak } from "@/lib/streak";

// Prisma + bcryptjs — must stay on the Node runtime (AGENTS.md).
export const runtime = "nodejs";

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

    // --- Mint a DB-backed session (refresh-rotation compatible) -------------
    const tokens = await issueSession({
      userId: user.id,
      userAgent: request.headers.get("user-agent") ?? undefined,
      ip,
    });

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          accountTier: user.accountTier,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
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
