"use client";

// Offline send queue (S-130).
//
// Browser-side queue backed by localStorage. Capped at 7 messages
// (Rule of 7 again — if you can't send 7, the network's the issue, not the
// queue). `flush()` is wired to `online` events and to a manual call.

const QUEUE_KEY = "copyme.offline.queue";
const MAX_QUEUE = 7;

export interface QueuedMessage {
  id: string;
  receiverId: string;
  type: "text" | "image" | "voice" | "video";
  content?: string;
  mediaUrls?: string[];
  durationSeconds?: number;
  createdAt: string;
  attempts: number;
}

function read(): QueuedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedMessage[];
  } catch {
    return [];
  }
}

function write(items: QueuedMessage[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function isQueueFull(): boolean {
  return read().length >= MAX_QUEUE;
}

export function enqueue(msg: Omit<QueuedMessage, "id" | "createdAt" | "attempts">): QueuedMessage | null {
  const items = read();
  if (items.length >= MAX_QUEUE) return null;
  const queued: QueuedMessage = {
    ...msg,
    id: `q_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  items.push(queued);
  write(items);
  return queued;
}

export function peek(): QueuedMessage[] {
  return read();
}

export function remove(id: string): void {
  write(read().filter((m) => m.id !== id));
}

/**
 * Try to flush the queue against the server. Returns the number of items
 * successfully sent. Items that fail are kept in the queue with attempts
 * incremented; after 5 attempts they are dropped (caller should warn the
 * user via `onDrop`).
 */
export async function flush(opts: {
  send: (msg: QueuedMessage) => Promise<boolean>;
  onDrop?: (msg: QueuedMessage) => void;
}): Promise<number> {
  const items = read();
  if (items.length === 0) return 0;
  let sent = 0;
  const remaining: QueuedMessage[] = [];
  for (const m of items) {
    let ok = false;
    try {
      ok = await opts.send(m);
    } catch {
      ok = false;
    }
    if (ok) {
      sent++;
    } else if (m.attempts >= 5) {
      opts.onDrop?.(m);
    } else {
      remaining.push({ ...m, attempts: m.attempts + 1 });
    }
  }
  write(remaining);
  return sent;
}

/** Hook the browser online/offline events to auto-flush. */
export function watchOnline(opts: Parameters<typeof flush>[0]): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => {
    if (navigator.onLine) void flush(opts);
  };
  window.addEventListener("online", handler);
  return () => window.removeEventListener("online", handler);
}
