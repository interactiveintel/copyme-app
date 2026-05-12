import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { invalidateInbox } from "@/lib/redis";
import { publishReadReceipt } from "@/lib/realtime";

// ---------------------------------------------------------------------------
// POST /api/messages/mark-read
//
// Body (choose one):
//   { peerId: string }            — mark ALL messages from this peer as read
//   { messageIds: string[] }      — mark specific messages as read
//
// Only messages where the authenticated user is the RECEIVER are updated.
// Idempotent — already-read messages are simply skipped.
// ---------------------------------------------------------------------------

interface MarkReadBody {
  peerId?: string;
  messageIds?: string[];
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as MarkReadBody;

    if (!body.peerId && (!body.messageIds || body.messageIds.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FIELDS", message: "peerId or messageIds required" },
        },
        { status: 400 },
      );
    }

    const now = new Date();

    const where = body.peerId
      ? {
          senderId: body.peerId,
          receiverId: auth.userId,
          readAt: null,
        }
      : {
          id: { in: body.messageIds! },
          receiverId: auth.userId,
          readAt: null,
        };

    const result = await prisma.message.updateMany({
      where,
      data: { readAt: now },
    });

    // Find peer(s) affected so we can invalidate their inbox cache pairs.
    // (Not strictly necessary if only the reader fetches — but keeps the
    // cache correct if either side of the conversation polls the cached
    // single-contact view.)
    let affectedPeers: string[] = [];
    if (body.peerId) {
      affectedPeers = [body.peerId];
      await invalidateInbox(auth.userId, body.peerId).catch(() => {});
    } else if (body.messageIds?.length) {
      const rows = await prisma.message.findMany({
        where: { id: { in: body.messageIds } },
        select: { senderId: true, id: true },
      });
      affectedPeers = Array.from(new Set(rows.map((r) => r.senderId)));
      await Promise.all(
        affectedPeers.map((p) => invalidateInbox(auth.userId, p).catch(() => {})),
      );
    }

    // Realtime read receipts (A5) — tell each sender that we just read
    // (up to) their most recent message in our pair. Fire-and-forget.
    if (result.count > 0) {
      const upToById = await prisma.message.findFirst({
        where: body.peerId
          ? { senderId: body.peerId, receiverId: auth.userId, readAt: now }
          : { id: { in: body.messageIds! }, receiverId: auth.userId, readAt: now },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (upToById) {
        for (const peer of affectedPeers) {
          void publishReadReceipt(peer, auth.userId, upToById.id);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { updated: result.count, readAt: now.toISOString() },
    });
  } catch (error) {
    console.error("[mark-read] error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to mark as read" } },
      { status: 500 },
    );
  }
}
