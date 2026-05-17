"use client";

// Realtime message stream client (A5).
//
// Uses fetch() + ReadableStream + an SSE parser (NOT browser EventSource)
// so we can send a Bearer token in the Authorization header without
// leaking it in URL query params / access logs.
//
// Reconnect strategy:
// - The server closes after 55s. The client reconnects immediately with
//   Last-Event-ID — server replays missed events from the DB.
// - On error, exponential backoff capped at 30s.
// - If the user navigates away, AbortController tears down cleanly.
//
// Fallback: this hook NEVER replaces the existing polling. It runs as an
// additional, faster delivery channel. The caller (ChatScreen) dedupes
// by message id when combining poll + stream results.

import { useEffect, useRef, useState } from "react";
import { handleFrame as parseSseFrame, type SseFrameContext } from "@/lib/sse-parser";

// Re-export for unit tests + external consumers that may want raw parsing.
export { parseSseFrame };
export type { SseFrameContext };

export type StreamStatus = "idle" | "connecting" | "open" | "reconnecting" | "disabled";

export interface StreamMessageEvent {
  type: "message";
  eventId: string;
  ts: number;
  messageId: string;
  senderId: string;
  receiverId: string;
  contactId: string;
  preview: string | null;
  type_: "text" | "image" | "voice" | "video" | "vap_transfer" | "vap_request";
  createdAt: string;
}

export interface StreamReadReceiptEvent {
  type: "read_receipt";
  eventId: string;
  ts: number;
  senderId: string;
  readerId: string;
  upToMessageId: string;
}

export type StreamEvent = StreamMessageEvent | StreamReadReceiptEvent;

export interface UseMessageStreamOpts {
  /** Bearer access token. Pass null while unauthenticated; hook will idle. */
  accessToken: string | null;
  /** Scope the stream to a single conversation (or omit for all). */
  contactId?: string;
  /** Called on each event. Stable identity preferred (useCallback). */
  onEvent: (ev: StreamEvent) => void;
  /** Master enable. Useful for feature-flag + tab-visibility gating. */
  enabled?: boolean;
}

export interface UseMessageStreamResult {
  status: StreamStatus;
  /** Most recent event id we received — sent as Last-Event-ID on reconnect. */
  lastEventId: string | null;
}

const MAX_BACKOFF_MS = 30_000;
const RETRY_BASE_MS = 1_000;
const RETRY_JITTER_MS = 500;

export function useMessageStream(opts: UseMessageStreamOpts): UseMessageStreamResult {
  const { accessToken, contactId, onEvent, enabled = true } = opts;
  const [status, setStatus] = useState<StreamStatus>("idle");
  const lastEventIdRef = useRef<string | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || !accessToken) {
      setStatus("idle");
      return;
    }

    const abort = new AbortController();
    let attempt = 0;
    let stopped = false;
    let lastSeenTs = Date.now();

    async function connect() {
      while (!stopped) {
        setStatus(attempt === 0 ? "connecting" : "reconnecting");
        const since = lastSeenTs;
        const params = new URLSearchParams();
        if (contactId) params.set("contactId", contactId);
        params.set("since", String(since));
        const url = `/api/messages/stream?${params.toString()}`;

        let res: Response;
        try {
          res = await fetch(url, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              ...(lastEventIdRef.current ? { "Last-Event-ID": lastEventIdRef.current } : {}),
              Accept: "text/event-stream",
            },
            signal: abort.signal,
          });
        } catch {
          if (stopped) return;
          await sleep(backoffMs(attempt++), abort.signal);
          continue;
        }

        if (res.status === 503) {
          // Feature-flag off — don't reconnect; rely on polling.
          setStatus("disabled");
          return;
        }
        if (res.status === 401) {
          setStatus("idle");
          return;
        }
        if (res.status === 429) {
          // Concurrent-stream cap. Back off hard.
          await sleep(15_000, abort.signal);
          continue;
        }
        if (!res.ok || !res.body) {
          await sleep(backoffMs(attempt++), abort.signal);
          continue;
        }

        setStatus("open");
        attempt = 0;

        try {
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          while (!stopped) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            // SSE frames are separated by double newline.
            let nl: number;
            while ((nl = buffer.indexOf("\n\n")) >= 0) {
              const frame = buffer.slice(0, nl);
              buffer = buffer.slice(nl + 2);
              parseSseFrame<StreamEvent>(frame, onEventRef.current, lastEventIdRef);
              lastSeenTs = Date.now();
            }
          }
        } catch {
          /* fall through to reconnect */
        }

        if (stopped) return;
        // Server closed (lifetime cap) or network blip — reconnect.
        await sleep(backoffMs(attempt++), abort.signal);
      }
    }

    void connect();

    return () => {
      stopped = true;
      abort.abort();
      setStatus("idle");
    };
  }, [accessToken, contactId, enabled]);

  return { status, lastEventId: lastEventIdRef.current };
}

// ----- helpers ------------------------------------------------------------

function backoffMs(attempt: number): number {
  const exp = Math.min(MAX_BACKOFF_MS, RETRY_BASE_MS * 2 ** attempt);
  return exp + Math.floor(Math.random() * RETRY_JITTER_MS);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });
}
