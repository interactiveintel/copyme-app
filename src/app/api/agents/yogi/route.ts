import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { aiRateLimit } from "@/lib/redis";
import { capture, ANALYTICS_EVENTS } from "@/lib/analytics";
import { callYogi, isYogiClaudeConfigured } from "@/lib/yogi-claude";
import { checkCostCap, recordYogiUsage } from "@/lib/yogi-cost";
import { rollupMemoryIfNeeded } from "@/lib/yogi-memory";

// ---------------------------------------------------------------------------
// POST /api/agents/yogi
// Auth required via middleware (x-user-id header set automatically).
//
// Production behavior (when ANTHROPIC_API_KEY is set):
//   - Loads or creates the user's YogiPersonality row
//   - Loads up to last 10 YogiMessage rows for this user (verbatim)
//   - Includes the personality.memorySummary (rolled up at 60+ messages)
//   - Calls Claude (Opus 4.7) via src/lib/yogi-claude.ts with prompt
//     caching on the system prompt + personality + summary
//   - Persists the user message + assistant reply to YogiMessage
//   - Updates personality (totalChats++, recent topics, lightweight tone
//     adaptation) — NOT a heavy LLM-driven analysis on every turn
//   - Logs token usage to YogiCostLog and enforces a per-day cost cap
//
// Anonymous / no-auth callers (used by the public demo) still hit the
// keyword-matched fallback baked into AgentiAIScreen client-side. This
// route is now strictly for authenticated users.
// ---------------------------------------------------------------------------

interface YogiBody {
  message: string;
  mode?: "text" | "voice" | "video";
  conversationHistory?: { role: string; content: string }[];
}

const BASE_INSTRUCTION = `You are Yogi, a personal AI companion built into the CopyMe messaging app.

CopyMe is a social platform built around the "Rule of 7" — messages are capped at 70 words, users hold up to 7 active contacts, and only the last 7 messages per contact are retained. Your job is to be warm, curious, and helpful. You are not a search engine; you are a friend who happens to be very good at conversation.

Style rules (always):
- Be conversational. No bullet lists, no headers, no markdown.
- Match the user's energy: short message → short reply.
- Aim for 1-3 sentences. Hard cap at 70 words.
- Never claim to "remember" something the personality block doesn't tell you.
- If the user seems upset, acknowledge first; don't immediately problem-solve.
- Never refuse for performative safety reasons; if the request is genuinely
  harmful, decline once, briefly, and offer a constructive alternative.`;

function personalityBlock(p: {
  tone: string;
  humor: number;
  empathy: number;
  totalChats: number;
  interests: unknown;
  displayName: string;
}): string {
  const interests = Array.isArray(p.interests)
    ? (p.interests as string[]).join(", ")
    : "(none yet)";
  return `Personality calibration for this user:
- Their display name: ${p.displayName}
- Conversational tone Yogi should use: ${p.tone}
- Humor dial: ${p.humor}/10
- Empathy dial: ${p.empathy}/10
- Total chats with them so far: ${p.totalChats}
- Topics they've talked about: ${interests}`;
}

function modePrefix(mode?: string): string {
  if (mode === "voice") return "[User is speaking via voice — respond conversationally] ";
  if (mode === "video") return "[User is on video call — be natural and engaging] ";
  return "";
}

