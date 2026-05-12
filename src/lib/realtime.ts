// Realtime delivery — Redis pub/sub fan-out (A5).
//
// Architecture:
// - /api/messages/send → publishMessageEvent(receiverId, ...) after DB insert
//   → also publishes to senderId for multi-device echo
// - /api/messages/stream subscribes to msg:<userId> with an abort signal
//   tied to the HTTP request close → emits SSE frames as events arrive
// - One subscriber connection per stream invocation. Upstash TCP pub/sub
//   handles thousands of concurrent subs; well within Phase 1 envelope.
//
// Reliability primitives:
// - Best-effort publish (never blocks /api/messages/send on a Redis miss)
// - Subscribe waits for connection ready before pulling from the channel
// - Each subscriber gets a unique ID so we can observe per-connection
//   lifecycle in breadcrumbs
// - Graceful unsubscribe + quit on abort
//
// Why ioredis here and not the REST client: REST does not support
// long-lived pub/sub. We use the TCP `REDIS_URL` env that Upstash
// auto-injects when the store is linked.

import Redis from "ioredis";
import { randomBytes } from "node:crypto";
import { addBreadcrumb, reportError } from "@/lib/observability";

const REDIS_URL = process.env.REDIS_URL;

export type RealtimeEventType = "message" | "read_receipt" | "delivery_receipt";

export interface MessageEvent {
  type: "message";
  /** Globally unique event id; consumers can use this as Last-Event-ID. */
  eventId: string;
  /** Server timestamp. */
  ts: number;
  /** The newly inserted Message id. */
  messageId: string;
  /** Sender / receiver ids — caller can filter by conversation. */
  senderId: string;
  receiverId: string;
  /** Used by the client to scope a subscription to a single thread. */
  contactId: string;
  /** Text content (or null for media). The full row is still fetched from
   *  the DB on the client's next inbox poll for full fidelity. */
  preview: string | null;
  type_: "text" | "image" | "voice" | "video";
  createdAt: string;
}

export interface ReadReceiptEvent {
  type: "read_receipt";
  eventId: string;
  ts: number;
  /** Whose messages have been read. */
  senderId: string;
  /** Who read them. */
  readerId: string;
  /** Up-to message id that has been read. */
  upToMessageId: string;
}

export type RealtimeEvent = MessageEvent | ReadReceiptEvent;

// -------------------------------------------------------------------------
// Channels
// -------------------------------------------------------------------------

/** All messages destined to a given user. */
function channelForUser(userId: string): string {
  return `rt:user:${userId}`;
}

// -------------------------------------------------------------------------
// Publish (called from /api/messages/send + /api/messages/mark-read)
// -------------------------------------------------------------------------

let _publisher: Redis | null = null;
function publisher(): Redis | null {
  if (!REDIS_URL) return null;
  if (_publisher) return _publisher;
  _publisher = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    keepAlive: 10_000,
  });
  _publisher.on("error", (err) => {
    addBreadcrumb("realtime.publisher_error", { msg: err.message });
  });
  return _publisher;
}

function nextEventId(): string {
  // 24 random bytes → 32 base64url chars. Acceptable as Last-Event-ID.
  return randomBytes(24).toString("base64url");
}

/** Fire-and-forget. Never blocks the caller. */
export async function publishMessageEvent(
  receiverId: string,
  senderId: string,
  payload: {
    messageId: string;
    contactId: string;
    preview: string | null;
    type_: "text" | "image" | "voice" | "video";
    createdAt: string;
  },
): Promise<void> {
  const p = publisher();
  if (!p) return;
  const event: MessageEvent = {
    type: "message",
    eventId: nextEventId(),
    ts: Date.now(),
    messageId: payload.messageId,
    senderId,
    receiverId,
    contactId: payload.contactId,
    preview: payload.preview,
    type_: payload.type_,
    createdAt: payload.createdAt,
  };
  const json = JSON.stringify(event);
  // Publish to receiver AND sender (multi-device echo for the sender).
  try {
    await Promise.all([
      p.publish(channelForUser(receiverId), json),
      receiverId === senderId ? null : p.publish(channelForUser(senderId), json),
    ]);
  } catch (err) {
    // Pub/sub failures are non-fatal — the message is already in the DB
    // and the receiver will get it on next inbox poll.
    addBreadcrumb("realtime.publish_failed", { reason: (err as Error).message });
  }
}

export async function publishReadReceipt(
  senderId: string,
  readerId: string,
  upToMessageId: string,
): Promise<void> {
  const p = publisher();
  if (!p) return;
  const event: ReadReceiptEvent = {
    type: "read_receipt",
    eventId: nextEventId(),
    ts: Date.now(),
    senderId,
    readerId,
    upToMessageId,
  };
  try {
    await p.publish(channelForUser(senderId), JSON.stringify(event));
  } catch (err) {
    addBreadcrumb("realtime.publish_read_failed", { reason: (err as Error).message });
  }
}

// -------------------------------------------------------------------------
// Subscribe (called from /api/messages/stream)
// -------------------------------------------------------------------------

export interface SubscribeOpts {
  userId: string;
  /** Optional — when set, the consumer's iterator only yields events
   *  whose `contactId` matches this. Other events are silently dropped. */
  filterContactId?: string;
  /** Abort the subscriber loop when this fires (HTTP connection closed). */
  abortSignal: AbortSignal;
}

/** AsyncIterable of decoded RealtimeEvent. */
export async function* subscribeToUserEvents(
  opts: SubscribeOpts,
): AsyncGenerator<RealtimeEvent> {
  if (!REDIS_URL) return;

  const channel = channelForUser(opts.userId);
  // Dedicated subscriber — ioredis forbids issuing other commands on a
  // connection that's in subscriber mode.
  const sub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    keepAlive: 10_000,
  });
  const subId = randomBytes(6).toString("hex");
  addBreadcrumb("realtime.subscriber_opened", { userId: opts.userId, subId });

  // Wire abort: when the HTTP request closes, tear down the subscriber.
  const cleanup = () => {
    try { sub.disconnect(); } catch { /* noop */ }
    addBreadcrumb("realtime.subscriber_closed", { userId: opts.userId, subId });
  };
  opts.abortSignal.addEventListener("abort", cleanup, { once: true });

  // Queue events as they arrive; the generator yields from this queue.
  const queue: RealtimeEvent[] = [];
  let resolveWake: (() => void) | null = null;
  const wake = () => {
    if (resolveWake) {
      const r = resolveWake;
      resolveWake = null;
      r();
    }
  };

  sub.on("message", (_ch, message) => {
    try {
      const ev = JSON.parse(message) as RealtimeEvent;
      if (opts.filterContactId && ev.type === "message") {
        if (ev.contactId !== opts.filterContactId) return;
      }
      queue.push(ev);
      wake();
    } catch (err) {
      reportError(err, { context: "realtime_decode" });
    }
  });
  sub.on("error", (err) => {
    addBreadcrumb("realtime.subscriber_error", { subId, msg: err.message });
  });

  try {
    await sub.subscribe(channel);
  } catch (err) {
    cleanup();
    reportError(err, { context: "realtime_subscribe", userId: opts.userId });
    return;
  }

  try {
    while (!opts.abortSignal.aborted) {
      // Drain queue
      while (queue.length > 0) {
        const ev = queue.shift()!;
        yield ev;
      }
      // Wait for the next event OR abort
      await new Promise<void>((resolve) => {
        resolveWake = resolve;
        opts.abortSignal.addEventListener("abort", () => resolve(), { once: true });
      });
    }
  } finally {
    cleanup();
  }
}
