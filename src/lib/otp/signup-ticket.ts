// Short-lived (10min) single-use tickets that bridge the phone-OTP verify
// step (S-101 / S-103) to the sign-up complete step (display name + age
// gate). We keep this in-process for the dev path; the production path
// will move to Redis once the flag SDK + Redis seam is available
// (S-186 / S-251).

import { randomBytes } from "node:crypto";

interface Ticket {
  phoneHash: string;
  expiresAt: number;
}

const tickets = new Map<string, Ticket>();
const LIFETIME_MS = 10 * 60 * 1000;

export function issueSignupTicket(phoneHash: string): string {
  const t = randomBytes(24).toString("base64url");
  tickets.set(t, { phoneHash, expiresAt: Date.now() + LIFETIME_MS });
  // GC opportunistically.
  if (tickets.size % 32 === 0) {
    const now = Date.now();
    for (const [k, v] of tickets) if (v.expiresAt < now) tickets.delete(k);
  }
  return t;
}

export function consumeSignupTicket(ticket: string): string | null {
  const row = tickets.get(ticket);
  if (!row) return null;
  tickets.delete(ticket);
  if (row.expiresAt < Date.now()) return null;
  return row.phoneHash;
}
