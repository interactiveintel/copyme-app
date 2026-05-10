"use client";

import { useMemo } from "react";

// Local-first full-text search across the user's last-7-per-thread window
// (S-128). Sub-100ms target on the 7×7 corpus is trivial — this is a
// straight in-memory `includes` filter with simple highlight markup.

export interface SearchableMessage {
  id: string;
  threadId: string;
  from: string;
  text: string;
  createdAt: string;
}

export interface SearchHit {
  message: SearchableMessage;
  highlights: { before: string; match: string; after: string };
  threadName: string;
}

export interface SearchableThread {
  id: string;
  name: string;
  messages: SearchableMessage[];
}

export function useLast7Search(threads: SearchableThread[], query: string): SearchHit[] {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const t of threads) {
      // Only the last 7 per thread are searchable (matches free-tier retention).
      const lastSeven = t.messages.slice(-7);
      for (const m of lastSeven) {
        const idx = m.text.toLowerCase().indexOf(q);
        if (idx === -1) continue;
        out.push({
          message: m,
          threadName: t.name,
          highlights: {
            before: m.text.slice(0, idx),
            match: m.text.slice(idx, idx + q.length),
            after: m.text.slice(idx + q.length),
          },
        });
      }
    }
    return out;
  }, [threads, query]);
}
