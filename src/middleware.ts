import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// Routes that do NOT require authentication
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES = ["/api/auth/", "/api/waitlist"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

// ---------------------------------------------------------------------------
// Lightweight JWT decode for Edge Runtime (no verification — routes verify)
// ---------------------------------------------------------------------------

function decodeJwtPayload(token: string): { userId: string; type: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload;
  } catch {
    return null;
  }
}

function extractBearerToken(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // --- CORS headers ---------------------------------------------------------
  const response = NextResponse.next();
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );

  // Handle preflight
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  // Skip auth for public routes
  if (isPublicRoute(pathname)) {
    return response;
  }

  // --- JWT authentication ---------------------------------------------------
  const token = extractBearerToken(request.headers.get("authorization"));

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authorization header with Bearer token required" },
      },
      { status: 401 },
    );
  }

  const payload = decodeJwtPayload(token);

  if (!payload || !payload.userId) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
      },
      { status: 401 },
    );
  }

  if (payload.type !== "access") {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN_TYPE", message: "Access token required" },
      },
      { status: 401 },
    );
  }

  // Pass userId downstream via request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.userId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ---------------------------------------------------------------------------
// Matcher — only run middleware on API routes
// ---------------------------------------------------------------------------

export const config = {
  matcher: "/api/:path*",
};
