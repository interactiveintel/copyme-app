// POST /api/agents/yogi/smart-replies — return 3 smart-reply chips (S-207).
//
// Body: { threadContext: string[], inboundMessage: string }
// Returns: { replies: string[3] } each ≤70 words, post-filtered (S-205).

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { preFilter, postFilter } from "@/lib/yogi-safety";
import { LIMITS } from "@/lib/ruleOf7";
import { isEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

const FALLBACKS = [
  "Sounds good — I'll think on it.",
  "Tell me more — what's on your mind?",
  "Got it. Let's talk later today.",
];

function trimToWords(s: string, max = LIMITS.BASIC.maxMessageWords): string {
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens.slice(0, max).join(" ");
}

export async function POST(req: NextRequest) {
  const auth = authenticateRequest(req.headers.get("authorization"));
  if (!auth) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });

  // Yogi must be on per-user (S-201 + privacy controls).
  if (!(await isEnabled("yogi", { userId: auth.userId }))) {
    return NextResponse.json({ error: "DISABLED" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const inbound = typeof body.inboundMessage === "string" ? body.inboundMessage : "";
  const cleaned = preFilter(inbound).cleaned;
  void cleaned; // would be passed to the model

  // Real implementation calls Anthropic via lib/agents/yogi.ts. We keep a
  // graceful fallback so the surface is testable without a key. The dynamic
  // import is typed loose because the named export doesn't exist yet —
  // it'll be added when the smart-reply generator lands in lib/agents/yogi.ts.
  try {
    const mod = (await import("@/lib/agents/yogi")) as Record<string, unknown>;
    const fn = mod.generateSmartReplies;
    if (typeof fn === "function") {
      const raw = (await (fn as (args: unknown) => Promise<string[]>)({
        userId: auth.userId,
        inbound: cleaned,
        threadContext: Array.isArray(body.threadContext) ? body.threadContext.slice(-7) : [],
      })) as string[];
      const replies = raw
        .map((r: string) => trimToWords(postFilter(r).output))
        .filter((r: string) => r.trim().length > 0)
        .slice(0, 3);
      if (replies.length === 3) return NextResponse.json({ replies });
    }
  } catch {
    // fall through
  }

  return NextResponse.json({ replies: FALLBACKS });
}
