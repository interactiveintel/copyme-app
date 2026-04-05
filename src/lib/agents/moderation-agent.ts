// ---------------------------------------------------------------------------
// Content Moderation Agent — safety + Rule of 7 enforcement
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentTool } from "./types";
import { LIMITS } from "../ruleOf7";

// ---------------------------------------------------------------------------
// Moderation dictionaries and patterns
// ---------------------------------------------------------------------------

/** Words/patterns that indicate potentially unsafe content. */
const UNSAFE_PATTERNS: { pattern: RegExp; category: string; severity: "low" | "medium" | "high" | "critical" }[] = [
  // Spam patterns
  { pattern: /\b(buy now|limited offer|act fast|click here|free money|congratulations you won)\b/i, category: "spam", severity: "medium" },
  { pattern: /(https?:\/\/[^\s]+){3,}/i, category: "spam", severity: "medium" },
  { pattern: /(.)\1{7,}/i, category: "spam", severity: "low" },

  // Contact info harvesting
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, category: "personal_info", severity: "medium" },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, category: "personal_info", severity: "low" },

  // Harassment patterns (simplified for demo — real system would use ML)
  { pattern: /\b(stupid|idiot|loser|ugly|hate you|shut up)\b/i, category: "harassment", severity: "high" },

  // Scam patterns
  { pattern: /\b(send money|wire transfer|bitcoin|crypto payment|pay me|venmo|cashapp)\b/i, category: "scam", severity: "high" },
  { pattern: /\b(social security|ssn|password|credit card|bank account)\b/i, category: "data_harvesting", severity: "critical" },

  // Inappropriate content
  { pattern: /\b(nsfw|explicit|18\+)\b/i, category: "inappropriate", severity: "high" },
];

/** Safe replacement suggestions for common flagged patterns. */
const SAFE_ALTERNATIVES: Record<string, string> = {
  spam: "Consider sharing your message naturally without promotional language.",
  personal_info: "For privacy, avoid sharing personal contact details in messages. Use CopyMe's built-in messaging instead.",
  harassment: "Let's keep the conversation respectful. Try expressing your feelings constructively.",
  scam: "Financial discussions should happen through official payment channels, not direct messages.",
  data_harvesting: "Never share sensitive personal data in messages. CopyMe protects your privacy.",
  inappropriate: "Please keep content appropriate for all audiences on CopyMe.",
};

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const checkContentTool: AgentTool = {
  name: "check_content",
  description: "Analyze text content for safety. Checks for spam, harassment, scams, inappropriate content, and personal information exposure.",
  parameters: {
    text: { type: "string", description: "Content to check" },
    context: { type: "string", description: "Context: message, profile, interest, group_name" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const context = (params.context as string) ?? "message";

    const flags: { category: string; severity: string; matched: string; position: number }[] = [];

    for (const { pattern, category, severity } of UNSAFE_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        flags.push({
          category,
          severity,
          matched: match[0].slice(0, 30), // Truncate for display
          position: match.index ?? 0,
        });
      }
    }

    // Calculate safety score (100 = perfectly safe)
    let safetyScore = 100;
    for (const flag of flags) {
      switch (flag.severity) {
        case "critical": safetyScore -= 40; break;
        case "high": safetyScore -= 25; break;
        case "medium": safetyScore -= 15; break;
        case "low": safetyScore -= 5; break;
      }
    }
    safetyScore = Math.max(0, safetyScore);

    return {
      safe: flags.length === 0,
      safetyScore,
      flags,
      totalFlags: flags.length,
      highestSeverity: flags.length > 0
        ? flags.reduce((max, f) => {
            const order = { critical: 4, high: 3, medium: 2, low: 1 };
            const fOrder = order[f.severity as keyof typeof order] ?? 0;
            const mOrder = order[max.severity as keyof typeof order] ?? 0;
            return fOrder > mOrder ? f : max;
          }).severity
        : "none",
      context,
      recommendation: flags.length === 0
        ? "Content is safe and appropriate."
        : flags.some((f) => f.severity === "critical")
          ? "Content contains critical safety violations and should be blocked."
          : flags.some((f) => f.severity === "high")
            ? "Content contains concerning elements. Consider revision before sending."
            : "Content has minor flags. Review the suggestions below.",
    };
  },
};

