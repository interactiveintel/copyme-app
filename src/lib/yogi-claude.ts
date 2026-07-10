// ---------------------------------------------------------------------------
// Yogi → Claude Messages API.
//
// This module is intentionally Yogi-specific (separate from the broader
// agents/claude-provider.ts) so we can take full advantage of:
//   - Prompt caching on the system prompt + personality block
//   - Per-call usage telemetry for cost capping
//   - The Opus 4.7 default with adaptive thinking
//
// The personality + last-50-summary live in the system prompt (cacheable);
// the recent conversation tail goes into `messages` (not cached). This gives
// us strong cache hit rates for active conversations within the 5-minute
// ephemeral window.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = process.env.YOGI_MODEL || "claude-opus-4-7";
const MAX_TOKENS = 1024; // Yogi replies are conversational, not essay-length.

// Pricing per 1M tokens (USD). Used to estimate cost for the per-day cap.
// Update if YOGI_MODEL changes.
const PRICING_BY_MODEL: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-7": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-6": { input: 5.0, output: 25.0, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
};

function pricing() {
  return PRICING_BY_MODEL[MODEL_ID] ?? PRICING_BY_MODEL["claude-opus-4-7"]!;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface YogiCallInput {
  /** Stable system instruction (persona, tone, ground rules). Cacheable. */
  baseInstruction: string;
  /** Per-user personality block (humor, empathy, interests, style). Cacheable. */
  personalityBlock: string;
  /** Optional rolling memory summary (the "last 50 turns" condensed). Cacheable. */
  memorySummary?: string;
  /**
   * Recent conversation history to include verbatim. Order: oldest → newest.
   * Each entry will be passed as-is in the `messages` array (NOT cached).
   */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** The user's new message. */
  userMessage: string;
}

export interface YogiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** Estimated cost in micro-USD (1/1,000,000 USD) — integer for DB storage. */
  costMicroUsd: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

export function isYogiClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/**
 * Send one Yogi conversational turn to Claude with prompt caching enabled.
 *
 * The cacheable prefix is the system prompt (baseInstruction + personality +
 * memorySummary). The variable suffix is `messages`. Auto-cache via the
 * top-level `cache_control` would also work, but we place the marker
 * explicitly on the last system block so the cached unit is well-defined.
 */
export async function callYogi(input: YogiCallInput): Promise<YogiCallResult> {
  const client = getClient();

  // Build the system prompt as an array of text blocks so we can attach
  // cache_control to the last block. Anthropic renders tools→system→messages
  // in order; a marker on the last system block caches everything before it.
  const systemBlocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: input.baseInstruction },
    { type: "text", text: `\n\n${input.personalityBlock}` },
  ];
  if (input.memorySummary && input.memorySummary.trim()) {
    systemBlocks.push({
      type: "text",
      text: `\n\nLong-term context (summarized from earlier conversations):\n${input.memorySummary}`,
    });
  }
  // Cache marker on the last system block.
  systemBlocks[systemBlocks.length - 1]!.cache_control = { type: "ephemeral" };

  const messages: Anthropic.MessageParam[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: input.userMessage },
  ];

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: systemBlocks,
      messages,
    });
  } catch (err) {
    // v4.16.20: auth failures (revoked/rotated key) degrade to a canned
    // companion reply instead of a 500. Every message erroring with
    // "Yogi had a hiccup" is exactly how beta feedback read as "Yogi is
    // not active". Non-auth errors still propagate — those are
    // transient and the route's catch-all handles them.
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      console.warn("[yogi-claude] Anthropic auth failed — degraded reply served");
      return {
        text: degradedYogiReply(input.userMessage),
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        costMicroUsd: 0,
      };
    }
    throw err;
  }

  // Concatenate text blocks (skip thinking / tool blocks — Yogi doesn't use tools).
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const usage = response.usage;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  // Cost in micro-USD (integer for DB storage). Each price is per 1M tokens.
  const p = pricing();
  const costUsd =
    (inputTokens * p.input +
      outputTokens * p.output +
      cacheReadTokens * p.cacheRead +
      cacheWriteTokens * p.cacheWrite) /
    1_000_000;
  const costMicroUsd = Math.round(costUsd * 1_000_000);

  return {
    text: text || "I'm not sure what to say to that — try asking me something else?",
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    costMicroUsd,
  };
}

// ---------------------------------------------------------------------------
// v4.16.20: degraded-mode replies when Anthropic auth fails.
//
// Deliberately honest — Yogi says it's running in a limited mode rather
// than pretending to be the full model. Varies by a cheap hash of the
// user message so back-to-back sends don't repeat one string.
// ---------------------------------------------------------------------------
const DEGRADED_REPLIES = [
  "I'm running in limited mode right now — my full brain is briefly offline while the team reconnects it. I can still keep you company! What's on your mind?",
  "Heads up: I'm on backup power at the moment, so my replies are simpler than usual. The team is on it. Tell me what you're up to anyway?",
  "My smart half is temporarily unreachable — the team is restoring it. Meanwhile: how's your day actually going?",
  "I'm in lightweight mode right now (connection to my full model is being fixed). Happy to chat — what would you like to talk about?",
] as const;

function degradedYogiReply(userMessage: string): string {
  let h = 0;
  for (let i = 0; i < userMessage.length; i++) h = (h * 31 + userMessage.charCodeAt(i)) | 0;
  return DEGRADED_REPLIES[Math.abs(h) % DEGRADED_REPLIES.length];
}
