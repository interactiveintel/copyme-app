// ---------------------------------------------------------------------------
// Agent Type System — CopyMe Multi-Agent Framework
// ---------------------------------------------------------------------------

/** A single message in an agent conversation. */
export interface AgentMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** JSON-schema-style parameter definition for agent tools. */
export interface AgentToolParameter {
  type: string;
  description?: string;
  enum?: string[];
  items?: AgentToolParameter;
  properties?: Record<string, AgentToolParameter>;
  required?: string[];
}

/** A tool that an agent can invoke during execution. */
export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, AgentToolParameter>;
  execute: (params: Record<string, unknown>) => Promise<unknown>;
}

/** Full configuration for an agent instance. */
export interface AgentConfig {
  /** Unique name identifying this agent (e.g. "smart-match"). */
  name: string;
  /** Human-readable description of what this agent does. */
  description: string;
  /** The system prompt that defines the agent's persona and instructions. */
  systemPrompt: string;
  /** Tools available to this agent. */
  tools: AgentTool[];
  /** Maximum tool-call iterations before the engine forces a final response. */
  maxSteps: number;
  /** LLM temperature (0-1). Lower = more deterministic. */
  temperature: number;
}

/** A single action taken by the agent during execution. */
export interface AgentAction {
  tool: string;
  input: Record<string, unknown>;
  output: unknown;
  timestamp: Date;
}

/** The final result returned after an agent run completes. */
export interface AgentResult {
  success: boolean;
  response: string;
  actions: AgentAction[];
  metadata: Record<string, unknown>;
}

/** Events emitted during agent execution for streaming to the UI. */
export type AgentEvent =
  | { type: "thinking"; data: { text: string } }
  | { type: "tool_call"; data: { tool: string; input: Record<string, unknown> } }
  | { type: "tool_result"; data: { tool: string; output: unknown } }
  | { type: "response"; data: { text: string } }
  | { type: "error"; data: { message: string } };

/** Callback for receiving agent events in real-time. */
export type AgentEventHandler = (event: AgentEvent) => void;

/**
 * Provider-agnostic LLM interface. Implement this to swap between
 * Claude, OpenAI, local models, or the built-in mock engine.
 */
export interface LLMProvider {
  /** Generate a completion. Return either a text response or a tool call. */
  complete(
    messages: AgentMessage[],
    tools: AgentTool[],
    temperature: number,
  ): Promise<LLMResponse>;
}

/** Discriminated union for LLM responses. */
export type LLMResponse =
  | { type: "text"; content: string }
  | { type: "tool_call"; toolName: string; arguments: Record<string, unknown> };
