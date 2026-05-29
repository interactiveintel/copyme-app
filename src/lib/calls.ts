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
import { sendPush } from "@/lib/push";
import { filterUnblocked, isBlockedEitherWay } from "@/lib/blocks";

/**
 * v4.15.12 (Sprint 6): max participants in a group call. Rule of 7 —
 * 1 caller + up to 6 callees. Enforced at the createGroupCall lib
 * level; the API route also validates so a bad client can't bypass.
 */
export const MAX_CALL_PARTICIPANTS = 7;

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
  reason: "OK" | "INVALID_TARGET" | "SAME_USER" | "RECIPIENT_NOT_FOUND" | "RATE_LIMITED" | "NOT_FOUND" | "FORBIDDEN" | "ALREADY_TERMINAL" | "BLOCKED" | "ERROR";
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

  // v4.15.13 (Sprint 7): block-list integration. If either user has
  // blocked the other, the call simply doesn't happen. We return a
  // generic BLOCKED reason rather than a more specific "they blocked
  // you" / "you blocked them" so the caller can't infer who initiated
  // the block (anti-enumeration; matches the pattern messages already
  // use for filtered reads).
  if (await isBlockedEitherWay(callerId, calleeId)) {
    return { ok: false, reason: "BLOCKED" };
  }

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
      // callId column (v4.15.17) lets status updates fan out to all
      // messages bound to this call — important for groups, useful for
      // 1:1 (currently equivalent to Call.messageId, but the unified
      // path is cleaner).
      const message = await tx.message.create({
        data: {
          senderId: callerId,
          receiverId: calleeId,
          type: "call",
          callId: call.id,
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

      // v4.15.12: also write a CallParticipant row for the 1:1 callee
      // so /api/calls/incoming and per-user PATCH paths can read a
      // single unified table instead of branching on Call.calleeId vs
      // CallParticipant. Existing data was backfilled in the migration.
      await tx.callParticipant.create({
        data: {
          callId: call.id,
          userId: calleeId,
          status: "ringing",
        },
      });

      return { callId: updated.id, room: updated.room, messageId: updated.messageId ?? undefined };
    });

    addBreadcrumb("call.create.ok", {
      callId: result.callId,
      callerId,
      calleeId,
      callType,
    });

    // v4.15.6 (Tier E Sprint 4): fan the ringing call out as a web
    // push so the callee's device gets an OS-level ring even when the
    // tab is backgrounded. Best-effort + fire-and-forget — never block
    // the caller's create response on push delivery.
    //
    // The notification tag "call:<callId>" is what sw.js uses to:
    //   1. give the notification requireInteraction so it stays put
    //      until the user dismisses or taps (typical ringtone behavior)
    //   2. add a "📞 Incoming call" prefix to the title
    //
    // GlobalCallListener's 3s poll picks up the ringing call once the
    // user taps and the app gains focus — no extra deep-link wiring
    // needed here.
    void (async () => {
      try {
        const [callerRow, subs] = await Promise.all([
          prisma.user.findUnique({
            where: { id: callerId },
            select: { displayName: true },
          }),
          prisma.pushSubscription.findMany({
            where: { userId: calleeId },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          }),
        ]);
        if (!subs.length) return;
        const callerName = callerRow?.displayName ?? "Someone";
        const body =
          callType === "video"
            ? `${callerName} is video calling you`
            : `${callerName} is calling you`;

        const results = await Promise.all(
          subs.map((s) =>
            sendPush(
              { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
              {
                title: "Incoming call",
                body,
                url: "/app",
                tag: `call:${result.callId}`,
                data: {
                  kind: "call",
                  callId: result.callId,
                  callType,
                  callerId,
                },
              },
            ).then((r) => ({ id: s.id, ...r })),
          ),
        );
        const expired = results.filter((r) => r.expired).map((r) => r.id);
        if (expired.length) {
          await prisma.pushSubscription
            .deleteMany({ where: { id: { in: expired } } })
            .catch(() => undefined);
        }
      } catch (err) {
        // Don't surface push failures to the caller — the in-app
        // ringer (GlobalCallListener poll + IncomingCallSheet)
        // continues to work even if every push subscription fails.

        console.warn("[call.create push] failed:", err instanceof Error ? err.message : err);
      }
    })();

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
      isGroup: true,
      callType: true,
      status: true,
      messageId: true,
      acceptedAt: true,
      createdAt: true,
    },
  });
  if (!call) return { ok: false, reason: "NOT_FOUND" };

  // ---- GROUP CALL PATH (v4.15.12) -----------------------------------
  // Each user controls their OWN participant row. Aggregate Call.status
  // is recomputed after each update:
  //   - "accepted" if any participant is currently accepted
  //   - "ended" if all participants are terminal (declined/missed/left)
  //   - "ringing" otherwise
  // Caller can also flip the WHOLE call to "ended" or "failed" to
  // cancel it before anyone accepts (matches 1:1 caller-cancellation).
  if (call.isGroup) {
    return updateGroupCallStatus({ callId, actorId, callerId: call.callerId, next });
  }

  // ---- 1:1 PATH (unchanged from v4.15.0) -----------------------------
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

      // v4.15.12: keep the CallParticipant row in sync with the 1:1
      // status flip. The actor here is either caller or callee — only
      // the callee's row exists in the participant table.
      await tx.callParticipant.updateMany({
        where: { callId, userId: call.calleeId },
        data: {
          status: next === "accepted" ? "accepted" : next === "ended" ? "left" : next,
          acceptedAt: next === "accepted" ? now : undefined,
          leftAt: next === "accepted" ? undefined : now,
        },
      });

      // Update the bound Message's content so the chat bubble re-renders
      // its new status without a separate fetch. v4.15.17: query by
      // callId so this also covers any post-create messages the
      // group path added (1:1 still has just one).
      await tx.message.updateMany({
        where: { callId: call.id, type: "call" },
        data: {
          content: JSON.stringify({
            kind: "call",
            callType: call.callType,
            status: next,
            callId: call.id,
            durationSeconds: durationSeconds ?? undefined,
          }),
        },
      });
    });

    addBreadcrumb("call.update.ok", { callId, actorId, next });
    return { ok: true, reason: "OK", status: next, durationSeconds: durationSeconds ?? undefined };
  } catch (err) {
    reportError(err, { context: "call.update", callId, actorId, next });
    return { ok: false, reason: "ERROR" };
  }
}

