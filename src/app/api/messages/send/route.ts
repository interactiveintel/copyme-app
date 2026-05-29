import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import {
  validateMessageContent,
  validateMediaCount,
  validateDuration,
} from "@/lib/ruleOf7";
import { recordCapHit } from "@/lib/ruleOf7-metrics";
import { cacheInbox } from "@/lib/redis";
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";
import { bumpStreak } from "@/lib/streak";
import { sendPush } from "@/lib/push";
import { publishMessageEvent } from "@/lib/realtime";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
// v4.16.3 (F6b): per-pair retention policy. Replaces the hardcoded
// LIMITS.BASIC.inboxPerContact below with a tier-aware lookup.
import { policyForPair, cutoffFor } from "@/lib/messages-retention";

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

  // --- Per-user rate limit: 30 messages/minute ----------------------------
  // Combined user+IP key so a compromised token shared across multiple
  // IPs still hits the cap from each, while a normal user on one IP gets
  // a tight ceiling that's high enough for real conversation bursts.
  const ip = clientIpFromRequest(request);
  const rl = await rateLimit(`msg:send:${auth.userId}:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", retryAfterMs: rl.retryAfterMs } },
      { status: 429 },
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

    // --- Validate receiver exists + grab their locale for translation -------
    const receiver = await prisma.user.findUnique({
      where: { id: body.receiverId },
      select: { id: true, preferredLocale: true },
    });
    if (!receiver) {
      return NextResponse.json(
        { success: false, error: { code: "RECEIVER_NOT_FOUND", message: "Receiver does not exist" } },
        { status: 404 },
      );
    }

    // --- Get sender tier + locale -------------------------------------------
    const sender = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { accountTier: true, preferredLocale: true },
    });
    const tier = sender?.accountTier ?? "basic";
    const senderLocale = sender?.preferredLocale ?? "en";
    const receiverLocale = receiver.preferredLocale;

    // --- Validate text content (Rule of 7: max 70 words) — S-111 ------------
    if (body.content) {
      const textCheck = validateMessageContent(body.content, tier);
      if (!textCheck.valid) {
        recordCapHit("word", tier);
        return NextResponse.json(
          { success: false, error: { code: "RULE_OF_7_WORD_CAP", message: textCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Validate media count (max 7 items) — S-113 -------------------------
    if (body.mediaUrls && body.mediaUrls.length > 0) {
      const mediaCheck = validateMediaCount(body.mediaUrls.length);
      if (!mediaCheck.valid) {
        recordCapHit("media", tier);
        return NextResponse.json(
          { success: false, error: { code: "RULE_OF_7_MEDIA_CAP", message: mediaCheck.error! } },
          { status: 400 },
        );
      }
    }

    // --- Validate duration (max 70 seconds) — S-114 -------------------------
    if (body.durationSeconds !== undefined) {
      const durationCheck = validateDuration(body.durationSeconds);
      if (!durationCheck.valid) {
        recordCapHit("duration", tier);
        return NextResponse.json(
          { success: false, error: { code: "RULE_OF_7_DURATION_CAP", message: durationCheck.error! } },
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

    // v4.16.3 (F6b): per-pair retention. Basic↔Basic stays count-based
    // (delete oldest until 7 remain — the brand promise). Any side at
    // Pro/Business/Premium flips the pair to a time-based window
    // (7w or 70w), enforced here on every send AND nightly via cron
    // for idle conversations.
    const pairPolicy = await policyForPair(auth.userId, body.receiverId);
    const pairFilter = {
      OR: [
        { senderId: auth.userId, receiverId: body.receiverId },
        { senderId: body.receiverId, receiverId: auth.userId },
      ],
    };

    if (pairPolicy.mode === "count" && existingCount >= pairPolicy.value) {
      // Delete oldest messages to maintain the count-based window.
      const oldMessages = await prisma.message.findMany({
        where: pairFilter,
        orderBy: { createdAt: "asc" },
        take: existingCount - pairPolicy.value + 1,
        select: { id: true },
      });

      if (oldMessages.length > 0) {
        await prisma.message.deleteMany({
          where: { id: { in: oldMessages.map((m: { id: string }) => m.id) } },
        });
      }
    } else if (pairPolicy.mode === "time") {
      // Sweep anything older than the window. Cheap — indexed scan on
      // (senderId, createdAt) / (receiverId, createdAt).
      const cutoff = cutoffFor(pairPolicy)!;
      await prisma.message.deleteMany({
        where: {
          ...pairFilter,
          createdAt: { lt: cutoff },
        },
      });
    }

    // --- Translation (A3) ---------------------------------------------------
    // If the receiver prefers a different locale from the sender, ask
    // Claude Haiku for a translation. Helpers short-circuit on identical
    // locales, very short text, cache hit, or daily budget exhaustion —
    // failure path returns the original (translatedText=null).
    let languageOriginal: string | null = null;
    let languageTranslated: string | null = null;
    let translatedText: string | null = null;

    if (body.type === "text" && body.content && senderLocale !== receiverLocale) {
      const { translate, detectLocaleHeuristic } = await import("@/lib/translation");
      languageOriginal = senderLocale === "auto" ? detectLocaleHeuristic(body.content) : senderLocale;
      const tr = await translate({
        text: body.content,
        fromLocale: languageOriginal,
        toLocale: receiverLocale,
        userId: auth.userId,
      });
      if (tr.text !== body.content) {
        languageTranslated = receiverLocale;
        translatedText = tr.text;
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
        languageOriginal,
        languageTranslated,
        translatedText,
      },
    });

    // --- Streak: sending a message counts as activity --------------------
    // Non-blocking; streak errors must never block a send.
    bumpStreak(auth.userId).catch(() => {});

    // --- Realtime fan-out (A5) ------------------------------------------
    // Fire-and-forget. Polling fallback in ChatScreen still ensures
    // delivery if Redis is down.
    void publishMessageEvent(body.receiverId, auth.userId, {
      messageId: message.id,
      contactId: body.receiverId,
      preview: (translatedText ?? body.content ?? "").slice(0, 280) || null,
      type_: body.type,
      createdAt: message.createdAt.toISOString(),
    });

    // --- Web Push to the recipient --------------------------------------
    // Fire-and-forget. If VAPID isn't configured, sendPush is a no-op.
    // We look up the sender's name for the notification title and strip
    // any too-long content for the preview.
    void (async () => {
      try {
        const [senderRow, subs] = await Promise.all([
          prisma.user.findUnique({
            where: { id: auth.userId },
            select: { displayName: true },
          }),
          prisma.pushSubscription.findMany({
            where: { userId: body.receiverId },
            select: { id: true, endpoint: true, p256dh: true, auth: true },
          }),
        ]);
        if (!subs.length) return;

        const preview =
          body.type === "text"
            ? (body.content ?? "").slice(0, 120)
            : body.type === "image"
              ? "Sent you an image"
              : body.type === "voice"
                ? "Sent you a voice message"
                : "Sent you a video message";

        const results = await Promise.all(
          subs.map((s) =>
            sendPush(
              { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
              {
                title: senderRow?.displayName ?? "New message",
                body: preview,
                url: "/app",
                tag: `msg:${auth.userId}:${body.receiverId}`,
              },
            ).then((r) => ({ id: s.id, ...r })),
          ),
        );
        // Garbage-collect expired subscriptions so we don't keep trying.
        const expired = results.filter((r) => r.expired).map((r) => r.id);
        if (expired.length) {
          await prisma.pushSubscription
            .deleteMany({ where: { id: { in: expired } } })
            .catch(() => {});
        }
      } catch (err) {
        console.warn("[messages/send push] failed:", err instanceof Error ? err.message : err);
      }
    })();

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
    // past it. v4.16.3 (F6b): the "cycle" semantic only applies to
    // count-mode pairs — for time-mode (paid tier), the 7-msg threshold
    // is no longer meaningful, so we skip the event there.
    if (
      pairPolicy.mode === "count" &&
      priorFromSenderToReceiver + 1 === pairPolicy.value
    ) {
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
