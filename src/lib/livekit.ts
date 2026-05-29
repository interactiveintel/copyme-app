// LiveKit server-side helpers — token minting + room naming.
//
// LiveKit Cloud (https://cloud.livekit.io) is the provider. The server
// SDK signs short-lived JWTs that the client uses to join a specific
// room with a specific identity. The signing key never leaves the
// server.
//
// Env vars expected:
//   LIVEKIT_API_KEY        — API key from the LiveKit Cloud dashboard
//   LIVEKIT_API_SECRET     — API secret (NEVER expose to the client)
//   LIVEKIT_URL            — wss:// URL of your LiveKit project
//   NEXT_PUBLIC_LIVEKIT_URL — same URL, exposed to the browser
//
// The token TTL is short (15 minutes) — enough for the call lifecycle
// without leaving long-lived credentials lying around in browser memory.

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { createHash } from "node:crypto";

const TOKEN_TTL_SECONDS = 60 * 15;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. Configure LiveKit env vars in Vercel before issuing call tokens.`,
    );
  }
  return v;
}

/**
 * Deterministic room name from a (callerId, calleeId, callId) tuple.
 * We include the callId in the hash so concurrent calls between the
 * same pair land in distinct rooms — useful if a stale offer is still
 * lingering when a new call starts.
 *
 * Result is 32 hex chars, well within LiveKit's 64-char room name limit.
 */
export function roomNameFor(callerId: string, calleeId: string, callId: string): string {
  const pair = [callerId, calleeId].sort().join("|");
  return createHash("sha256").update(`${pair}|${callId}`).digest("hex").slice(0, 32);
}

/**
 * Mint a join token for a specific user joining a specific room.
 * Grants publish + subscribe on the room. We use the user's ID as the
 * identity so the client SDK can render presence by user.
 */
export async function mintCallToken(args: {
  userId: string;
  displayName: string;
  room: string;
  /** When true, the user can publish camera + mic. Default true. */
  canPublish?: boolean;
}): Promise<string> {
  const apiKey = requireEnv("LIVEKIT_API_KEY");
  const apiSecret = requireEnv("LIVEKIT_API_SECRET");

  const at = new AccessToken(apiKey, apiSecret, {
    identity: args.userId,
    name: args.displayName,
    ttl: TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    roomJoin: true,
    room: args.room,
    canPublish: args.canPublish ?? true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

/** Public URL the client uses to connect. Safe to expose. */
export function livekitWsUrl(): string {
  return (
    process.env.NEXT_PUBLIC_LIVEKIT_URL ||
    process.env.LIVEKIT_URL ||
    ""
  );
}

// ---------------------------------------------------------------------------
// Admin API (v4.15.15 / Sprint 6 polish)
//
// RoomServiceClient hits the LiveKit HTTPS admin endpoint (not the
// WSS signaling endpoint) using the same API key + secret. Used by
// caller-only routes to mute every participant or kick someone out
// of a group call.
// ---------------------------------------------------------------------------

function wssToHttps(url: string): string {
  return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

function roomService(): RoomServiceClient {
  const apiKey = requireEnv("LIVEKIT_API_KEY");
  const apiSecret = requireEnv("LIVEKIT_API_SECRET");
  const url = livekitWsUrl();
  if (!url) throw new Error("LIVEKIT_URL not configured");
  return new RoomServiceClient(wssToHttps(url), apiKey, apiSecret);
}

/**
 * Mute every audio track every participant is publishing in the room.
 *
 * LiveKit doesn't expose "mute all" as one call — we list participants,
 * find each one's published audio track(s), and mutePublishedTrack
 * individually. Best-effort: a single participant failing (e.g. left
 * mid-call) doesn't block the others.
 *
 * Participants can unmute themselves immediately after; this is
 * server-driven "lower their hand", not a persistent mute lock.
 */
export async function muteAllInRoom(room: string): Promise<{
  muted: number;
  errors: number;
}> {
  const svc = roomService();
  const participants = await svc.listParticipants(room);
  let muted = 0;
  let errors = 0;
  for (const p of participants) {
    for (const t of p.tracks ?? []) {
      // Source 1 = MICROPHONE per livekit_models.proto. Skip everything
      // else (we don't want to accidentally mute screen-share audio in
      // the future, and we don't need to touch video tracks).
      if (t.source !== 1) continue;
      if (t.muted) continue;
      try {
        await svc.mutePublishedTrack(room, p.identity, t.sid, true);
        muted++;
      } catch {
        errors++;
      }
    }
  }
  return { muted, errors };
}

/**
 * Kick a participant out of the room. They lose their media
 * connection immediately. To prevent immediate rejoin we ALSO mark
 * the CallParticipant row as "left" — the caller's PATCH from the
 * /api/calls/[id]/kick route is responsible for the DB side; this
 * function just severs the LiveKit connection.
 */
export async function kickFromRoom(room: string, identity: string): Promise<void> {
  const svc = roomService();
  await svc.removeParticipant(room, identity);
}