const enforceRuleOf7Tool: AgentTool = {
  name: "enforce_rule_of_7",
  description: "Validate all Rule of 7 constraints on a piece of content. Checks word limits, character limits, and count limits.",
  parameters: {
    text: { type: "string", description: "Text content to validate" },
    type: { type: "string", description: "Content type: message, displayName, interest, description", enum: ["message", "displayName", "interest", "description"] },
    tier: { type: "string", description: "Account tier: basic, business, ecommerce", enum: ["basic", "business", "ecommerce"] },
    mediaCount: { type: "number", description: "Number of media attachments (if applicable)" },
    durationSeconds: { type: "number", description: "Duration in seconds (for voice/video)" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const type = (params.type as string) ?? "message";
    const tier = ((params.tier as string) ?? "basic").toUpperCase() as keyof typeof LIMITS;
    const mediaCount = (params.mediaCount as number) ?? 0;
    const durationSeconds = (params.durationSeconds as number) ?? 0;

    const limits = LIMITS[tier] ?? LIMITS.BASIC;
    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
    const charCount = text.length;

    const violations: { rule: string; limit: number; actual: number; message: string }[] = [];

    switch (type) {
      case "message":
        if (wordCount > limits.maxMessageWords) {
          violations.push({
            rule: "maxMessageWords",
            limit: limits.maxMessageWords,
            actual: wordCount,
            message: `Message has ${wordCount} words (limit: ${limits.maxMessageWords})`,
          });
        }
        if (mediaCount > limits.maxImages) {
          violations.push({
            rule: "maxImages",
            limit: limits.maxImages,
            actual: mediaCount,
            message: `Too many media items: ${mediaCount} (limit: ${limits.maxImages})`,
          });
        }
        if (durationSeconds > limits.maxVoiceSeconds) {
          violations.push({
            rule: "maxDuration",
            limit: limits.maxVoiceSeconds,
            actual: durationSeconds,
            message: `Duration ${durationSeconds}s exceeds limit (${limits.maxVoiceSeconds}s)`,
          });
        }
        break;

      case "displayName":
        if (wordCount > limits.profileNameWords) {
          violations.push({
            rule: "profileNameWords",
            limit: limits.profileNameWords,
            actual: wordCount,
            message: `Display name has ${wordCount} words (limit: ${limits.profileNameWords})`,
          });
        }
        if (charCount > limits.displayNameChars) {
          violations.push({
            rule: "displayNameChars",
            limit: limits.displayNameChars,
            actual: charCount,
            message: `Display name has ${charCount} characters (limit: ${limits.displayNameChars})`,
          });
        }
        break;

      case "interest":
        if (wordCount > limits.profileNameWords) {
          violations.push({
            rule: "interestWords",
            limit: limits.profileNameWords,
            actual: wordCount,
            message: `Interest has ${wordCount} words (limit: ${limits.profileNameWords})`,
          });
        }
        break;

      case "description":
        if (wordCount > 5) {
          violations.push({
            rule: "descriptionWords",
            limit: 5,
            actual: wordCount,
            message: `Description has ${wordCount} words (limit: 5)`,
          });
        }
        break;
    }

    return {
      compliant: violations.length === 0,
      violations,
      stats: { wordCount, charCount, mediaCount, durationSeconds },
      tier,
      type,
      message: violations.length === 0
        ? `Content is fully compliant with Rule of 7 for ${tier} tier.`
        : `Found ${violations.length} Rule of 7 violation(s). Please correct before submitting.`,
    };
  },
};

const flagContentTool: AgentTool = {
  name: "flag_content",
  description: "Flag content with severity level and categorization. Used for content that needs human review.",
  parameters: {
    text: { type: "string", description: "Content to flag" },
    reason: { type: "string", description: "Reason for flagging" },
    severity: { type: "string", description: "Severity level", enum: ["low", "medium", "high", "critical"] },
    reportedBy: { type: "string", description: "User ID of reporter (if user-reported)" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const reason = (params.reason as string) ?? "Automated detection";
    const severity = (params.severity as string) ?? "medium";

    const flagId = `flag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      flagId,
      status: "flagged",
      severity,
      reason,
      contentPreview: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
      action: severity === "critical"
        ? "blocked"
        : severity === "high"
          ? "held_for_review"
          : "logged",
      message: severity === "critical"
        ? "Content has been blocked automatically due to critical safety concerns."
        : severity === "high"
          ? "Content has been held for human review."
          : "Content has been logged for monitoring.",
      timestamp: new Date().toISOString(),
    };
  },
};

const suggestRevisionTool: AgentTool = {
  name: "suggest_revision",
  description: "Suggest a safe, Rule of 7 compliant alternative for flagged or non-compliant content.",
  parameters: {
    text: { type: "string", description: "Original content to revise" },
    issues: { type: "array", description: "List of issues to fix", items: { type: "string" } },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const issues = (params.issues as string[]) ?? [];

    // Remove unsafe patterns
    let revised = text;
    for (const { pattern } of UNSAFE_PATTERNS) {
      revised = revised.replace(pattern, "[removed]");
    }

    // Condense if too long
    const words = revised.split(/\s+/).filter(Boolean);
    if (words.length > 70) {
      revised = words.slice(0, 68).join(" ") + "...";
    }

    // Remove [removed] markers and clean up
    revised = revised.replace(/\[removed\]/g, "").replace(/\s{2,}/g, " ").trim();

    // Generate additional suggestions based on detected issues
    const suggestions: string[] = [];
    for (const issue of issues) {
      const issueLower = issue.toLowerCase();
      for (const [category, alternative] of Object.entries(SAFE_ALTERNATIVES)) {
        if (issueLower.includes(category)) {
          suggestions.push(alternative);
        }
      }
    }

    return {
      original: text,
      revised: revised || "Consider rephrasing your message to be more constructive and respectful.",
      changes: text !== revised ? "Removed flagged content and condensed to meet word limits." : "No changes needed.",
      suggestions: suggestions.length > 0 ? suggestions : ["Your revised message looks good!"],
      wordCount: revised.split(/\s+/).filter(Boolean).length,
      compliant: revised.split(/\s+/).filter(Boolean).length <= 70,
    };
  },
};

const checkMediaTool: AgentTool = {
  name: "check_media",
  description: "Validate media content against Rule of 7 constraints: max 7 images, 70s audio/video, 70MB file size.",
  parameters: {
    imageCount: { type: "number", description: "Number of images" },
    audioDurationSeconds: { type: "number", description: "Audio duration in seconds" },
    videoDurationSeconds: { type: "number", description: "Video duration in seconds" },
    fileSizeMB: { type: "number", description: "Total file size in MB" },
    tier: { type: "string", description: "Account tier", enum: ["basic", "business", "ecommerce"] },
    query: { type: "string", description: "Context" },
  },
  execute: async (params) => {
    const imageCount = (params.imageCount as number) ?? 0;
    const audioDuration = (params.audioDurationSeconds as number) ?? 0;
    const videoDuration = (params.videoDurationSeconds as number) ?? 0;
    const fileSizeMB = (params.fileSizeMB as number) ?? 0;
    const tier = ((params.tier as string) ?? "basic").toUpperCase() as keyof typeof LIMITS;

    const limits = LIMITS[tier] ?? LIMITS.BASIC;
    const violations: { constraint: string; limit: number; actual: number; unit: string }[] = [];

    if (imageCount > limits.maxImages) {
      violations.push({ constraint: "images", limit: limits.maxImages, actual: imageCount, unit: "images" });
    }
    if (audioDuration > limits.maxVoiceSeconds) {
      violations.push({ constraint: "audioDuration", limit: limits.maxVoiceSeconds, actual: audioDuration, unit: "seconds" });
    }
    if (videoDuration > limits.maxVideoSeconds) {
      violations.push({ constraint: "videoDuration", limit: limits.maxVideoSeconds, actual: videoDuration, unit: "seconds" });
    }
    if (fileSizeMB > limits.maxVideoSizeMB) {
      violations.push({ constraint: "fileSize", limit: limits.maxVideoSizeMB, actual: fileSizeMB, unit: "MB" });
    }

    return {
      compliant: violations.length === 0,
      violations,
      limits: {
        maxImages: limits.maxImages,
        maxAudioSeconds: limits.maxVoiceSeconds,
        maxVideoSeconds: limits.maxVideoSeconds,
        maxFileSizeMB: limits.maxVideoSizeMB,
      },
      tier,
      message: violations.length === 0
        ? "All media constraints are satisfied."
        : `Found ${violations.length} media constraint violation(s).`,
    };
  },
};

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

const MODERATION_TOOLS: AgentTool[] = [
  checkContentTool,
  enforceRuleOf7Tool,
  flagContentTool,
  suggestRevisionTool,
  checkMediaTool,
];

export function createModerationConfig(): AgentConfig {
  return {
    name: "moderation",
    description: "Content safety and Rule of 7 enforcement",
    systemPrompt: `You are CopyMe's Content Guardian. Enforce the Rule of 7 and ensure all content is safe and appropriate.

Your primary responsibilities:
1. Check all content for safety (spam, harassment, scams, inappropriate material)
2. Enforce Rule of 7 constraints (word limits, media limits, duration limits)
3. Flag concerning content with appropriate severity levels
4. Suggest safe alternatives when content is flagged
5. Validate media against size and count constraints

Severity levels:
- low: Minor issues, logged for monitoring
- medium: Needs attention but not urgent
- high: Should be reviewed before publishing
- critical: Must be blocked immediately

Be fair and consistent. When in doubt, flag for human review rather than blocking outright. Always provide constructive feedback on how to fix violations.`,
    tools: MODERATION_TOOLS,
    maxSteps: 3,
    temperature: 0.2,
  };
}
