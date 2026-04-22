import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { invalidateInbox } from "@/lib/redis";

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
    if (body.peerId) {
      await invalidateInbox(auth.userId, body.peerId).catch(() => {});
    } else if (body.messageIds?.length) {
      const rows = await prisma.message.findMany({
        where: { id: { in: body.messageIds } },
        select: { senderId: true },
      });
      const peers = Array.from(new Set(rows.map((r) => r.senderId)));
      await Promise.all(
        peers.map((p) => invalidateInbox(auth.userId, p).catch(() => {})),
      );
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
