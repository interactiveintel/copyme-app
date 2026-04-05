import { NextRequest, NextResponse } from "next/server";
import { aiRateLimit } from "@/lib/redis";
import { AgentEngine } from "@/lib/agents/engine";
import { createModerationConfig } from "@/lib/agents/moderation-agent";
import type { AgentMessage } from "@/lib/agents/types";

// ---------------------------------------------------------------------------
// POST /api/agents/moderate
// Auth required via middleware (x-user-id header set automatically)
// ---------------------------------------------------------------------------

interface ModerateBody {
  content: string;
  type: "text" | "media";
  contentType?: "message" | "displayName" | "interest" | "description";
  tier?: string;
  mediaInfo?: {
    imageCount?: number;
    audioDurationSeconds?: number;
    videoDurationSeconds?: number;
    fileSizeMB?: number;
  };
}

export async function POST(request: NextRequest) {
  // AI rate limiting (use x-user-id header from middleware for internal calls)
  const callerId = request.headers.get("x-user-id");
  if (callerId) {
    try {
      const rl = await aiRateLimit(callerId);
      if (!rl.allowed) {
        return NextResponse.json(
          { success: false, error: { code: "RATE_LIMITED", message: `AI rate limit exceeded. Retry in ${rl.retryAfterSeconds}s` } },
          { status: 429 },
        );
      }
    } catch {
      // Redis unavailable — allow request
    }
  }

  try {
    const body = (await request.json()) as ModerateBody;

    if (!body.content && body.type !== "media") {
      return NextResponse.json(
        { success: false, error: { code: "MISSING_CONTENT", message: "Content is required for text moderation" } },
        { status: 400 },
      );
    }

    // Build the user message based on moderation type
    let userMessage: string;

    if (body.type === "media") {
      const media = body.mediaInfo ?? {};
      userMessage = `Check media constraints: ${media.imageCount ?? 0} images, ${media.audioDurationSeconds ?? 0}s audio, ${media.videoDurationSeconds ?? 0}s video, ${media.fileSizeMB ?? 0}MB file size. Tier: ${body.tier ?? "basic"}.`;
    } else {
      userMessage = `Check this ${body.contentType ?? "message"} content for safety and Rule of 7 compliance: ${body.content}`;
    }

    // Configure and run the agent
    const config = createModerationConfig();
    const engine = new AgentEngine();

    const messages: AgentMessage[] = [
      { role: "user", content: userMessage },
    ];

    const result = await engine.run(config, messages);

    // Extract outputs from the relevant tool actions
    const checkAction = result.actions.find((a) => a.tool === "check_content");
    const ruleAction = result.actions.find((a) => a.tool === "enforce_rule_of_7");
    const mediaAction = result.actions.find((a) => a.tool === "check_media");
    const flagAction = result.actions.find((a) => a.tool === "flag_content");
    const revisionAction = result.actions.find((a) => a.tool === "suggest_revision");

    const checkOutput = checkAction?.output as Record<string, unknown> | undefined;
    const ruleOutput = ruleAction?.output as Record<string, unknown> | undefined;
    const mediaOutput = mediaAction?.output as Record<string, unknown> | undefined;
    const revisionOutput = revisionAction?.output as Record<string, unknown> | undefined;

    // Determine overall safety
    const isSafe = checkOutput
      ? (checkOutput.safe as boolean) ?? true
      : mediaOutput
        ? (mediaOutput.compliant as boolean) ?? true
        : true;

    const safetyScore = checkOutput
      ? (checkOutput.safetyScore as number) ?? 100
      : 100;

    const flags = checkOutput
      ? (checkOutput.flags as unknown[]) ?? []
      : [];

    return NextResponse.json({
      success: true,
      data: {
        safe: isSafe,
        score: safetyScore,
        flags,
        ruleOf7: ruleOutput ?? null,
        mediaCheck: mediaOutput ?? null,
        suggestion: (revisionOutput as { revised?: string })?.revised ?? null,
        agentResponse: result.response,
        metadata: result.metadata,
      },
    });
  } catch (error) {
    console.error("[agents/moderate] Unhandled error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } },
      { status: 500 },
    );
  }
}
