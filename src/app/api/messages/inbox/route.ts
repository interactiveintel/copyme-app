import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getInbox } from "@/lib/redis";
// v4.16.3 (F6b): tier-aware retention window. Basic stays at the
// hardcoded 7-msg count; Pro/Business/Premium switch to time-based
// (7w / 70w). The Redis cache only ever stores 7 msgs, so we bypass
// it for time-mode pairs to avoid truncating their active window.
import { policyForPair, cutoffFor, TIME_FETCH_CAP } from "@/lib/messages-retention";

// Auth-bound, per-user inbox. Defensive force-dynamic.
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/messages/inbox
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");

    // -----------------------------------------------------------------
    // Single contact: return messages within the pair's retention
    // window. Count-mode (Basic↔Basic) → last 7; time-mode (any paid
    // tier on either side) → everything from the last 7w / 70w.
    // v4.16.5 (F6b polish): the response also includes the effective
    // policy so the ChatScreen header can render a "7 weeks · Premium
    // pair" badge — letting users see WHY their window expanded.
    // -----------------------------------------------------------------
    if (contactId) {
      const policy = await policyForPair(auth.userId, contactId);
      // Public-safe slice of the policy (no tier raw string). The
      // header badge only needs mode + value + label.
      const policyPayload = {
        mode: policy.mode,
        value: policy.value,
        label: policy.label,
      };

      // Cache only stores last 7 — safe for count-mode, lossy for
      // time-mode (Basic↔Premium would otherwise see only 7 out of
      // 70 weeks of messages). Skip cache for time-mode pairs.
      if (policy.mode === "count") {
        const cached = await getInbox(auth.userId, contactId).catch(() => null);
        if (cached) {
          return NextResponse.json({ success: true, data: cached, policy: policyPayload });
        }
      }

      const baseWhere = {
        OR: [
          { senderId: auth.userId, receiverId: contactId },
          { senderId: contactId, receiverId: auth.userId },
        ],
      };

      const messages = await prisma.message.findMany({
        where:
          policy.mode === "time"
            ? { ...baseWhere, createdAt: { gte: cutoffFor(policy)! } }
            : baseWhere,
        orderBy: { createdAt: "desc" },
        take: policy.mode === "count" ? policy.value : TIME_FETCH_CAP,
        include: {
          sender: { select: { id: true, displayName: true } },
          receiver: { select: { id: true, displayName: true } },
        },
      });

      return NextResponse.json({ success: true, data: messages, policy: policyPayload });
    }

    // -----------------------------------------------------------------
    // No contactId: return contact list with last message preview +
    // unread count per conversation.
    // -----------------------------------------------------------------

    const sentMessages = await prisma.message.findMany({
      where: { senderId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        receiverId: true,
        type: true,
        content: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        receiver: { select: { id: true, displayName: true } },
      },
    });

    const receivedMessages = await prisma.message.findMany({
      where: { receiverId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        senderId: true,
        type: true,
        content: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        sender: { select: { id: true, displayName: true } },
      },
    });

    // Unread count per peer (messages received by me that I haven't read).
    const unreadPerPeer = new Map<string, number>();
    for (const m of receivedMessages) {
      if (!m.readAt) {
        unreadPerPeer.set(m.senderId, (unreadPerPeer.get(m.senderId) ?? 0) + 1);
      }
    }

    type LastMessage = {
      id: string;
      type: string;
      content: string | null;
      createdAt: Date;
      deliveredAt: Date | null;
      readAt: Date | null;
      direction: "sent" | "received";
    };

    const contactMap = new Map<
      string,
      {
        contactId: string;
        contactName: string;
        unreadCount: number;
        lastMessage: LastMessage;
      }
    >();

    for (const msg of sentMessages) {
      const existing = contactMap.get(msg.receiverId);
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        contactMap.set(msg.receiverId, {
          contactId: msg.receiverId,
          contactName: msg.receiver.displayName,
          unreadCount: unreadPerPeer.get(msg.receiverId) ?? 0,
          lastMessage: {
            id: msg.id,
            type: msg.type,
            content: msg.content,
            createdAt: msg.createdAt,
            deliveredAt: msg.deliveredAt,
            readAt: msg.readAt,
            direction: "sent",
          },
        });
      }
    }

    for (const msg of receivedMessages) {
      const existing = contactMap.get(msg.senderId);
      if (!existing || msg.createdAt > existing.lastMessage.createdAt) {
        contactMap.set(msg.senderId, {
          contactId: msg.senderId,
          contactName: msg.sender.displayName,
          unreadCount: unreadPerPeer.get(msg.senderId) ?? 0,
          lastMessage: {
            id: msg.id,
            type: msg.type,
            content: msg.content,
            createdAt: msg.createdAt,
            deliveredAt: msg.deliveredAt,
            readAt: msg.readAt,
            direction: "received",
          },
        });
      }
    }

    const conversations = Array.from(contactMap.values()).sort(
      (a, b) =>
        b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime(),
    );

    return NextResponse.json({ success: true, data: conversations });
  } catch (error) {
    console.error("[messages/inbox] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
