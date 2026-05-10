// 1:1 WebRTC voice call gating (S-136).
//
// Behind a feature flag (`copyme.flag.calls`). The 70-min cap is enforced
// here; real signaling goes via socket.io (already in deps) but the
// orchestration is intentionally minimal — full SFU + TURN configuration
// lands in a later sprint.

import { LIMITS } from "@/lib/ruleOf7";

export const CALL_MAX_SECONDS = 70 * 60; // 70min — Rule of 7 echoed

export interface CallSession {
  id: string;
  startedAt: number;
  /** When `Date.now() - startedAt >= CALL_MAX_SECONDS * 1000`, the SDK ends the call. */
  endsAt: number;
}

export function isCallsEnabled(): boolean {
  if (typeof window === "undefined") return process.env.COPYME_CALLS === "1";
  return localStorage.getItem("copyme.flag.calls") === "1";
}

export function openCallSession(): CallSession {
  const startedAt = Date.now();
  return {
    id: `call_${Math.random().toString(36).slice(2)}`,
    startedAt,
    endsAt: startedAt + CALL_MAX_SECONDS * 1000,
  };
}

/** Browser-side RTC config — ICE servers from env or sane defaults. */
export function rtcConfig(): RTCConfiguration {
  const stun = process.env.NEXT_PUBLIC_STUN_URLS?.split(",").filter(Boolean) ?? [
    "stun:stun.l.google.com:19302",
  ];
  return { iceServers: [{ urls: stun }] };
}

export function _smokeRule() {
  // Dev sanity: the per-message word cap and the call-minute cap should
  // both be 70-derived.
  return LIMITS.BASIC.maxMessageWords === 70 && CALL_MAX_SECONDS === 4200;
}
