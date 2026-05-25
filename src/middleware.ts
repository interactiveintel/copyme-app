import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ---------------------------------------------------------------------------
// Routes that do NOT require authentication
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/waitlist",
  "/api/notifications/public-key",
  "/api/cron/", // cron routes auth themselves via CRON_SECRET
  "/api/webhooks/", // webhook routes verify their own provider signatures
  "/api/pitch/", // pitch routes are public — investor data room
  "/api/avatars/", // deterministic fallback avatars (A1)
  "/api/transparency/", // public EU DSA ad archive (S-238)
  "/api/status", // public health endpoint — twin to /status page
  "/api/auth/invite/", // beta invite-code preflight (no account yet)
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// JWT verification — Edge-compatible via jose.
//
// Mirrors src/lib/auth.ts::resolveJwtSecret: prefer JWT_SECRET (≥32 chars),
// throw in production if missing/weak, otherwise fall back to the same dev
// secret. The fallback exists purely so `next dev` keeps working without a
// .env file — production builds will fail loudly if JWT_SECRET is unset.
// ---------------------------------------------------------------------------

function resolveJwtSecret(): Uint8Array {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return new TextEncoder().encode(envSecret);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET must be set to a string of at least 32 characters in production. " +
        "Refusing to verify tokens with a weak or missing secret.",
    );
  }

  if (envSecret) {
    // Dev set an env secret but it's too short — accept it so dev keeps
    // working but it would have failed in production.
    return new TextEncoder().encode(envSecret);
  }

  return new TextEncoder().encode(
    "copyme-dev-secret-not-for-production-use-32ch",
  );
}

const JWT_SECRET = resolveJwtSecret();

interface VerifiedPayload {
  userId: string;
  type: string;
}

async function verifyJwt(token: string): Promise<VerifiedPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = typeof payload.userId === "string" ? payload.userId : null;
    const type = typeof payload.type === "string" ? payload.type : null;
    if (!userId || !type) return null;
    return { userId, type };
  } catch {
    // Signature mismatch, expired, malformed, etc. Do not log the token
    // (PII / credential leakage); the route's authenticateRequest will
    // surface the failure with the standard 401 envelope.
    return null;
  }
}

function extractBearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

// ---------------------------------------------------------------------------
// CORS — allowlist instead of wildcard.
//
// Dev: localhost:3000. Prod: copyme1.com (apex + www) and copyme.com.
// Preview deploys are served from *.vercel.app — allow any deploy URL via
// regex so PR previews can call the API without per-deploy config.
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:3000",
  "https://copyme1.com",
  "https://www.copyme1.com",
  "https://copyme.com",
]);

const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  return VERCEL_PREVIEW_RE.test(origin);
}

function applyCorsHeaders(response: NextResponse, origin: string | null): void {
  if (origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  // Always vary on Origin so caches don't serve a response from one origin
  // back to another.
  response.headers.set("Vary", "Origin");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
}

// ---------------------------------------------------------------------------
// Content-Security-Policy — per-request nonce CSP (v4.14.4).
//
// We generate a fresh nonce on every request and inject it into:
//   1. The CSP response header as 'nonce-{nonce}' under script-src.
//   2. The 'x-nonce' request header so the root layout can read it via
//      headers() and pass it to any inline <script nonce={nonce}> tags.
//      Next 15 also auto-applies the nonce to its own bootstrap +
//      RSC streaming scripts when middleware sets one.
//
// 'strict-dynamic' is included so any script loaded by a nonce-trusted
// script is also trusted — this removes the need to allowlist every CDN
// hostname under script-src. All our scripts come from /_next/* (same
// origin), so this is safe.
//
// We KEEP 'unsafe-inline' on style-src because Tailwind v4 injects
// runtime style attributes. Tightening that would require a separate
// nonce wiring through every Tailwind utility usage.
// ---------------------------------------------------------------------------

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
    "media-src 'self' blob: https://*.public.blob.vercel-storage.com",
    "font-src 'self' data:",
    "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io wss: ws:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Page routes (non-API): attach nonce + CSP, then pass through.
  // We don't run auth/CORS here because pages are auth-gated client-side
  // and the API matcher below handles cross-origin concerns.
  if (!pathname.startsWith("/api/")) {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.headers.set("Content-Security-Policy", buildCsp(nonce));
    return response;
  }

  const origin = request.headers.get("origin");

  // --- CORS preflight -------------------------------------------------------
  if (request.method === "OPTIONS") {
    const preflight = new NextResponse(null, { status: 204 });
    applyCorsHeaders(preflight, origin);
    return preflight;
  }

  // Skip auth for public routes
  if (isPublicRoute(pathname)) {
    const response = NextResponse.next();
    applyCorsHeaders(response, origin);
    return response;
  }

  // --- JWT authentication ---------------------------------------------------
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    const response = NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authorization header with Bearer token required" },
      },
      { status: 401 },
    );
    applyCorsHeaders(response, origin);
    return response;
  }

  const payload = await verifyJwt(token);

  if (!payload || !payload.userId) {
    // Strip any inbound x-user-id header so a forged token can't smuggle
    // an identity through; the route's authenticateRequest will reject.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete("x-user-id");
    const response = NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
      },
      { status: 401 },
    );
    applyCorsHeaders(response, origin);
    return response;
  }

  if (payload.type !== "access") {
    const response = NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN_TYPE", message: "Access token required" },
      },
      { status: 401 },
    );
    applyCorsHeaders(response, origin);
    return response;
  }

  // Pass userId downstream via request headers — only after verification.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  applyCorsHeaders(response, origin);
  return response;
}

// ---------------------------------------------------------------------------
// Matcher — run middleware on API routes (auth + CORS) AND on page routes
// (nonce + CSP). Exclude Next static assets, image optimization, favicon,
// and common static binary extensions so we don't burn a crypto.randomUUID
// on every CSS/JS/image fetch.
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)).*)",
  ],
};
