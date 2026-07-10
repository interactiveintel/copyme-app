// ---------------------------------------------------------------------------
// Agent Execution Engine — CopyMe Multi-Agent Framework
// ---------------------------------------------------------------------------

import type {
  AgentAction,
  AgentConfig,
  AgentEvent,
  AgentEventHandler,
  AgentMessage,
  AgentResult,
  AgentTool,
  LLMProvider,
  LLMResponse,
} from "./types";
import { ClaudeLLMProvider } from "./claude-provider";

/**
 * Creates the best available LLM provider:
 * - If ANTHROPIC_API_KEY is set → ClaudeLLMProvider (real AI), wrapped
 *   so runtime auth failures degrade to the mock instead of erroring.
 * - Otherwise → MockLLMProvider (pattern-matching demo)
 */
export function createProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) {
    return new ResilientProvider(new ClaudeLLMProvider());
  }
  return new MockLLMProvider();
}

// ---------------------------------------------------------------------------
// v4.16.20: ResilientProvider — a key that is SET but INVALID (revoked,
// rotated, typo'd in Vercel env) used to make every engine-based agent
// (smart-match, chat-assist, onboarding, moderate) return "Agent
// encountered an error: 401…". The env-var check above only covers the
// UNSET case. This wrapper catches auth errors at call time and flips
// to the mock provider for the remainder of the process lifetime, so
// agents keep answering — degraded, not dead.
// ---------------------------------------------------------------------------
class ResilientProvider implements LLMProvider {
  private authFailed = false;
  private mock = new MockLLMProvider();

  constructor(private readonly real: LLMProvider) {}

