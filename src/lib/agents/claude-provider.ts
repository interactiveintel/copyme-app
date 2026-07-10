// ---------------------------------------------------------------------------
// Claude LLM Provider — Anthropic SDK implementation for CopyMe Agents
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentMessage,
  AgentTool,
  AgentToolParameter,
  LLMProvider,
  LLMResponse,
} from "./types";
import { AI_MODELS, modelAcceptsTemperature } from "@/lib/ai-models";

/**
 * Maps our AgentToolParameter schema to Anthropic's JSON Schema format
 * for tool input_schema.
 */
function buildInputSchema(
  params: Record<string, AgentToolParameter>,
): Anthropic.Tool["input_schema"] {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, param] of Object.entries(params)) {
    const prop: Record<string, unknown> = { type: param.type };
    if (param.description) prop.description = param.description;
    if (param.enum) prop.enum = param.enum;
    if (param.items) prop.items = { type: param.items.type };
    if (param.properties) {
      prop.properties = {};
      for (const [k, v] of Object.entries(param.properties)) {
        (prop.properties as Record<string, unknown>)[k] = {
          type: v.type,
          ...(v.description && { description: v.description }),
          ...(v.enum && { enum: v.enum }),
        };
      }
    }
    properties[key] = prop;

    // Treat all params as required unless they have a default-like setup
    if (param.type !== "boolean") {
      required.push(key);
    }
  }

  return {
    type: "object" as const,
    properties,
    ...(required.length > 0 && { required }),
  };
}

/**
 * Converts our AgentTool[] to Anthropic's tool format.
 */
function toAnthropicTools(tools: AgentTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: buildInputSchema(tool.parameters),
  }));
}

/**
 * Converts our AgentMessage[] to Anthropic's message format.
 * Extracts the system prompt separately (Anthropic requires it as a top-level param).
 */
function toAnthropicMessages(messages: AgentMessage[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  let system = "";
  const anthropicMessages: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      system += (system ? "\n\n" : "") + msg.content;
    } else {
      anthropicMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  // Anthropic requires at least one user message
  if (anthropicMessages.length === 0) {
    anthropicMessages.push({ role: "user", content: "Begin." });
  }

  // v4.16.29: normalize to a valid Anthropic turn sequence. The agent
  // engine represents each tool result as a trailing `assistant`
  // message, which produces (a) consecutive same-role messages when
  // multiple tools run and (b) a conversation ending on `assistant`.
  // Sonnet 5 (and current models generally) reject both: roles must
  // alternate and the last turn must be `user`. Older models tolerated
  // it, which is why this only surfaced after the model bump.
  //
  // Fix: merge consecutive same-role messages, then if the sequence
  // ends on `assistant` (i.e. the last thing the engine did was stash a
  // tool result), append a `user` turn asking the model to continue.
  // Anthropic's own convention is that tool results live in a user
  // turn, so this is semantically faithful, not a hack.
  const merged: Anthropic.MessageParam[] = [];
  for (const m of anthropicMessages) {
    const last = merged[merged.length - 1];
    // Only string-content messages can be merged by concatenation; our
    // producer always emits strings here, but the SDK type allows block
    // arrays, so guard rather than stringify an array into "[object]".
    if (
      last &&
      last.role === m.role &&
      typeof last.content === "string" &&
      typeof m.content === "string"
    ) {
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }
  if (merged[merged.length - 1]!.role === "assistant") {
    merged.push({
      role: "user",
      content: "Continue based on the results above. If you have enough information, give your final answer.",
    });
  }

  return { system, messages: merged };
}

// ---------------------------------------------------------------------------
// Claude Provider
// ---------------------------------------------------------------------------

export class ClaudeLLMProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(options?: { apiKey?: string; model?: string }) {
    this.client = new Anthropic({
      apiKey: options?.apiKey || process.env.ANTHROPIC_API_KEY,
    });
    // Agents run on the current Sonnet (see lib/ai-models). Env
    // override still honored.
    this.model = options?.model || process.env.CLAUDE_MODEL || AI_MODELS.agent;
  }

  async complete(
    messages: AgentMessage[],
    tools: AgentTool[],
    temperature: number,
  ): Promise<LLMResponse> {
    const { system, messages: anthropicMessages } = toAnthropicMessages(messages);
    const anthropicTools = toAnthropicTools(tools);

    // `temperature` is deprecated on current models (400
    // invalid_request_error); only legacy model ids still accept it.
    // Centralized in lib/ai-models so the rule lives in one place.
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      ...(modelAcceptsTemperature(this.model) ? { temperature } : {}),
      system: system || undefined,
      messages: anthropicMessages,
      ...(anthropicTools.length > 0 && { tools: anthropicTools }),
    });

    // Process the response content blocks
    for (const block of response.content) {
      // Tool use — return the first tool call
      if (block.type === "tool_use") {
        return {
          type: "tool_call",
          toolName: block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        };
      }
    }

    // Text response — concatenate all text blocks
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return {
      type: "text",
      content: textContent || "I've completed the analysis.",
    };
  }
}
