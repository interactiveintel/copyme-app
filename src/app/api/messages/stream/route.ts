// GET /api/messages/stream — server-sent events for realtime messaging (A5).
//
// Auth: Bearer token in Authorization header (same as the rest of the
// app). EventSource doesn't support custom headers, so the client uses
// fetch() + ReadableStream and parses SSE manually — see useMessageStream.
//
// Query: ?contactId=<uuid>  — optional; when set, only events for this
//                             conversation are emitted.
//        ?since=<ms>        — optional; replays messages newer than this
//                             timestamp from the DB before going live.
//                             Used after reconnect to bridge the gap.
//
// Lifecycle: server holds the connection up to 55s, with a 15s heartbeat
// keep-alive (":" comment frames). At 55s the server sends a final
// `event: bye` frame and closes; client auto-reconnects with the last
// event id.
//
// Rate limit: max 7 concurrent stream connections per user (Rule of 7
// echoed). Beyond that, the endpoint returns 429.
//
// Feature flag: `COPYME_FLAG_REALTIME=1` to enable. When unset, the
// endpoint returns 503 and the client falls back to the existing 3-second
// polling loop in ChatScreen.

import { NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import { subscribeToUserEvents, type RealtimeEvent } from "@/lib/realtime";
import { addBreadcrumb } from "@/lib/observability";

export const runtime = "nodejs";
// Hold the connection up to 60s; client reconnects after each cycle so we
// stay well inside Vercel's function execution envelope.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const STREAM_LIFETIME_MS = 55_000;
const HEARTBEAT_MS = 15_000;
const MAX_CONCURRENT_PER_USER = 7;

function encoder() {
  return new TextEncoder();
}

function sseLine(field: string, value: string): string {
  // SSE values containing newlines must be split across multiple `data:` lines.
  return value
    .split("\n")
    .map((line) => `${field}: ${line}\n`)
    .join("");
}

function sseEvent(event: RealtimeEvent): string {
  return `${sseLine("id", event.eventId)}${sseLine("event", event.type)}${sseLine("data", JSON.stringify(event))}\n`;
}

export async function GET(req: NextRequest) {
  // 1. Feature gate
  if (process.env.COPYME_FLAG_REALTIME !== "1") {
    return new Response(
      JSON.stringify({ error: "REALTIME_DISABLED" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // 2. Auth
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) {
    return new Response(
      JSON.stringify({ error: "UNAUTH" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  // 3. Concurrency cap — per-user sliding-window over a 60s tracker key.
  // We use the same Redis sliding-window primitive so this works whether
  // Redis is healthy or in memory-fallback.
  const rl = await rateLimit(`stream:user:${auth.userId}`, MAX_CONCURRENT_PER_USER, 60_000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "TOO_MANY_STREAMS", retryAfterMs: rl.retryAfterMs }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }
  await rateLimit(`stream:ip:${clientIpFromRequest(req)}`, 30, 60_000); // soft ceiling

  // 4. Parse query
  const url = new URL(req.url);
  const contactId = url.searchParams.get("contactId") || undefined;
  const sinceParam = url.searchParams.get("since");
  const sinceMs = sinceParam ? Number(sinceParam) : null;

  addBreadcrumb("realtime.stream_opened", {
    userId: auth.userId,
    contactId: contactId ?? "all",
    replayFromMs: sinceMs ?? 0,
  });

  const enc = encoder();

  // 5. Build the streaming Response
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* already closed */ }
      };

      // Tie subscriber lifecycle to the HTTP request close + our timeout.
      const abortCtrl = new AbortController();
      const reqAbort = (req as unknown as { signal?: AbortSignal }).signal;
      if (reqAbort) {
        reqAbort.addEventListener("abort", () => abortCtrl.abort(), { once: true });
      }

      // 5a. Opening preamble — gives the client an immediate signal.
      try {
        controller.enqueue(enc.encode(`retry: 3000\n\n:open ${startedAt}\n\n`));
      } catch {
        close();
        return;
      }

      // 5b. Replay any messages the client missed during the disconnect
      // gap. We use Message.createdAt > sinceMs as the bridge.
      if (sinceMs && Number.isFinite(sinceMs)) {
        try {
          const missed = await prisma.message.findMany({
            where: {
              receiverId: auth.userId,
              createdAt: { gt: new Date(sinceMs) },
              ...(contactId
                ? {
                    OR: [
                      { senderId: contactId, receiverId: auth.userId },
                      { senderId: auth.userId, receiverId: contactId },
                    ],
                  }
                : {}),
            },
            orderBy: { createdAt: "asc" },
            take: 50,
            select: {
              id: true,
              senderId: true,
              receiverId: true,
              type: true,
              content: true,
              createdAt: true,
            },
          });
          for (const m of missed) {
            const ev: RealtimeEvent = {
              type: "message",
              eventId: `replay-${m.id}`,
              ts: m.createdAt.getTime(),
              messageId: m.id,
              senderId: m.senderId,
              receiverId: m.receiverId,
              contactId: m.senderId === auth.userId ? m.receiverId : m.senderId,
              preview: m.content?.slice(0, 280) ?? null,
              type_: m.type,
              createdAt: m.createdAt.toISOString(),
            };
            controller.enqueue(enc.encode(sseEvent(ev)));
          }
        } catch {
          /* replay best-effort; don't tear down the stream */
        }
      }

      // 5c. Heartbeat — a comment line every 15s to keep proxies + middle
      // boxes from dropping the connection.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(`:heartbeat ${Date.now()}\n\n`));
        } catch {
          close();
        }
      }, HEARTBEAT_MS);

      // 5d. Lifetime cap.
      const lifetime = setTimeout(() => {
        try {
          controller.enqueue(enc.encode("event: bye\ndata: lifetime\n\n"));
        } catch { /* ignore */ }
        clearInterval(heartbeat);
        abortCtrl.abort();
        close();
      }, STREAM_LIFETIME_MS);

      // 5e. The main event loop.
      (async () => {
        try {
          for await (const ev of subscribeToUserEvents({
            userId: auth.userId,
            filterContactId: contactId,
            abortSignal: abortCtrl.signal,
          })) {
            if (closed) break;
            try {
              controller.enqueue(enc.encode(sseEvent(ev)));
            } catch {
              break;
            }
          }
        } finally {
          clearInterval(heartbeat);
          clearTimeout(lifetime);
          close();
        }
      })();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disables nginx buffering if any sits in front
    },
  });
}
