// Cross-language translation pipeline (A3 / S-135).
//
// Called from /api/messages/send when receiver's preferredLocale differs
// from the sender's detected message language. Translates via Anthropic's
// cheapest model (Haiku) so the per-message cost stays under 0.001 USD at
// typical Rule-of-7 message lengths.
//
// Three guards in front of the model call:
//   1. Skip short utterances (< 4 words) — usually emoji / "ok" / "hi".
//   2. Hash + Redis-cache identical (text, fromLocale, toLocale) tuples
//      with 24h TTL so common phrases don't re-bill.
//   3. Per-user daily budget (default $0.10/day) tracked in
//      translation_cost_logs, matching the Yogi cost-cap pattern.

import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { redis } from "@/lib/redis";
import { addBreadcrumb, reportError } from "@/lib/observability";
import { AI_MODELS } from "@/lib/ai-models";

// Claude Haiku — fastest + cheapest. Pricing as of 2026-05: $0.25 / $1.25 per M
// tokens input/output. A 70-word message round-trips in ~200 tokens → ~$0.0005.
const TRANSLATION_MODEL = AI_MODELS.translation;
const MAX_OUTPUT_TOKENS = 200;
const DAILY_COST_CAP_MICRO_USD = Number(process.env.TRANSLATION_DAILY_COST_CAP_MICRO_USD ?? "100000"); // $0.10
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const MIN_WORDS = 4;

// Pricing (micro-USD per token). Anthropic publishes in dollars/MTok; converted.
const INPUT_MICRO_USD_PER_TOKEN = 0.25; // $0.25/MTok ÷ 1,000,000 × 1,000,000
const OUTPUT_MICRO_USD_PER_TOKEN = 1.25;

export interface TranslateOpts {
  /** The text to translate. */
  text: string;
  /** BCP-47 code of the source language. Pass "auto" to let the model detect. */
  fromLocale: string;
  /** BCP-47 code of the target language. */
  toLocale: string;
  /** The user being billed for this call. */
  userId: string;
}

