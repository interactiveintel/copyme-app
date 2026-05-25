import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getInbox } from "@/lib/redis";

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
    // Single contact: return last 7 messages
    // -----------------------------------------------------------------
    if (contactId) {
      // Try cache first
      const cached = await getInbox(auth.userId, contactId).catch(() => null);
      if (cached) {
        return NextResponse.json({ success: true, data: cached });
      }

      const messages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: auth.userId, receiverId: contactId },
            { senderId: contactId, receiverId: auth.userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 7,
        include: {
          sender: { select: { id: true, displayName: true } },
          receiver: { select: { id: true, displayName: true } },
        },
      });

      return NextResponse.json({ success: true, data: messages });
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
