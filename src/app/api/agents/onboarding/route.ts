import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { aiRateLimit } from "@/lib/redis";
import { AgentEngine } from "@/lib/agents/engine";
import { createOnboardingConfig } from "@/lib/agents/onboarding-agent";
import type { AgentMessage } from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// POST /api/agents/onboarding
// ---------------------------------------------------------------------------

interface OnboardingBody {
  userId?: string;
  currentProfile?: {
    displayName?: string;
    interests?: string[];
    location?: Record<string, string>;
    descriptions?: Record<string, string>[];
    profileType?: string;
  };
  action: "suggest_interests" | "improve_description" | "validate" | "generate_bio" | "suggest_location";
  text?: string;
  field?: string;
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
    const body = (await request.json()) as OnboardingBody;

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_ACTION", message: "Action is required (suggest_interests, improve_description, validate, generate_bio, suggest_location)" } },
        { status: 400 },
      );
    }

    // Build the user message based on action type
    const profile = body.currentProfile ?? {};
    const actionMessages: Record<string, string> = {
      suggest_interests: `Suggest interests for me. My current interests: ${profile.interests?.join(", ") ?? "none yet"}. Preferences: ${body.text ?? "anything"}`,
      improve_description: `Improve this description for my ${body.field ?? "profile"}: ${body.text ?? ""}`,
      validate: `Validate my profile. Display name: ${profile.displayName ?? ""}, Interests: ${profile.interests?.join(", ") ?? "none"}, Location: ${JSON.stringify(profile.location ?? {})}, Descriptions: ${JSON.stringify(profile.descriptions ?? [])}`,
      generate_bio: `Generate a bio for me. Interests: ${profile.interests?.join(", ") ?? "various"}, Location: ${profile.location?.cityZip ?? profile.location?.region ?? "unset"}, Profile type: ${profile.profileType ?? "personal"}`,
      suggest_location: `Suggest a location description for: ${body.text ?? "my area"}`,
    };

    const userMessage = actionMessages[body.action] ?? body.text ?? "Help me set up my profile.";

    // Configure and run the agent
    const config = createOnboardingConfig();
    const engine = new AgentEngine();

    const messages: AgentMessage[] = [
      { role: "user", content: userMessage },
    ];

    const result = await engine.run(config, messages);

    // Extract tool output based on the action
    const actionToolMap: Record<string, string> = {
      suggest_interests: "suggest_interests",
      improve_description: "improve_description",
      validate: "validate_profile",
      generate_bio: "generate_bio",
      suggest_location: "suggest_location_description",
    };

    const targetTool = actionToolMap[body.action];
    const toolAction = result.actions.find((a) => a.tool === targetTool);
    const toolOutput = toolAction?.output as Record<string, unknown> | undefined;

    // Build a normalized score from the output
    let score = 0;
    if (toolOutput) {
      if (typeof toolOutput.score === "number") {
        score = toolOutput.score as number;
      } else if (toolOutput.suggestions) {
        score = Math.min(100, ((toolOutput.suggestions as unknown[]).length / 7) * 100);
      }
    }

    return NextResponse.json({
      success: result.success,
      data: {
        action: body.action,
        result: toolOutput ?? null,
        suggestions: (toolOutput as { suggestions?: unknown[] })?.suggestions ?? [],
        improvements: (toolOutput as { improvements?: unknown[] })?.improvements ?? (toolOutput as { bios?: unknown[] })?.bios ?? [],
        score: Math.round(score),
        agentResponse: result.response,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error("[agents/onboarding] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
