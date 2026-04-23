import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// GET /api/business/ads      — list the caller's ads (any status)
// POST /api/business/ads     — create a new ad in `draft` status
//
// Both require an authenticated user with profileType=legal_entity (i.e.
// they've gone through /api/business/upgrade).
// ---------------------------------------------------------------------------

const MAX_BODY_LEN = 700;
const MIN_PRICE_MICRO = 100_000; // $0.10 — Stripe's minimum charge is $0.50, but we
                                  // allow drafts at any price; checkout floors to 50¢.
const MAX_PRICE_MICRO = 100_000_000; // $100 cap on a single ad

interface CreateAdBody {
  brand?: string;
  title?: string;
  tagline?: string;
  body?: string;
  imageUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  category?: string;
  targetInterests?: string[];
  priceMicroUsd?: number;
}

const ALLOWED_CATEGORIES = new Set([
  "for-you",
  "trending",
  "learning",
  "lifestyle",
  "career",
  "entertainment",
]);

function isHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

async function ensureBusiness(userId: string): Promise<{ ok: true } | { ok: false; status: number; error: { code: string; message: string } }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true },
  });
  if (!user) {
    return { ok: false, status: 404, error: { code: "USER_NOT_FOUND", message: "User not found" } };
  }
  if (user.profileType !== "legal_entity") {
    return {
      ok: false,
      status: 403,
      error: {
        code: "NOT_BUSINESS",
        message: "This account is not a business account. Upgrade at /business first.",
      },
    };
  }
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  const check = await ensureBusiness(auth.userId);
  if (!check.ok) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  try {
    const ads = await prisma.businessAd.findMany({
      where: { ownerId: auth.userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: { ads } });
  } catch (error) {
    console.error("[business/ads GET] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load ads" } },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }
  const check = await ensureBusiness(auth.userId);
  if (!check.ok) {
    return NextResponse.json({ success: false, error: check.error }, { status: check.status });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as CreateAdBody;

    // Validation
    const errors: Record<string, string> = {};
    if (!body.brand?.trim()) errors.brand = "brand is required";
    if (!body.title?.trim()) errors.title = "title is required";
    if (!body.body?.trim()) errors.body = "body copy is required";
    if (body.body && body.body.length > MAX_BODY_LEN) errors.body = `body exceeds ${MAX_BODY_LEN} chars`;
    if (!body.ctaUrl?.trim()) errors.ctaUrl = "ctaUrl is required";
    if (body.ctaUrl && !isHttpsUrl(body.ctaUrl)) errors.ctaUrl = "ctaUrl must be a valid http(s) URL";
    if (body.imageUrl && !isHttpsUrl(body.imageUrl)) errors.imageUrl = "imageUrl must be a valid http(s) URL";
    if (body.category && !ALLOWED_CATEGORIES.has(body.category)) {
      errors.category = `category must be one of: ${Array.from(ALLOWED_CATEGORIES).join(", ")}`;
    }
    const priceRaw = body.priceMicroUsd ?? 1_000_000; // default $1
    if (priceRaw < MIN_PRICE_MICRO || priceRaw > MAX_PRICE_MICRO) {
      errors.priceMicroUsd = `price must be between ${MIN_PRICE_MICRO} and ${MAX_PRICE_MICRO} micro-USD`;
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION", message: "Invalid ad fields", meta: errors },
        },
        { status: 400 },
      );
    }

    // Normalize target interests to lowercase strings.
    const targetInterests = Array.isArray(body.targetInterests)
      ? Array.from(
          new Set(
            body.targetInterests
              .map((t) => String(t).trim().toLowerCase())
              .filter((t) => t.length > 0)
              .slice(0, 7),
          ),
        )
      : [];

    const ad = await prisma.businessAd.create({
      data: {
        ownerId: auth.userId,
        brand: body.brand!.trim().slice(0, 80),
        title: body.title!.trim().slice(0, 120),
        tagline: body.tagline?.trim().slice(0, 200) || null,
        body: body.body!.trim().slice(0, MAX_BODY_LEN),
        imageUrl: body.imageUrl?.trim() || null,
        ctaLabel: body.ctaLabel?.trim().slice(0, 40) || "Learn more",
        ctaUrl: body.ctaUrl!.trim(),
        category: body.category || "for-you",
        targetInterests: targetInterests.length > 0 ? targetInterests : undefined,
        status: "draft",
        priceMicroUsd: priceRaw,
      },
    });

    return NextResponse.json({ success: true, data: { ad } }, { status: 201 });
  } catch (error) {
    console.error("[business/ads POST] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to create ad" } },
      { status: 500 },
    );
  }
}
