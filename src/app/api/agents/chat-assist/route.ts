import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { aiRateLimit } from "@/lib/redis";
import { AgentEngine } from "@/lib/agents/engine";
import { createChatAssistantConfig } from "@/lib/agents/chat-assistant";
import type { AgentMessage } from "@/lib/agents/types";
// v4.16.30: the "translate" action short-circuits to the real Haiku
// translation pipeline (same one the message-send path uses) instead
// of the agent's [lang]-prefix mock tool.
import { translate } from "@/lib/translation";

export const runtime = "nodejs";

// Map the UI's language labels + ISO codes to the app's locale codes.
// The picker sends full names ("Slovenian", "Spanish"); the composer
// may send ISO ("es"). Everything unknown falls through unchanged.
const LANG_TO_LOCALE: Record<string, string> = {
  slovenian: "si", "slovenščina": "si", sl: "si", si: "si",
  spanish: "es", "español": "es", es: "es",
  german: "de", deutsch: "de", de: "de",
  french: "fr", "français": "fr", fr: "fr",
  english: "en", en: "en",
  italian: "it", it: "it", portuguese: "pt", pt: "pt",
  japanese: "ja", ja: "ja", chinese: "zh", zh: "zh",
  korean: "ko", ko: "ko", arabic: "ar", ar: "ar",
  hindi: "hi", hi: "hi", russian: "ru", ru: "ru", dutch: "nl", nl: "nl",
};

function toLocaleCode(raw: string | undefined): string {
  if (!raw) return "es";
  const k = raw.trim().toLowerCase();
  return LANG_TO_LOCALE[k] ?? (k.length === 2 ? k : "es");
}

// ---------------------------------------------------------------------------
// POST /api/agents/chat-assist
// ---------------------------------------------------------------------------

interface ChatAssistBody {
  userId?: string;
  conversationHistory?: string[];
  action: "suggest_reply" | "condense" | "translate" | "analyze_tone" | "detect_language" | "suggest_emoji";
  text?: string;
  targetLanguage?: string;
  tone?: string;
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  // AI rate limiting
  try {
    const rl = await aiRateLimit(auth.userId);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: `AI rate limit exceeded. Retry in ${rl.retryAfterSeconds}s` } },
        { status: 429 },
      );
    }
  } catch {
    // Redis unavailable — allow request
  }

  try {
    const body = (await request.json()) as ChatAssistBody;

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_ACTION", message: "Action is required (suggest_reply, condense, translate, analyze_tone, detect_language, suggest_emoji)" } },
        { status: 400 },
      );
    }

    // v4.16.30: real translation for the draft-translate tab. Uses the
    // Haiku pipeline (with Redis cache + per-user budget) instead of the
    // agent's mock translate_message tool, which only prefixed "[lang]".
    if (body.action === "translate") {
      const text = (body.text ?? "").trim();
      if (!text) {
        return NextResponse.json({ success: true, data: { action: "translate", translation: null } });
      }
      const toLocale = toLocaleCode(body.targetLanguage);
      const tr = await translate({ text, fromLocale: "auto", toLocale, userId: auth.userId });
      return NextResponse.json({
        success: true,
        data: {
          action: "translate",
          translation: tr.text === text ? null : tr.text,
          targetLanguage: toLocale,
        },
      });
    }

    // Build the user message based on action type
    const actionMessages: Record<string, string> = {
      suggest_reply: `Suggest a reply for this conversation: ${body.conversationHistory?.join(" | ") ?? body.text ?? "Hello!"}`,
      condense: `Condense this message to fit within 70 words: ${body.text ?? ""}`,
      translate: `Translate this to ${body.targetLanguage ?? "Spanish"}: ${body.text ?? ""}`,
      analyze_tone: `Analyze the tone of this message: ${body.text ?? ""}`,
      detect_language: `What language is this: ${body.text ?? ""}`,
      suggest_emoji: `Suggest emoji for this message: ${body.text ?? ""}`,
    };

    const userMessage = actionMessages[body.action] ?? body.text ?? "Help me with my message.";

    // Configure and run the agent
    const config = createChatAssistantConfig();
    const engine = new AgentEngine();

    const messages: AgentMessage[] = [
      { role: "user", content: userMessage },
    ];

    const result = await engine.run(config, messages);

    // Extract tool output based on the action
    const actionToolMap: Record<string, string> = {
      suggest_reply: "suggest_reply",
      condense: "condense_message",
      translate: "translate_message",
      analyze_tone: "analyze_tone",
      detect_language: "detect_language",
      suggest_emoji: "suggest_emoji",
    };

    const targetTool = actionToolMap[body.action];
    const toolAction = result.actions.find((a) => a.tool === targetTool);
    const toolOutput = toolAction?.output as Record<string, unknown> | undefined;

    return NextResponse.json({
      success: result.success,
      data: {
        action: body.action,
        result: toolOutput ?? null,
        agentResponse: result.response,
        suggestions: (toolOutput as { suggestions?: unknown[] })?.suggestions ?? [],
        condensed: (toolOutput as { condensed?: string })?.condensed ?? null,
        translation: (toolOutput as { translated?: string })?.translated ?? null,
        tone: (toolOutput as { primaryTone?: unknown })?.primaryTone ?? null,
        language: (toolOutput as { language?: string })?.language ?? null,
        emojis: (toolOutput as { emojis?: string[] })?.emojis ?? [],
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error("[agents/chat-assist] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
