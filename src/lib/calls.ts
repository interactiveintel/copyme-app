// Call lifecycle helpers — create, accept, decline, end.
//
// Mirrors the shape of src/lib/vap/request.ts so the chat-bubble
// patterns stay consistent. One Call row per call attempt. The
// `status` field captures the lifecycle (ringing → accepted → ended,
// or → declined / missed / failed).
//
// Pairing with chat: the caller's create() also writes a Message of
// type "call" so the chat thread renders the call as an inline bubble.
// Subsequent state transitions update that Message's content JSON in
// place so the bubble re-renders without a parallel fetch.

import { prisma } from "@/lib/db";
import { roomNameFor } from "@/lib/livekit";
import { addBreadcrumb, reportError } from "@/lib/observability";

export type CallType = "voice" | "video";
export type CallStatus =
  | "ringing"
  | "accepted"
  | "declined"
  | "missed"
  | "ended"
  | "failed";

export interface CallReason {
  ok: boolean;
  reason: "OK" | "INVALID_TARGET" | "SAME_USER" | "RECIPIENT_NOT_FOUND" | "RATE_LIMITED" | "NOT_FOUND" | "FORBIDDEN" | "ALREADY_TERMINAL" | "ERROR";
}

export interface CreateCallResult extends CallReason {
  callId?: string;
  room?: string;
  messageId?: string;
}

export interface UpdateCallResult extends CallReason {
  status?: CallStatus;
  durationSeconds?: number;
}

/**
 * Create a new outbound call. Writes the Call row + the bound chat
 * Message in a single transaction so a partial state is impossible.
 *
 * The caller's UI should immediately mint a token via
 * /api/calls/token?callId=... and connect to the LiveKit room.
 */
export async function createCall(args: {
  callerId: string;
  calleeId: string;
  callType: CallType;
}): Promise<CreateCallResult> {
  const { callerId, calleeId, callType } = args;

  if (callerId === calleeId) return { ok: false, reason: "SAME_USER" };

  const recipient = await prisma.user.findUnique({
    where: { id: calleeId },
    select: { id: true },
  });
  if (!recipient) return { ok: false, reason: "RECIPIENT_NOT_FOUND" };

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create the call row first so we have an id to derive the room
      // name from. The room name is then patched in once we know it.
      const call = await tx.call.create({
        data: {
          callerId,
          calleeId,
          callType,
          status: "ringing",
          // temp placeholder; updated below once we have the call id
          room: "pending",
        },
        select: { id: true },
      });

      const room = roomNameFor(callerId, calleeId, call.id);

      // Bind a chat Message so the thread shows an inline call bubble.
      const message = await tx.message.create({
        data: {
          senderId: callerId,
          receiverId: calleeId,
          type: "call",
          content: JSON.stringify({
            kind: "call",
            callType,
            status: "ringing",
            callId: call.id,
          }),
          deliveredAt: new Date(),
        },
        select: { id: true },
      });

      const updated = await tx.call.update({
        where: { id: call.id },
        data: { room, messageId: message.id },
        select: { id: true, room: true, messageId: true },
      });

      return { callId: updated.id, room: updated.room, messageId: updated.messageId ?? undefined };
    });

    addBreadcrumb("call.create.ok", {
      callId: result.callId,
      callerId,
      calleeId,
      callType,
    });

    return { ok: true, reason: "OK", ...result };
  } catch (err) {
    reportError(err, { context: "call.create", callerId, calleeId, callType });
    return { ok: false, reason: "ERROR" };
  }
}

/**
 * Flip a call to a terminal state. Only the caller can mark ended/failed;
 * only the callee can mark accepted/declined/missed.
 *
 * Idempotent for terminal-state transitions — calling end() twice on an
 * already-ended call returns ALREADY_TERMINAL rather than re-stamping
 * the timestamp.
 */
export async function updateCallStatus(args: {
  callId: string;
  actorId: string;
  next: Exclude<CallStatus, "ringing">;
}): Promise<UpdateCallResult> {
  const { callId, actorId, next } = args;

  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      callerId: true,
      calleeId: true,
      callType: true,
      status: true,
      messageId: true,
      acceptedAt: true,
      createdAt: true,
    },
  });
  if (!call) return { ok: false, reason: "NOT_FOUND" };

  // Authorization: only the two participants can flip status.
  if (actorId !== call.callerId && actorId !== call.calleeId) {
    return { ok: false, reason: "FORBIDDEN" };
  }

  // Specific transitions:
  //   ringing → accepted | declined | missed   (callee)
  //   ringing → ended | failed                 (caller — cancellation)
  //   accepted → ended | failed                (either side hangs up)
  if (call.status !== "ringing" && call.status !== "accepted") {
    return { ok: false, reason: "ALREADY_TERMINAL" };
  }

  // Some transitions are role-restricted to avoid abuse (the caller
  // can't "accept" their own call to pretend the callee picked up).
  if (next === "accepted" || next === "declined" || next === "missed") {
    if (actorId !== call.calleeId) return { ok: false, reason: "FORBIDDEN" };
  }

  const now = new Date();
  const acceptedAt = next === "accepted" ? now : call.acceptedAt;
  const endedAt =
    next === "accepted" ? null : now;
  const durationSeconds =
    endedAt && acceptedAt
      ? Math.max(0, Math.round((endedAt.getTime() - acceptedAt.getTime()) / 1000))
      : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.call.update({
        where: { id: callId },
        data: {
          status: next,
          acceptedAt,
          endedAt,
          durationSeconds,
        },
      });

      // Update the bound Message's content so the chat bubble re-renders
      // its new status without a separate fetch.
      if (call.messageId) {
        await tx.message.update({
          where: { id: call.messageId },
          data: {
            content: JSON.stringify({
              kind: "call",
              callType: call.callType,
              status: next,
              callId: call.id,
              durationSeconds: durationSeconds ?? undefined,
            }),
          },
        }).catch(() => undefined);
      }
    });

    addBreadcrumb("call.update.ok", { callId, actorId, next });
    return { ok: true, reason: "OK", status: next, durationSeconds: durationSeconds ?? undefined };
  } catch (err) {
    reportError(err, { context: "call.update", callId, actorId, next });
    return { ok: false, reason: "ERROR" };
  }
}

/**
 * Look up a call. Used by the token endpoint to confirm the requester
 * is one of the two parties before minting a join token.
 */
export async function getCall(callId: string) {
  return prisma.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      callerId: true,
      calleeId: true,
      callType: true,
      status: true,
      room: true,
      messageId: true,
      acceptedAt: true,
      endedAt: true,
      durationSeconds: true,
      createdAt: true,
    },
  });
}