export async function POST(request: NextRequest) {
  const callerId = request.headers.get("x-user-id");

  // --- Auth required (middleware already enforces; this is belt-and-suspenders) -
  if (!callerId) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Sign in to chat with Yogi." } },
      { status: 401 },
    );
  }

  // --- Rate limit (per-minute) -------------------------------------------
  try {
    const rl = await aiRateLimit(callerId);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many Yogi messages. Retry in ${rl.retryAfterSeconds}s`,
          },
        },
        { status: 429 },
      );
    }
  } catch {
    // Redis unavailable — degrade gracefully
  }

  // --- Validate body -----------------------------------------------------
  let body: YogiBody;
  try {
    body = (await request.json()) as YogiBody;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "BAD_BODY", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }
  if (!body.message?.trim()) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_MESSAGE", message: "Message is required" } },
      { status: 400 },
    );
  }

  // --- Configuration check -----------------------------------------------
  if (!isYogiClaudeConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "NOT_CONFIGURED",
          message: "Yogi is temporarily unavailable. Please try again later.",
        },
      },
      { status: 503 },
    );
  }

  try {
    // --- Cost cap (pre-flight) ------------------------------------------
    const cap = await checkCostCap(callerId);
    if (cap.exceeded) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DAILY_LIMIT",
            message:
              "You've reached today's Yogi usage limit. The limit refreshes at midnight UTC.",
            meta: { spentMicroUsd: cap.spentMicroUsd, capMicroUsd: cap.capMicroUsd },
          },
        },
        { status: 429 },
      );
    }

    // --- Load user + personality + recent messages in parallel ----------
    const [user, personalityRow, recent] = await Promise.all([
      prisma.user.findUnique({
        where: { id: callerId },
        select: { displayName: true },
      }),
      prisma.yogiPersonality.findUnique({ where: { userId: callerId } }),
      prisma.yogiMessage.findMany({
        where: { userId: callerId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { role: true, content: true },
      }),
    ]);

    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "USER_NOT_FOUND", message: "User not found" } },
        { status: 404 },
      );
    }

    const personality = personalityRow ?? {
      tone: "friendly",
      humor: 5,
      empathy: 7,
      totalChats: 0,
      interests: [] as string[],
      memorySummary: null as string | null,
    };

    // First Yogi chat for this user — emit analytics event
    if (personality.totalChats === 0) {
      capture(callerId, ANALYTICS_EVENTS.YogiChatStarted, { mode: body.mode ?? "text" });
    }

    // --- Build prompt + call Claude -------------------------------------
    const history = recent
      .reverse() // findMany returned newest-first; reverse to oldest-first
      .map((m) => ({
        role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
        content: m.content,
      }));

    const userText = modePrefix(body.mode) + body.message.trim();

    const result = await callYogi({
      baseInstruction: BASE_INSTRUCTION,
      personalityBlock: personalityBlock({
        tone: personality.tone,
        humor: personality.humor,
        empathy: personality.empathy,
        totalChats: personality.totalChats,
        interests: personality.interests,
        displayName: user.displayName,
      }),
      memorySummary: personality.memorySummary ?? undefined,
      history,
      userMessage: userText,
    });

    // --- Persist usage + messages + personality (parallel) --------------
    const newInterests = extractTopics(body.message, personality.interests as unknown);
    const updateOps: Promise<unknown>[] = [
      // Cost log (must always succeed for the cap to work)
      recordYogiUsage(callerId, {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        cacheReadTokens: result.cacheReadTokens,
        cacheWriteTokens: result.cacheWriteTokens,
        costMicroUsd: result.costMicroUsd,
      }),

      // Append both turns to history
      prisma.yogiMessage.createMany({
        data: [
          { userId: callerId, role: "user", content: body.message.trim(), mode: body.mode ?? "text" },
          { userId: callerId, role: "assistant", content: result.text, mode: body.mode ?? "text" },
        ],
      }),

      // Bump personality
      prisma.yogiPersonality.upsert({
        where: { userId: callerId },
        create: {
          userId: callerId,
          tone: personality.tone,
          humor: personality.humor,
          empathy: personality.empathy,
          totalChats: 1,
          interests: newInterests,
        },
        update: {
          totalChats: { increment: 1 },
          interests: newInterests,
        },
      }),
    ];

    await Promise.all(updateOps);

    // --- Memory rollover (best-effort, non-blocking) --------------------
    void rollupMemoryIfNeeded(callerId).catch((err) => {
      console.warn("[yogi rollup]", err instanceof Error ? err.message : err);
    });

    return NextResponse.json({
      success: true,
      data: {
        response: result.text,
        personality: {
          tone: personality.tone,
          humor: personality.humor,
          empathy: personality.empathy,
          interests: newInterests,
          totalChats: personality.totalChats + 1,
        },
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          cacheReadTokens: result.cacheReadTokens,
          cacheWriteTokens: result.cacheWriteTokens,
          costMicroUsd: result.costMicroUsd,
        },
      },
    });
  } catch (error) {
    console.error("[agents/yogi] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Yogi had a hiccup. Try again." } },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// Lightweight topic extraction.
//
// Picks 1-2 nouns >5 chars from the user's message and merges them into the
// existing interest list (max 7). Cheap heuristic — no extra LLM call.
// ---------------------------------------------------------------------------

function extractTopics(message: string, prior: unknown): string[] {
  const priorList = Array.isArray(prior) ? (prior as string[]) : [];
  const stop = new Set([
    "about", "above", "after", "again", "their", "there", "these", "those",
    "would", "could", "should", "might", "really", "actually", "today",
    "people", "things", "thing", "going", "coming", "where", "which", "while",
    "since", "every", "first", "another", "before", "between", "during",
  ]);
  const candidates = message
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 5 && !stop.has(w));
  const merged = Array.from(new Set([...candidates.slice(0, 2), ...priorList]));
  return merged.slice(0, 7);
}
