import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { aiRateLimit } from "@/lib/redis";
import { AgentEngine } from "@/lib/agents/engine";
import { createChatAssistantConfig } from "@/lib/agents/chat-assistant";
import type { AgentMessage } from "@/lib/agents/types";

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