  async complete(
    messages: AgentMessage[],
    tools: AgentTool[],
    temperature: number,
  ): Promise<LLMResponse> {
    if (this.authFailed) return this.mock.complete(messages, tools, temperature);
    try {
      return await this.real.complete(messages, tools, temperature);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const msg = err instanceof Error ? err.message : String(err);
      if (status === 401 || status === 403 || /401|invalid x-api-key/i.test(msg)) {
        console.warn("[agents] Anthropic auth failed — degrading to MockLLMProvider");
        this.authFailed = true;
        return this.mock.complete(messages, tools, temperature);
      }
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Mock LLM Provider — sophisticated pattern-matching engine
// ---------------------------------------------------------------------------

/**
 * MockLLMProvider simulates an intelligent LLM using pattern matching,
 * keyword extraction, and heuristic tool selection. Designed to produce
 * realistic agent behaviour without requiring an API key.
 */
export class MockLLMProvider implements LLMProvider {
  private callCount = 0;
  // v4.16.4: track which tools have already fired this run so the
  // multi-step chaining logic below can't loop on itself (e.g. call
  // generate_icebreaker, see its result, try to call it again).
  private calledTools = new Set<string>();

  async complete(
    messages: AgentMessage[],
    tools: AgentTool[],
    _temperature: number,
  ): Promise<LLMResponse> {
    this.callCount++;

    // Gather the full conversation into a single searchable string
    const conversation = messages.map((m) => m.content).join("\n");
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const lastAssistantMessage =
      [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

    // v4.16.4: parse the previous step's tool output, so we can chain
    // a follow-up tool when it makes sense (e.g. search_users →
    // generate_icebreaker). engine.ts always pushes tool results as
    // assistant messages with JSON.stringify({tool, result}).
    const lastToolResult = this.parseToolResult(lastAssistantMessage);
    const toolMap = new Map(tools.map((t) => [t.name, t]));

    // ---- Smart Match: chain search_users → generate_icebreaker ------
    // The real Claude provider does this naturally once the API key is
    // valid (system prompt encourages it). MockLLM has to be told.
    // Without this chain, AI search results came back with matches and
    // a reasoning blurb but the "Suggested openers" banner stayed
    // empty whenever Anthropic was unreachable — which is the entire
    // current state of production.
    if (
      lastToolResult?.tool === "search_users" &&
      !this.calledTools.has("generate_icebreaker") &&
      toolMap.has("generate_icebreaker")
    ) {
      const args = this.icebreakerArgsFromSearch(lastToolResult.result, lastUserMessage);
      if (args) {
        this.calledTools.add("generate_icebreaker");
        return { type: "tool_call", toolName: "generate_icebreaker", arguments: args };
      }
    }

    // On second+ call after at least one tool ran: text summary.
    // v4.16.4 (bug fix): previously returned `lastAssistantMessage`
    // verbatim, which was the raw JSON of the last tool result —
    // that JSON dump leaked into SearchScreen's "AI match reasoning"
    // banner. Now uses the agent-aware fallback prose.
    if (this.callCount > 1 && this.calledTools.size > 0) {
      return {
        type: "text",
        content: this.generateFallbackResponse(lastUserMessage, messages),
      };
    }

    // Attempt to match the user intent to an available tool
    const toolMatch = this.selectTool(lastUserMessage, conversation, tools);
    if (toolMatch) {
      this.calledTools.add(toolMatch.name);
      return {
        type: "tool_call",
        toolName: toolMatch.name,
        arguments: toolMatch.args,
      };
    }

    // Fallback: produce a helpful text response
    return {
      type: "text",
      content: this.generateFallbackResponse(lastUserMessage, messages),
    };
  }

  // -------------------------------------------------------------------
  // v4.16.4: helpers for multi-step tool chaining (mock-only).
  // -------------------------------------------------------------------

  private parseToolResult(content: string): { tool: string; result: unknown } | null {
    if (!content || content[0] !== "{") return null;
    try {
      const parsed = JSON.parse(content) as { tool?: unknown; result?: unknown };
      if (typeof parsed.tool === "string" && parsed.result !== undefined) {
        return { tool: parsed.tool, result: parsed.result };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Build generate_icebreaker arguments from the top search result.
   * Returns null when the search yielded no usable candidate (no
   * results, or results without interest tags to anchor an opener on).
   */
  private icebreakerArgsFromSearch(
    result: unknown,
    userQuery: string,
  ): Record<string, unknown> | null {
    const r = result as
      | { results?: Array<Record<string, unknown>> }
      | undefined;
    if (!r || !Array.isArray(r.results) || r.results.length === 0) return null;
    const top = r.results[0] as Record<string, unknown>;
    const rawInterests = Array.isArray(top.interests) ? top.interests : [];
    const interests = rawInterests
      .map((x) => (typeof x === "string" ? x : ""))
      .filter(Boolean)
      .slice(0, 3);
    if (interests.length === 0) return null;
    const targetName = typeof top.displayName === "string" ? top.displayName : "this person";
    const loc = top.location as
      | { cityZip?: unknown; region?: unknown }
      | null
      | undefined;
    const targetLocation =
      (typeof loc?.cityZip === "string" && loc.cityZip) ||
      (typeof loc?.region === "string" && loc.region) ||
      "";
    return {
      sharedInterests: interests,
      targetName,
      targetLocation,
      query: userQuery,
    };
  }

  // -------------------------------------------------------------------------
  // Tool selection heuristics
  // -------------------------------------------------------------------------

  private selectTool(
    userMessage: string,
    _conversation: string,
    tools: AgentTool[],
  ): { name: string; args: Record<string, unknown> } | null {
    const msg = userMessage.toLowerCase();

    const toolMap = new Map(tools.map((t) => [t.name, t]));

    // Smart Match agent tools
    if (toolMap.has("search_users") && this.matchesAny(msg, ["find", "search", "discover", "look for", "who", "people", "users", "connect"])) {
      return { name: "search_users", args: { query: userMessage, limit: 7 } };
    }
    if (toolMap.has("analyze_compatibility") && this.matchesAny(msg, ["compatible", "match", "fit", "score", "compatibility"])) {
      return { name: "analyze_compatibility", args: { query: userMessage } };
    }
    if (toolMap.has("suggest_interests") && this.matchesAny(msg, ["interest", "hobby", "suggest", "recommend"])) {
      return { name: "suggest_interests", args: { query: userMessage } };
    }
    if (toolMap.has("find_nearby") && this.matchesAny(msg, ["near", "nearby", "close", "local", "around", "location"])) {
      return { name: "find_nearby", args: { query: userMessage } };
    }
    if (toolMap.has("generate_icebreaker") && this.matchesAny(msg, ["icebreaker", "conversation starter", "start talking", "say hi", "intro"])) {
      return { name: "generate_icebreaker", args: { query: userMessage } };
    }

    // Chat Assistant agent tools
    if (toolMap.has("suggest_reply") && this.matchesAny(msg, ["reply", "respond", "suggest", "what should i say", "help me write"])) {
      return { name: "suggest_reply", args: { context: userMessage } };
    }
    if (toolMap.has("condense_message") && this.matchesAny(msg, ["condense", "shorten", "shorter", "too long", "trim", "reduce"])) {
      return { name: "condense_message", args: { text: userMessage } };
    }
    if (toolMap.has("detect_language") && this.matchesAny(msg, ["what language", "detect language", "which language"])) {
      return { name: "detect_language", args: { text: userMessage } };
    }
    if (toolMap.has("translate_message") && this.matchesAny(msg, ["translate", "translation", "in spanish", "in french", "in german", "in portuguese"])) {
      const targetLang = this.extractTargetLanguage(msg);
      return { name: "translate_message", args: { text: userMessage, targetLanguage: targetLang } };
    }
    if (toolMap.has("analyze_tone") && this.matchesAny(msg, ["tone", "feeling", "mood", "emotion", "sentiment"])) {
      return { name: "analyze_tone", args: { text: userMessage } };
    }
    if (toolMap.has("suggest_emoji") && this.matchesAny(msg, ["emoji", "emojis", "emoticon"])) {
      return { name: "suggest_emoji", args: { text: userMessage } };
    }

    // Onboarding agent tools
    if (toolMap.has("improve_description") && this.matchesAny(msg, ["improve", "rewrite", "better description", "polish"])) {
      return { name: "improve_description", args: { text: userMessage } };
    }
    if (toolMap.has("validate_profile") && this.matchesAny(msg, ["validate", "check profile", "completeness", "review profile"])) {
      return { name: "validate_profile", args: { query: userMessage } };
    }
    if (toolMap.has("suggest_location_description") && this.matchesAny(msg, ["location", "where", "describe location"])) {
      return { name: "suggest_location_description", args: { text: userMessage } };
    }
    if (toolMap.has("generate_bio") && this.matchesAny(msg, ["bio", "about me", "profile text", "describe myself"])) {
      return { name: "generate_bio", args: { query: userMessage } };
    }

    // Moderation agent tools
    if (toolMap.has("check_content") && this.matchesAny(msg, ["check", "safe", "appropriate", "review", "moderate"])) {
      return { name: "check_content", args: { text: userMessage } };
    }
    if (toolMap.has("enforce_rule_of_7") && this.matchesAny(msg, ["rule of 7", "word limit", "constraint", "enforce"])) {
      return { name: "enforce_rule_of_7", args: { text: userMessage } };
    }
    if (toolMap.has("flag_content") && this.matchesAny(msg, ["flag", "report", "inappropriate"])) {
      return { name: "flag_content", args: { text: userMessage } };
    }
    if (toolMap.has("suggest_revision") && this.matchesAny(msg, ["revise", "fix", "alternative", "rephrase"])) {
      return { name: "suggest_revision", args: { text: userMessage } };
    }
    if (toolMap.has("check_media") && this.matchesAny(msg, ["media", "image", "video", "audio", "file size"])) {
      return { name: "check_media", args: { query: userMessage } };
    }

    // Yogi AI agent tools
    if (toolMap.has("learn_about_user") && this.matchesAny(msg, ["i like", "i love", "i'm into", "my favorite", "i prefer", "i enjoy", "i work", "i am"])) {
      const fact = userMessage.slice(0, 100);
      return { name: "learn_about_user", args: { fact, category: "preference" } };
    }
    if (toolMap.has("analyze_personality") && this.matchesAny(msg, ["how do i communicate", "my style", "analyze me", "personality"])) {
      return { name: "analyze_personality", args: { messages: userMessage } };
    }
    if (toolMap.has("suggest_topic") && this.matchesAny(msg, ["what should we talk about", "topic", "bored", "suggest something", "conversation starter"])) {
      return { name: "suggest_topic", args: { currentMood: "neutral" } };
    }
    if (toolMap.has("adapt_style") && this.matchesAny(msg, ["be more", "be less", "talk like", "more casual", "more formal", "funnier", "serious"])) {
      const aspect = msg.includes("formal") || msg.includes("casual") ? "tone" : msg.includes("funny") || msg.includes("humor") ? "humor" : "tone";
      const direction = msg.includes("more") ? "increase" : "decrease";
      return { name: "adapt_style", args: { aspect, direction } };
    }

    // v4.16.25: smart-match default. AI-mode search sends the raw query
    // ("photography", "Slovenia hiking") as the whole user message —
    // none of the verb keywords above appear, so the mock fell through
    // to text and AI search returned zero results despite matching
    // users existing. For the smart-match toolset, the user's intent
    // IS ALWAYS a search — default to search_users with the raw query.
    // search_users only exists in smart-match's toolset, so other
    // agents are unaffected.
    if (toolMap.has("search_users") && msg.trim().length > 0) {
      return { name: "search_users", args: { query: userMessage, limit: 7 } };
    }

    return null;
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((kw) => text.includes(kw));
  }

  private extractTargetLanguage(msg: string): string {
    const langs: Record<string, string> = {
      spanish: "es", french: "fr", german: "de", portuguese: "pt",
      italian: "it", japanese: "ja", chinese: "zh", korean: "ko",
      arabic: "ar", hindi: "hi", russian: "ru", dutch: "nl",
    };
    for (const [name, code] of Object.entries(langs)) {
      if (msg.includes(name)) return code;
    }
    return "es";
  }

  private generateFallbackResponse(
    userMessage: string,
    messages: AgentMessage[],
  ): string {
    const systemPrompt = messages.find((m) => m.role === "system")?.content ?? "";

    if (systemPrompt.includes("Smart Match")) {
      // v4.16.4: after the search + icebreaker chain runs, surface a
      // result-aware summary instead of a generic "be more specific"
      // nudge. We don't have the LLM's prose reasoning available
      // without a live API key, but we DO know how many matches came
      // back — the response below acknowledges that and points at the
      // per-result "Why:" pills already rendered under each card.
      const lastSearch = [...messages]
        .reverse()
        .map((m) => this.parseToolResult(m.content))
        .find((r) => r?.tool === "search_users");
      const count = lastSearch
        ? (lastSearch.result as { results?: unknown[] })?.results?.length ?? 0
        : 0;
      if (count > 0) {
        return `Found ${count} ${count === 1 ? "person who looks" : "people who look"} like a strong fit based on overlapping interests and location. Each card shows the specific reason underneath — open the one that resonates and pick an opener below.`;
      }
      return `No exact matches surfaced for that query. Try a broader interest tag (e.g. "photography" instead of "abstract macro photography"), or drop the location filter to widen the pool.`;
    }
    if (systemPrompt.includes("Chat Assistant")) {
      return `I can help you communicate more effectively! I can suggest replies, condense messages to fit the Rule of 7 word limits, translate messages, or analyze the tone of a conversation. What would you like help with?`;
    }
    if (systemPrompt.includes("Onboarding")) {
      return `Welcome to CopyMe! I can help you set up a great profile. I can suggest interests, improve your descriptions, or generate a bio that will help others discover you. What would you like to start with?`;
    }
    if (systemPrompt.includes("Content Guardian")) {
      return `Content has been reviewed and appears to be within acceptable guidelines. All Rule of 7 constraints are satisfied.`;
    }
    if (systemPrompt.includes("Yogi")) {
      const responses = [
        `That's interesting! I'm getting to know your communication style better with each message. Tell me more about what matters to you.`,
        `I appreciate you sharing that. The more we chat, the better I understand how to be most helpful. What else is on your mind?`,
        `Great question! I'm always learning from our conversations. Each interaction helps me adapt to your unique style.`,
        `I hear you. As your AI companion, I'm here whenever you need to think through ideas, get creative, or just chat. What's next?`,
        `Thanks for that! I've noted your communication preferences. I'll keep adapting to match your style over time.`,
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }

    return `I've analyzed your request: "${userMessage.slice(0, 50)}${userMessage.length > 50 ? "..." : ""}". How can I help you further?`;
  }
}

// ---------------------------------------------------------------------------
// Agent Engine — the agentic loop
// ---------------------------------------------------------------------------

export class AgentEngine {
  private provider: LLMProvider;

  constructor(provider?: LLMProvider) {
    this.provider = provider ?? createProvider();
  }

  /**
   * Execute an agent with the given config and messages.
   * Runs the think-act-observe loop up to `config.maxSteps` iterations.
   */
  async run(
    config: AgentConfig,
    messages: AgentMessage[],
    onEvent?: AgentEventHandler,
  ): Promise<AgentResult> {
    const actions: AgentAction[] = [];
    const toolMap = new Map(config.tools.map((t) => [t.name, t]));

    // Build the working message history with the system prompt
    const history: AgentMessage[] = [
      { role: "system", content: config.systemPrompt },
      ...messages,
    ];

    let steps = 0;

    while (steps < config.maxSteps) {
      steps++;

      // Emit thinking event
      onEvent?.({ type: "thinking", data: { text: `Step ${steps}: reasoning...` } });

      let response: LLMResponse;
      try {
        response = await this.provider.complete(
          history,
          config.tools,
          config.temperature,
        );
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown LLM error";
        onEvent?.({ type: "error", data: { message: errorMsg } });
        return {
          success: false,
          response: `Agent encountered an error: ${errorMsg}`,
          actions,
          metadata: { steps, error: errorMsg },
        };
      }

      // -----------------------------------------------------------------------
      // Text response — agent is done
      // -----------------------------------------------------------------------
      if (response.type === "text") {
        onEvent?.({ type: "response", data: { text: response.content } });
        return {
          success: true,
          response: response.content,
          actions,
          metadata: { steps, agent: config.name },
        };
      }

      // -----------------------------------------------------------------------
      // Tool call — execute and loop
      // -----------------------------------------------------------------------
      const tool = toolMap.get(response.toolName);
      if (!tool) {
        const errMsg = `Unknown tool: ${response.toolName}`;
        onEvent?.({ type: "error", data: { message: errMsg } });
        // Push an error observation and let the agent recover
        history.push({
          role: "assistant",
          content: `Error: tool "${response.toolName}" not found. Available tools: ${config.tools.map((t) => t.name).join(", ")}`,
        });
        continue;
      }

      onEvent?.({
        type: "tool_call",
        data: { tool: response.toolName, input: response.arguments },
      });

      let output: unknown;
      try {
        output = await tool.execute(response.arguments);
      } catch (err) {
        output = { error: err instanceof Error ? err.message : "Tool execution failed" };
      }

      const action: AgentAction = {
        tool: response.toolName,
        input: response.arguments,
        output,
        timestamp: new Date(),
      };
      actions.push(action);

      onEvent?.({ type: "tool_result", data: { tool: response.toolName, output } });

      // Append the tool result as an assistant message so the LLM sees it
      history.push({
        role: "assistant",
        content: JSON.stringify({ tool: response.toolName, result: output }),
      });
    }

    // Max steps exhausted — return what we have
    const lastAction = actions[actions.length - 1];
    const summaryResponse = lastAction
      ? `Completed ${actions.length} action(s). Last result: ${JSON.stringify(lastAction.output).slice(0, 500)}`
      : "Agent reached maximum steps without producing a final response.";

    onEvent?.({ type: "response", data: { text: summaryResponse } });

    return {
      success: actions.length > 0,
      response: summaryResponse,
      actions,
      metadata: { steps, agent: config.name, maxStepsReached: true },
    };
  }
}
