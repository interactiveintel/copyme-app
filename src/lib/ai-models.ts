// ---------------------------------------------------------------------------
// Claude model IDs — single source of truth (v4.16.31)
// ---------------------------------------------------------------------------
//
// WHY THIS FILE EXISTS: the July 2026 model migration (Sonnet 4 → 5,
// Opus 4.7 → 4.8) required FIVE separate ships because the model ids
// were hardcoded and duplicated across four files (yogi-claude,
// yogi-memory, translation, agents/claude-provider). Each retired id
// surfaced a fresh 404 only once the previous one was fixed. Centralize
// here so the next retirement is a one-line edit with no scavenger hunt.
//
// Per-surface env overrides still win over these defaults — set
// YOGI_MODEL / CLAUDE_MODEL / YOGI_SUMMARY_MODEL to pin a specific id
// (e.g. to roll back to a legacy model) without a code change.

export const AI_MODELS = {
  /** Agent engine: smart-match, chat-assist, onboarding, moderation. */
  agent: "claude-sonnet-5",
  /** Yogi conversational companion. */
  yogi: "claude-opus-4-8",
  /** Message translation (send-path auto-translate + draft-translate). */
  translation: "claude-haiku-4-5-20251001",
  /** Yogi rolling-memory summarization. */
  summary: "claude-haiku-4-5-20251001",
} as const;

/**
 * Whether a model still accepts the (now-deprecated) `temperature`
 * request parameter. Current models (Sonnet 5, Opus 4.8, Haiku 4.5)
 * reject it with a 400; they use their own default instead. Only the
 * older 3.x / 4.0–4.7 families accept it. This is consulted solely so
 * a CLAUDE_MODEL override pointing at a legacy model keeps working —
 * the default agent path (Sonnet 5) never sends temperature.
 */
export function modelAcceptsTemperature(model: string): boolean {
  const m = model.toLowerCase();
  // Rejects come first so version boundaries are unambiguous.
  if (/claude-(sonnet|opus|haiku|fable|mythos)-5\b/.test(m)) return false; // *-5 family
  if (/claude-opus-4-(?:8|9|1\d)\b/.test(m)) return false;                 // opus 4.8+
  if (/claude-haiku-4-5\b/.test(m)) return false;                          // haiku 4.5
  // Legacy families that still accept `temperature`.
  if (/claude-3[-.]/.test(m)) return true;                                 // 3.x
  if (/claude-sonnet-4[-.]/.test(m)) return true;                          // sonnet 4.x
  if (/claude-opus-4-[0-7]\b/.test(m)) return true;                        // opus 4.0–4.7
  // Unknown/future id → safest is to omit temperature (current default).
  return false;
}
