import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import {
  validateMessageContent,
  validateMediaCount,
  validateDuration,
  LIMITS,
} from "@/lib/ruleOf7";
import { cacheInbox } from "@/lib/redis";
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";

// ---------------------------------------------------------------------------
// POST /api/messages/send
// ---------------------------------------------------------------------------

interface SendMessageBody {
  receiverId: string;
  type: "text" | "image" | "voice" | "video";
  content?: string;
  mediaUrls?: string[];
  durationSeconds?: number;
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
    const body = (await request.json()) as SendMessageBody;

    // --- Validate required fields -------------------------------------------
    if (!body.receiverId || !body.type) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_FIELDS", message: "receiverId and type are required" } },
        { status: 400 },
      );
    }

    // --- Cannot message yourself --------------------------------------------
    if (body.receiverId === auth.userId) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_RECEIVER", message: "Cannot send a message to yourself" } },
        { status: 400 },
      );
    }

    // --- Validate receiver exists -------------------------------------------
    const receiver = await prisma.user.findUnique({
      where: { id: body.receiverId },
      select: { id: true },
    });
    if (!receiver) {
      return NextResponse.json(
        { success: false, error: { code: "RECEIVER_NOT_FOUND", message: "Receiver does not exist" } },
        { status: 404 },
      );
    }

    // --- Get sender tier for limit checks -----------------------------------
    const sender = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { accountTier: true },
    });
    const tier = sender?.accountTier ?? "basic";

    // --- Validate text content (Rule of 7: max 70 words) --------------------
    if (body.content) {
      const textCheck = validateMessageContent(body.content, tier);
      if (!textCheck.valid) {
        return NextResponse.json(
          { success: false, error: { code: "CONTENT_TOO_LONG", message: textCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Validate media count (max 7 items) ---------------------------------
    if (body.mediaUrls && body.mediaUrls.length > 0) {
      const mediaCheck = validateMediaCount(body.mediaUrls.length);
      if (!mediaCheck.valid) {
        return NextResponse.json(
          { success: false, error: { code: "TOO_MANY_MEDIA", message: mediaCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Validate duration (max 70 seconds) ---------------------------------
    if (body.durationSeconds !== undefined) {
      const durationCheck = validateDuration(body.durationSeconds);
      if (!durationCheck.valid) {
        return NextResponse.json(
          { success: false, error: { code: "DURATION_TOO_LONG", message: durationCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Check inbox limit (7 messages per contact) + first-message check --
    // Count total messages in this conversation for the cycling cap.
    const existingCount = await prisma.message.count({
      where: {
        OR: [
          { senderId: auth.userId, receiverId: body.receiverId },
          { senderId: body.receiverId, receiverId: auth.userId },
        ],
      },
    });

    // Count the sender's prior messages (any recipient) so we can fire the
    // `first_message` event exactly once per lifetime.
    const priorSenderMessages = await prisma.message.count({
      where: { senderId: auth.userId },
    });

    // How many messages has the sender sent to THIS contact before?
    const priorFromSenderToReceiver = await prisma.message.count({
      where: { senderId: auth.userId, receiverId: body.receiverId },
    });

    const inboxLimit = LIMITS.BASIC.inboxPerContact;
    if (existingCount >= inboxLimit) {
      // Delete oldest messages to maintain the 7-message window
      const oldMessages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: auth.userId, receiverId: body.receiverId },
            { senderId: body.receiverId, receiverId: auth.userId },
          ],
        },
        orderBy: { createdAt: "asc" },
        take: existingCount - inboxLimit + 1,
        select: { id: true },
      });

      if (oldMessages.length > 0) {
        await prisma.message.deleteMany({
          where: { id: { in: oldMessages.map((m: { id: string }) => m.id) } },
        });
      }
    }

    // --- Create the message -------------------------------------------------
    // We stamp deliveredAt at creation time because our message fan-out is
    // polling-based (no realtime socket). The message has "arrived" at the
    // server as soon as this row exists; the recipient will see it on their
    // next inbox poll. Read receipts still require the recipient to open
    // the conversation — see POST /api/messages/mark-read.
    const message = await prisma.message.create({
      data: {
        senderId: auth.userId,
        receiverId: body.receiverId,
        type: body.type,
        content: body.content ?? null,
        mediaUrls: body.mediaUrls ?? undefined,
        durationSeconds: body.durationSeconds ?? null,
        deliveredAt: new Date(),
      },
    });

    // --- Analytics --------------------------------------------------------
    // First ever message for this user → first_message. Exactly once per
    // user lifetime (priorSenderMessages was counted BEFORE create).
    if (priorSenderMessages === 0) {
      capture(auth.userId, ANALYTICS_EVENTS.FirstMessage, {
        type: body.type,
      });
    }
    // Cycle completed: this send brings the sender's count TO this peer up
    // to 7. We only fire on the transition (exactly == 7), not each message
    // past it.
    if (priorFromSenderToReceiver + 1 === LIMITS.BASIC.inboxPerContact) {
      capture(auth.userId, ANALYTICS_EVENTS.CycleCompleted, {
        peerId: body.receiverId,
      });
    }

    // --- Update inbox cache -------------------------------------------------
    try {
      const recentMessages = await prisma.message.findMany({
        where: {
          OR: [
            { senderId: auth.userId, receiverId: body.receiverId },
            { senderId: body.receiverId, receiverId: auth.userId },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 7,
      });
      await cacheInbox(auth.userId, body.receiverId, recentMessages);
      await cacheInbox(body.receiverId, auth.userId, recentMessages);
    } catch {
      // Redis unavailable — degrade gracefully
    }

    return NextResponse.json(
      { success: true, data: message },
      { status: 201 },
    );
  } catch (error) {
    console.error("[messages/send] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