export interface TranslateResult {
  /** Translated text. Falls back to the original on failure. */
  text: string;
  /** True if a model call was actually made (vs short-circuit / cache / cap). */
  modelCalled: boolean;
  /** True if cache hit. */
  cached: boolean;
  /** Detected source language (if `fromLocale === "auto"` and model detected one). */
  detectedLocale?: string;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  _client = new Anthropic({ apiKey: key });
  return _client;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function cacheKey(t: TranslateOpts): string {
  const h = createHash("sha256")
    .update(`${t.fromLocale}|${t.toLocale}|${t.text}`)
    .digest("hex")
    .slice(0, 24);
  return `tr:${h}`;
}

/** Read cached translation, if any. */
async function readCache(t: TranslateOpts): Promise<string | null> {
  try {
    const v = await redis.get(cacheKey(t));
    return typeof v === "string" ? v : null;
  } catch {
    return null;
  }
}

async function writeCache(t: TranslateOpts, translated: string): Promise<void> {
  try {
    await redis.set(cacheKey(t), translated, "EX", CACHE_TTL_SECONDS);
  } catch {
    /* cache best-effort */
  }
}

/** Total micro-USD already spent by `userId` today. */
async function getSpentToday(userId: string): Promise<number> {
  const row = await prisma.translationCostLog.findUnique({
    where: { userId_day: { userId, day: todayUtc() } },
  });
  return row?.costMicroUsd ?? 0;
}

async function bumpCost(
  userId: string,
  inputTokens: number,
  outputTokens: number,
): Promise<void> {
  const costMicroUsd = Math.round(
    inputTokens * INPUT_MICRO_USD_PER_TOKEN + outputTokens * OUTPUT_MICRO_USD_PER_TOKEN,
  );
  await prisma.translationCostLog.upsert({
    where: { userId_day: { userId, day: todayUtc() } },
    create: {
      userId,
      day: todayUtc(),
      inputTokens,
      outputTokens,
      costMicroUsd,
      callCount: 1,
    },
    update: {
      inputTokens: { increment: inputTokens },
      outputTokens: { increment: outputTokens },
      costMicroUsd: { increment: costMicroUsd },
      callCount: { increment: 1 },
    },
  });
}

// v4.16.22: locale-code → prompt-facing language name. Uses the APP's
// code convention (si = Slovenian per STRINGS.si), not raw ISO-639.
const LOCALE_NAMES: Record<string, string> = {
  en: "English",
  si: "Slovenian",
  sl: "Slovenian",
  es: "Spanish",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  ja: "Japanese",
  zh: "Chinese",
  ko: "Korean",
  ar: "Arabic",
  hi: "Hindi",
  ru: "Russian",
  nl: "Dutch",
};

function localeName(code: string): string {
  return LOCALE_NAMES[code.toLowerCase().slice(0, 2)] ?? code;
}

/**
 * Translate `text` from `fromLocale` to `toLocale`.
 *
 * Returns the translated text, plus signals for the caller (was the
 * model actually called, did we hit cache, was a language detected).
 * On any failure path (missing API key, model error, budget exhausted),
 * returns the original text — the caller stores `translatedText = null`
 * in that case.
 */
export async function translate(opts: TranslateOpts): Promise<TranslateResult> {
  const { text, fromLocale, toLocale, userId } = opts;

  // 1. Guard — same locale or empty → no-op.
  if (!text || !text.trim()) return { text, modelCalled: false, cached: false };
  if (fromLocale === toLocale) return { text, modelCalled: false, cached: false };

  // 2. Guard — too short to bother translating.
  if (wordCount(text) < MIN_WORDS) {
    return { text, modelCalled: false, cached: false };
  }

  // 3. Cache.
  const cached = await readCache(opts);
  if (cached) {
    addBreadcrumb("translation.cache_hit", { fromLocale, toLocale });
    return { text: cached, modelCalled: false, cached: true };
  }

  // 4. Budget.
  const spent = await getSpentToday(userId);
  if (spent >= DAILY_COST_CAP_MICRO_USD) {
    addBreadcrumb("translation.cost_cap_hit", { userId, spent });
    return { text, modelCalled: false, cached: false };
  }

  // 5. Model.
  const client = getClient();
  if (!client) return { text, modelCalled: false, cached: false };

  // v4.16.22: name languages in full for the prompt. The app's locale
  // codes follow its own convention — notably "si" means SLOVENIAN here
  // (STRINGS.si since S-254), while ISO-639 "si" is Sinhala. Passing
  // the raw code would make the model translate Joze's messages into
  // Sinhala. Unknown codes fall through as-is.
  const toName = localeName(toLocale);
  const fromName = localeName(fromLocale);
  const prompt =
    fromLocale === "auto"
      ? `Translate the following message into ${toName}. Return ONLY the translation, no preamble, no quotes. Preserve emoji and tone.\n\nMessage:\n${text}`
      : `Translate the following ${fromName} message into ${toName}. Return ONLY the translation, no preamble, no quotes. Preserve emoji and tone.\n\nMessage:\n${text}`;

  try {
    const resp = await client.messages.create({
      model: TRANSLATION_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    const translated = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { text: string }).text)
      .join("")
      .trim();

    if (!translated || translated === text) {
      return { text, modelCalled: true, cached: false };
    }

    await bumpCost(userId, resp.usage.input_tokens, resp.usage.output_tokens);
    await writeCache(opts, translated);
    addBreadcrumb("translation.completed", {
      fromLocale,
      toLocale,
      bytesIn: text.length,
      bytesOut: translated.length,
    });
    return { text: translated, modelCalled: true, cached: false };
  } catch (err) {
    reportError(err, { context: "translation_failed", fromLocale, toLocale });
    return { text, modelCalled: false, cached: false };
  }
}

/**
 * Best-effort source-language detection. Returns a BCP-47 tag or "und"
 * (undetermined). Used in the send route to populate
 * `Message.languageOriginal`. We avoid a separate model call by sniffing
 * cheap signals first; fall back to Haiku if heuristics don't decide.
 *
 * Caller can pass `userBudgetUserId` to allow heuristic-fallback model
 * detection to be billed; if omitted, no model call ever happens.
 */
export function detectLocaleHeuristic(text: string): string {
  const t = text.toLowerCase();
  // Slovenian/Croatian/Serbian common short words (very rough).
  if (/\b(je|in|sem|si|smo|kaj|nisem|nismo|hvala|prosim|dober|dobra)\b/.test(t)) return "sl";
  // Spanish.
  if (/\b(qué|de|la|que|el|en|y|los|las|tú|hola|gracias|por\s+favor)\b/.test(t)) return "es";
  // German.
  if (/\b(ich|das|ist|nicht|und|der|die|hallo|danke|bitte|guten)\b/.test(t)) return "de";
  // French.
  if (/\b(je|le|la|et|de|merci|bonjour|c'est|je\s+suis|oui|non)\b/.test(t)) return "fr";
  // Italian.
  if (/\b(io|è|sono|grazie|ciao|prego|buongiorno|si|no)\b/.test(t)) return "it";
  // Default English.
  if (/\b(the|and|is|i|you|hello|thanks|please)\b/.test(t)) return "en";
  return "und";
}
