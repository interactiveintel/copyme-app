import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Resolve JWT secret. In production we REQUIRE the env var to be set;
// otherwise we refuse to sign/verify. In development we fall back to a
// hardcoded string so `npm run dev` keeps working without a .env file.
function resolveJwtSecret(): string {
  const envSecret = process.env.JWT_SECRET;
  if (envSecret && envSecret.length >= 32) return envSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET must be set to a string of at least 32 characters in production. " +
      "Refusing to sign tokens with a weak or missing secret.",
    );
  }

  if (envSecret) {
    // Dev set an env secret but it's too short — warn loudly but continue.
    console.warn(
      "[auth] JWT_SECRET is shorter than 32 chars. This is accepted in development only.",
    );
    return envSecret;
  }

  return "copyme-dev-secret-not-for-production-use-32ch";
}

const JWT_SECRET = resolveJwtSecret();
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export interface TokenPayload {
  userId: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/**
 * Generate a short-lived access token (15 minutes).
 */
export function generateAccessToken(userId: string): string {
  return jwt.sign({ userId, type: "access" } satisfies TokenPayload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

/**
 * Generate a long-lived refresh token (7 days).
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: "refresh" } satisfies TokenPayload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
}

/**
 * Verify and decode a JWT. Throws on invalid / expired tokens.
 */
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext password with bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---------------------------------------------------------------------------
// Request helper
// ---------------------------------------------------------------------------

/**
 * Extract the Bearer token from an Authorization header value.
 * Returns null when the header is missing or malformed.
 */
export function extractBearerToken(
  authHeader: string | null | undefined,
): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1];
}

/**
 * Authenticate a request from its Authorization header.
 * Returns the decoded payload or null on failure.
 */
export function authenticateRequest(
  authHeader: string | null | undefined,
): TokenPayload | null {
  const token = extractBearerToken(authHeader);
  if (!token) return null;
  try {
    const payload = verifyToken(token);
    if (payload.type !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}