/**
 * v4.15.12 (Sprint 6): per-participant status flip for group calls.
 *
 * Each user controls their own CallParticipant row. After flipping:
 *   - Recompute Call.status from the aggregate:
 *       any participant accepted   → call "accepted"
 *       all participants terminal  → call "ended"
 *       else                       → call "ringing"
 *
 * Caller has a privileged path: they can flip the WHOLE call to
 * "ended" or "failed" to cancel before anyone accepts (matches the
 * 1:1 caller-cancellation semantics).
 */
async function updateGroupCallStatus(args: {
  callId: string;
  actorId: string;
  callerId: string;
  next: Exclude<CallStatus, "ringing">;
}): Promise<UpdateCallResult> {
  const { callId, actorId, callerId, next } = args;
  const isCaller = actorId === callerId;
  const now = new Date();

  // ---- Caller cancelling the whole call ----------------------------
  if (isCaller && (next === "ended" || next === "failed")) {
    try {
      const callForBubble = await prisma.call.findUnique({
        where: { id: callId },
        select: { callType: true },
      });
      await prisma.$transaction(async (tx) => {
        await tx.call.update({
          where: { id: callId },
          data: { status: next, endedAt: now },
        });
        // Mark every still-ringing/accepted participant as left.
        await tx.callParticipant.updateMany({
          where: {
            callId,
            status: { in: ["ringing", "accepted"] },
          },
          data: { status: "left", leftAt: now },
        });
        // v4.15.17: fan content update across all per-thread bubbles
        // (one per callee for groups, one total for 1:1). Same JSON
        // shape both groups and the original 1:1 path use.
        await tx.message.updateMany({
          where: { callId, type: "call" },
          data: {
            content: JSON.stringify({
              kind: "call",
              callType: callForBubble?.callType ?? "voice",
              status: next,
              callId,
              isGroup: true,
            }),
          },
        });
      });
      addBreadcrumb("call.group.cancel", { callId, actorId, next });
      return { ok: true, reason: "OK", status: next };
    } catch (err) {
      reportError(err, { context: "call.group.cancel", callId, actorId, next });
      return { ok: false, reason: "ERROR" };
    }
  }

  // ---- Participant flipping their own row --------------------------
  const part = await prisma.callParticipant.findUnique({
    where: { callId_userId: { callId, userId: actorId } },
    select: { id: true, status: true, acceptedAt: true },
  });
  if (!part) return { ok: false, reason: "FORBIDDEN" };
  if (part.status !== "ringing" && part.status !== "accepted") {
    return { ok: false, reason: "ALREADY_TERMINAL" };
  }

  // Map call-level action → participant-level status. "ended" by a
  // participant means they left the room.
  const partNext =
    next === "ended" ? "left" :
    next === "failed" ? "left" :
    next; // accepted | declined | missed

  try {
    await prisma.$transaction(async (tx) => {
      await tx.callParticipant.update({
        where: { id: part.id },
        data: {
          status: partNext,
          acceptedAt: partNext === "accepted" ? now : part.acceptedAt,
          leftAt: partNext === "accepted" ? undefined : now,
        },
      });

      // Recompute aggregate call status.
      const all = await tx.callParticipant.findMany({
        where: { callId },
        select: { status: true },
      });
      const anyAccepted = all.some((p) => p.status === "accepted");
      const allTerminal = all.every(
        (p) => p.status !== "ringing" && p.status !== "accepted",
      );

      let aggregate: CallStatus = "ringing";
      if (anyAccepted) aggregate = "accepted";
      if (allTerminal) aggregate = "ended";

      const callForBubble = await tx.call.update({
        where: { id: callId },
        data: {
          status: aggregate,
          ...(aggregate === "ended" ? { endedAt: now } : {}),
          ...(aggregate === "accepted" ? { acceptedAt: now } : {}),
        },
        select: { callType: true },
      });

      // v4.15.17: fan the aggregate-status update to every per-thread
      // bubble. Without this, the bubbles in callees' chats would
      // stay stuck on "ringing" until refresh.
      await tx.message.updateMany({
        where: { callId, type: "call" },
        data: {
          content: JSON.stringify({
            kind: "call",
            callType: callForBubble.callType,
            status: aggregate,
            callId,
            isGroup: true,
          }),
        },
      });
    });

    addBreadcrumb("call.group.update", { callId, actorId, partNext });
    return { ok: true, reason: "OK", status: partNext as CallStatus };
  } catch (err) {
    reportError(err, { context: "call.group.update", callId, actorId, partNext });
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
      isGroup: true,
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

/**
 * v4.15.12 (Sprint 6): is a given user authorized to participate in a
 * given call? True for the caller, and for any CallParticipant row.
 *
 * Used by the token endpoint instead of the old `callerId === me ||
 * calleeId === me` check so group calls work without a separate path.
 */
export async function isCallParticipant(callId: string, userId: string): Promise<boolean> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    select: { callerId: true },
  });
  if (!call) return false;
  if (call.callerId === userId) return true;
  const part = await prisma.callParticipant.findUnique({
    where: { callId_userId: { callId, userId } },
    select: { id: true },
  });
  return !!part;
}

