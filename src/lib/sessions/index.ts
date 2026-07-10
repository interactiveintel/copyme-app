// Session + refresh-token management (S-106 + S-107).
//
// One row in `sessions` per (userId, deviceId). Refresh tokens are stored as
// bcrypt hashes; rotation is single-use: the next refresh consumes the
// current row (revokes it) and creates a new one. If a refresh token is
// presented twice we mark `replayDetectedAt` and surface a banner to the
// user (S-107 AC).

import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { generateAccessToken, generateRefreshToken, verifyToken } from "@/lib/auth";
import { addBreadcrumb } from "@/lib/observability";

const REFRESH_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000; // 7d, mirrors auth.ts
const SESSION_BCRYPT_ROUNDS = 10;

export interface IssueParams {
  userId: string;
  deviceId?: string;
  deviceLabel?: string;
  userAgent?: string;
  ip?: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  deviceId: string;
}

function newDeviceId(): string {
  // Crypto-strong UUID v4-ish; we keep them opaque server-side.
  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex");
}

/** Mint a new session for the given user (post-OTP-verify). */
export async function issueSession(p: IssueParams): Promise<SessionTokens> {
  const deviceId = p.deviceId ?? newDeviceId();
  const accessToken = generateAccessToken(p.userId);
  const refreshToken = generateRefreshToken(p.userId);
  const refreshHash = await bcrypt.hash(refreshToken, SESSION_BCRYPT_ROUNDS);

  const session = await prisma.session.create({
    data: {
      userId: p.userId,
      deviceId,
      deviceLabel: p.deviceLabel ?? null,
      userAgent: p.userAgent?.slice(0, 255) ?? null,
      ipHash: hashIp(p.ip),
      refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_LIFETIME_MS),
    },
  });

  addBreadcrumb("session.issued", { userId: p.userId, deviceId });
  return { accessToken, refreshToken, sessionId: session.id, deviceId };
}

/**
 * Rotate a refresh token. Single-use: looks up the active session by
 * deviceId, validates the refresh hash, revokes it, and issues a new pair.
 * On replay (refresh accepted but the row is already revoked / no match)
 * we mark `replayDetectedAt` so the UI can warn the user.
 */
export async function rotateRefresh(
  refreshToken: string,
  ctx: { userAgent?: string; ip?: string },
): Promise<SessionTokens | { error: "INVALID" | "REPLAY"; userId?: string }> {
  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(refreshToken);
  } catch {
    return { error: "INVALID" };
  }
  if (payload.type !== "refresh") return { error: "INVALID" };

  // Find any non-expired, non-revoked session for this user that matches the hash.
  const candidates = await prisma.session.findMany({
    where: { userId: payload.userId, expiresAt: { gt: new Date() } },
  });

  let match = null as null | (typeof candidates)[number];
  for (const c of candidates) {
    if (c.revokedAt) continue;
    if (await bcrypt.compare(refreshToken, c.refreshHash)) {
      match = c;
      break;
    }
  }

  if (!match) {
    // v4.16.18: distinguish two very different no-match cases.
    //
    // A structurally-valid refresh token with ZERO session rows for the
    // user (live or revoked) is an ORPHAN — a bare JWT minted before
    // login/register/password-reset were migrated to issueSession, or
    // a token from a wiped database. Not a replay: there was never a
    // row to rotate. Returning REPLAY here stamped false "token replay
    // detected" security banners on every legacy password-login user.
    //
    // Only when the user HAS session history does a non-matching token
    // mean someone is presenting a rotated-away credential — the
    // textbook replay symptom worth alerting on.
    const anySessionRows = await prisma.session.count({
      where: { userId: payload.userId },
    });
    if (anySessionRows === 0) {
      addBreadcrumb("auth.orphan_refresh", { userId: payload.userId });
      return { error: "INVALID" };
    }

    await prisma.session.updateMany({
      where: { userId: payload.userId, revokedAt: null },
      data: { replayDetectedAt: new Date() },
    });
    addBreadcrumb("auth.replay_attempt", { userId: payload.userId });
    return { error: "REPLAY", userId: payload.userId };
  }

  // Single-use: revoke the matched row and issue a fresh pair preserving deviceId.
  await prisma.session.update({
    where: { id: match.id },
    data: { revokedAt: new Date() },
  });
  return issueSession({
    userId: payload.userId,
    deviceId: match.deviceId,
    deviceLabel: match.deviceLabel ?? undefined,
    userAgent: ctx.userAgent,
    ip: ctx.ip,
  });
}

/** Revoke a session by id, owned by the given user. */
export async function revokeSession(sessionId: string, userId: string): Promise<boolean> {
  const r = await prisma.session.updateMany({
    where: { id: sessionId, userId },
    data: { revokedAt: new Date() },
  });
  return r.count > 0;
}

/** List a user's active devices (S-106 UI). */
export async function listSessions(userId: string) {
  const rows = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: "desc" },
    select: {
      id: true,
      deviceId: true,
      deviceLabel: true,
      userAgent: true,
      lastUsedAt: true,
      createdAt: true,
      replayDetectedAt: true,
    },
  });
  return rows;
}

/** Whether the user has any unread replay-detected events. */
export async function hasReplayBanner(userId: string): Promise<boolean> {
  const row = await prisma.session.findFirst({
    where: { userId, revokedAt: null, replayDetectedAt: { not: null } },
    select: { id: true },
  });
  return !!row;
}
