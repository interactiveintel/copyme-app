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

import { AccessToken } from "livekit-server-sdk";
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
