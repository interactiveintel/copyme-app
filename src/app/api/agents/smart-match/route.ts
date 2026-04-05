import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { AgentEngine } from "@/lib/agents/engine";
import { createSmartMatchConfig } from "@/lib/agents/smart-match";
import type { AgentMessage } from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// POST /api/agents/smart-match
// ---------------------------------------------------------------------------

interface SmartMatchBody {
  userId?: string;
  query?: string;
  interests?: string[];
  location?: string;
}

export async function POST(request: NextRequest) {
  const auth = authenticateRequest(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json(
      { success: false, error: { code: "UNAUTHORIZED", message: "Valid access token required" } },
      { status: 401 },
    );
  }

  try {
    const body = (await request.json()) as SmartMatchBody;

    // Build user message from the request parameters
    const parts: string[] = [];
    if (body.query) parts.push(body.query);
    if (body.interests?.length) parts.push(`Interests: ${body.interests.join(", ")}`);
    if (body.location) parts.push(`Location: ${body.location}`);

    const userMessage = parts.length > 0
      ? parts.join(". ")
      : "Find me interesting people to connect with based on my profile.";

    // Configure and run the agent
    const config = createSmartMatchConfig();
    const engine = new AgentEngine();

    const messages: AgentMessage[] = [
      { role: "user", content: userMessage },
    ];

    const result = await engine.run(config, messages);

    // Extract structured data from the agent actions
    const searchAction = result.actions.find((a) => a.tool === "search_users");
    const icebreakerAction = result.actions.find((a) => a.tool === "generate_icebreaker");
    const interestAction = result.actions.find((a) => a.tool === "suggest_interests");

    // Type the outputs
    const searchOutput = searchAction?.output as { results?: Array<Record<string, unknown>> } | undefined;
    const icebreakerOutput = icebreakerAction?.output as { icebreakers?: string[] } | undefined;
    const interestOutput = interestAction?.output as { suggestions?: string[] } | undefined;

    return NextResponse.json({
      success: result.success,
      data: {
        matches: searchOutput?.results ?? [],
        icebreakers: icebreakerOutput?.icebreakers ?? [],
        suggestions: interestOutput?.suggestions ?? [],
        agentResponse: result.response,
        actions: result.actions.map((a) => ({
          tool: a.tool,
          timestamp: a.timestamp,
        })),
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error("[agents/smart-match] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
