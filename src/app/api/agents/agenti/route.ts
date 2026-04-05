import { NextRequest, NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/redis";
import { AgentEngine } from "@/lib/agents/engine";
import { createAgentiConfig, analyzeMessageStyle, DEFAULT_PERSONALITY } from "@/lib/agents/agenti";
import type { AgentMessage } from "@/lib/agents/types";
import type { PersonalityProfile } from "@/lib/agents/agenti";

// ---------------------------------------------------------------------------
// POST /api/agents/agenti
// Auth required via middleware (x-user-id header set automatically)
// ---------------------------------------------------------------------------

interface AgentiBody {
  message: string;
  mode: "text" | "voice" | "video";
  conversationHistory?: { role: string; content: string }[];
}

// In-memory personality store (per-user, resets on cold start)
// In production this would be persisted to database
const personalityStore = new Map<string, PersonalityProfile>();

function getOrCreatePersonality(userId: string): PersonalityProfile {
  if (!personalityStore.has(userId)) {
    personalityStore.set(userId, { userId, ...DEFAULT_PERSONALITY });
  }
  return personalityStore.get(userId)!;
}

export async function POST(request: NextRequest) {
  const callerId = request.headers.get("x-user-id");

  // Rate limiting
  if (callerId) {
    try {
      const rl = await aiRateLimit(callerId);
      if (!rl.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "RATE_LIMITED",
              message: `AI rate limit exceeded. Retry in ${rl.retryAfterSeconds}s`,
            },
          },
          { status: 429 }
        );
      }
    } catch {
      // Redis unavailable — allow request
    }
  }

  try {
    const body = (await request.json()) as AgentiBody;

    if (!body.message?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_MESSAGE", message: "Message is required" },
        },
        { status: 400 }
      );
    }

    const userId = callerId || "anonymous";
    const personality = getOrCreatePersonality(userId);

    // Learn from the user's message history
    const userMessages = (body.conversationHistory ?? [])
      .filter((m) => m.role === "user")
      .map((m) => m.content);
    userMessages.push(body.message);

    const styleAnalysis = analyzeMessageStyle(userMessages);
    Object.assign(personality, {
      ...styleAnalysis,
      totalInteractions: personality.totalInteractions + 1,
      lastInteraction: new Date().toISOString(),
    });

    // Add recent topic
    const words = body.message.split(" ").slice(0, 5).join(" ");
    personality.recentTopics = [
      words,
      ...personality.recentTopics.slice(0, 6),
    ];

    personalityStore.set(userId, personality);

    // Configure and run the agent
    const config = createAgentiConfig(personality);
    const engine = new AgentEngine();

    // Build message history
    const messages: AgentMessage[] = [];

    // Include conversation history for context
    if (body.conversationHistory) {
      for (const hist of body.conversationHistory.slice(-8)) {
        messages.push({
          role: hist.role === "user" ? "user" : "assistant",
          content: hist.content,
        });
      }
    }

    // Add mode context to the message
    const modePrefix =
      body.mode === "voice"
        ? "[User is speaking via voice — respond conversationally] "
        : body.mode === "video"
          ? "[User is on video call — be natural and engaging] "
          : "";

    messages.push({ role: "user", content: modePrefix + body.message });

    const result = await engine.run(config, messages);

    // Extract any learned facts from tool calls
    const learnedFacts = result.actions
      .filter((a) => a.tool === "learn_about_user")
      .map((a) => (a.output as { fact: string }).fact);

    if (learnedFacts.length > 0) {
      personality.conversationMemory = [
        ...learnedFacts,
        ...personality.conversationMemory.slice(0, 20),
      ];
      personalityStore.set(userId, personality);
    }

    // Extract style adaptations
    const adaptations = result.actions
      .filter((a) => a.tool === "adapt_style")
      .map((a) => a.output);

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        personality: {
          tone: personality.tone,
          humor: personality.humorLevel,
          empathy: personality.empathyLevel,
          interests: personality.topInterests,
          totalChats: personality.totalInteractions,
        },
        learned: learnedFacts,
        adaptations,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error("[agents/agenti] Unhandled error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      },
      { status: 500 }
    );
  }
}
