import { NextRequest, NextResponse } from "next/server";
import { verifyToken, extractBearerToken } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Routes that do NOT require authentication
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES = ["/api/auth/"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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

  try {
    const payload = verifyToken(token);

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
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" },
      },
      { status: 401 },
    );
  }
}

// ---------------------------------------------------------------------------
// Matcher — only run middleware on API routes
// ---------------------------------------------------------------------------

export const config = {
  matcher: "/api/:path*",
};
