// Yogi safety filters (S-205).
//
// Two-stage:
//   - PRE filter: scrub PII (phone, email) before the prompt leaves us.
//   - POST filter: classify the model's reply against hate / self-harm /
//     CSAM-related themes; refuse-and-replace where matched.
//
// The replacement string is constant so the UI can show a friendly message
// instead of leaking the model's raw refusal.

import { addBreadcrumb } from "@/lib/observability";

const PHONE_RE = /\+?\d[\d\s\-().]{7,}\d/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export interface PreScrubResult {
  cleaned: string;
  redactions: number;
}

export function preFilter(input: string): PreScrubResult {
  let redactions = 0;
  const cleaned = input
    .replace(PHONE_RE, () => {
      redactions++;
      return "[redacted-phone]";
    })
    .replace(EMAIL_RE, () => {
      redactions++;
      return "[redacted-email]";
    });
  if (redactions > 0) addBreadcrumb("yogi.pii_scrubbed", { redactions });
  return { cleaned, redactions };
}

const REFUSAL_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: "self_harm", re: /\b(suicide|kill myself|end my life|self[- ]harm)\b/i },
  { name: "hate", re: /\b(genocide|exterminat\w*|racial slur)\b/i },
  { name: "csam", re: /\b(child(ren)? (porn|sexual)|cp|csam)\b/i },
  { name: "weapons", re: /\b(make|build|3d ?print) (a )?(bomb|gun|firearm|explosive)\b/i },
];

export interface PostFilterResult {
  output: string;
  refusedReason?: string;
}

const FRIENDLY_REFUSAL =
  "I can't help with that. If you're in crisis, please reach a local helpline " +
  "(US: 988, EU: 112). Otherwise, ask me something else and I'll do my best.";

export function postFilter(reply: string): PostFilterResult {
  for (const p of REFUSAL_PATTERNS) {
    if (p.re.test(reply)) {
      addBreadcrumb("yogi.refusal", { kind: p.name });
      return { output: FRIENDLY_REFUSAL, refusedReason: p.name };
    }
  }
  return { output: reply };
}

/** Round-trip helper for callers that want a single function. */
export function safeguard(input: string, modelReply: string): PostFilterResult {
  // Pre-filter is for what we send TO the model; we expect the caller to
  // have already applied it. Here we re-apply post-filter on the output.
  void input;
  return postFilter(modelReply);
}