/**
 * v4.15.12 (Sprint 6): create a group call with multiple invitees.
 *
 * Rule of 7: max 6 callees (7 total with caller). Caller must not be
 * in the callee list. Duplicates are deduped. All callees are pre-
 * validated as real users.
 *
 * For groups we DON'T write a chat-thread Message (the call doesn't
 * "belong" to any one peer's thread). The Call History sheet is the
 * surface; v4.15.13 may add a per-thread bubble per participant.
 */
export async function createGroupCall(args: {
  callerId: string;
  calleeIds: string[];
  callType: CallType;
}): Promise<CreateCallResult> {
  const { callerId, callType } = args;

  // Dedupe + drop self + cap.
  let calleeIds = Array.from(
    new Set(args.calleeIds.filter((id) => id && id !== callerId)),
  );

  if (calleeIds.length < 2) {
    return { ok: false, reason: "INVALID_TARGET" };
  }
  if (calleeIds.length > MAX_CALL_PARTICIPANTS - 1) {
    return { ok: false, reason: "INVALID_TARGET" };
  }

  // v4.15.13 (Sprint 7): block-list integration. Silently drop blocked
  // users from the recipient list (either direction). If too few
  // remain after filtering, reject as INVALID_TARGET — the caller may
  // have built the picker from a stale contact list.
  calleeIds = await filterUnblocked(callerId, calleeIds);
  if (calleeIds.length < 2) {
    return { ok: false, reason: "INVALID_TARGET" };
  }

  // Pre-validate all callees exist. Cheap batch lookup.
  const found = await prisma.user.findMany({
    where: { id: { in: calleeIds } },
    select: { id: true },
  });
  if (found.length !== calleeIds.length) {
    return { ok: false, reason: "RECIPIENT_NOT_FOUND" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Create Call (isGroup=true). First callee is recorded as Call.calleeId
      // for backwards compatibility — the full list lives in
      // CallParticipant.
      const call = await tx.call.create({
        data: {
          callerId,
          calleeId: calleeIds[0],
          isGroup: true,
          callType,
          status: "ringing",
          room: "pending",
        },
        select: { id: true },
      });

      const room = roomNameFor(callerId, calleeIds[0], call.id);

      // Write a CallParticipant row per callee. Caller is NOT in the
      // participant table (they're Call.callerId).
      await tx.callParticipant.createMany({
        data: calleeIds.map((userId) => ({
          callId: call.id,
          userId,
          status: "ringing",
        })),
      });

      // v4.15.17: write one chat-thread Message per (caller, callee)
      // pair so each callee sees a "Group call" bubble in their
      // thread with the caller. All N messages share callId so a
      // status flip updates them in one query.
      await tx.message.createMany({
        data: calleeIds.map((userId) => ({
          senderId: callerId,
          receiverId: userId,
          type: "call" as const,
          callId: call.id,
          content: JSON.stringify({
            kind: "call",
            callType,
            status: "ringing",
            callId: call.id,
            isGroup: true,
            participantCount: calleeIds.length + 1, // +1 for caller
          }),
          deliveredAt: new Date(),
        })),
      });

      const updated = await tx.call.update({
        where: { id: call.id },
        data: { room },
        select: { id: true, room: true },
      });

      return { callId: updated.id, room: updated.room };
    });

    addBreadcrumb("call.create_group.ok", {
      callId: result.callId,
      callerId,
      callType,
      participantCount: calleeIds.length,
    });

    // Push fanout to all callees — best-effort, same shape as 1:1 path.
    void (async () => {
      try {
        const [callerRow, subs] = await Promise.all([
          prisma.user.findUnique({
            where: { id: callerId },
            select: { displayName: true },
          }),
          prisma.pushSubscription.findMany({
            where: { userId: { in: calleeIds } },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          }),
        ]);
        if (!subs.length) return;
        const callerName = callerRow?.displayName ?? "Someone";
        const body =
          callType === "video"
            ? `${callerName} is starting a group video call`
            : `${callerName} is starting a group call`;

        const results = await Promise.all(
          subs.map((s) =>
            sendPush(
              { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
              {
                title: "Group call",
                body,
                url: "/app",
                tag: `call:${result.callId}`,
                data: {
                  kind: "call",
                  callId: result.callId,
                  callType,
                  callerId,
                  isGroup: true,
                },
              },
            ).then((r) => ({ id: s.id, ...r })),
          ),
        );
        const expired = results.filter((r) => r.expired).map((r) => r.id);
        if (expired.length) {
          await prisma.pushSubscription
            .deleteMany({ where: { id: { in: expired } } })
            .catch(() => undefined);
        }
      } catch (err) {
        console.warn("[call.create_group push] failed:", err instanceof Error ? err.message : err);
      }
    })();

    return { ok: true, reason: "OK", ...result };
  } catch (err) {
    reportError(err, { context: "call.create_group", callerId, calleeCount: calleeIds.length, callType });
    return { ok: false, reason: "ERROR" };
  }
}
