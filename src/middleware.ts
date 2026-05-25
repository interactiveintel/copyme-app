import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Middleware runtime — Node.js (v4.14.5).
//
// Next 15 + Vercel Fluid Compute support full Node.js middleware. Switching
// off Edge lets us share the canonical authenticateRequest helper from
// src/lib/auth.ts (which uses jsonwebtoken) instead of maintaining a
// separate jose-based verifier just to satisfy the Edge runtime. One JWT
// library, one verify path — a security fix to one of them no longer
// silently misses the other.
// ---------------------------------------------------------------------------

export const config = {
  // Matcher — run middleware on API routes (auth + CORS) AND on page
  // routes (nonce + CSP). Exclude Next static assets, image optimization,
  // favicon, and common static binary extensions so we don't burn a
  // crypto.randomUUID on every CSS/JS/image fetch.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)).*)",
  ],
  runtime: "nodejs",
};

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
  // Shared with route handlers via src/lib/auth.ts — same verify path,
  // same secret resolution, same access-token-type gate. authenticateRequest
  // returns null on missing/invalid/expired/wrong-type tokens.
  const authHeader = request.headers.get("authorization");
  const payload = authenticateRequest(authHeader);

  if (!payload) {
    // Distinguish missing-token (no Authorization header) from invalid
    // token so the client error surface is the same shape as before.
    const code = authHeader ? "INVALID_TOKEN" : "UNAUTHORIZED";
    const message = authHeader
      ? "Token is invalid or expired"
      : "Authorization header with Bearer token required";
    // Strip any inbound x-user-id header so a client can't smuggle an
    // identity through on a failed verify.
    const stripped = new Headers(request.headers);
    stripped.delete("x-user-id");
    const response = NextResponse.json(
      { success: false, error: { code, message } },
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
