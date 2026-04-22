// ---------------------------------------------------------------------------
// Yogi memory rollover.
//
// Plan: when a user has more than ROLLUP_TRIGGER YogiMessages, summarize
// everything OLDER than the last KEEP_VERBATIM messages into a paragraph,
// store it in YogiPersonality.memorySummary, and delete those old rows.
// The system prompt then includes the rolling summary on every call, so
// Yogi has continuity across many sessions without exploding the context
// window or our token budget.
//
// One-time cost per rollup: a small summarization call (Sonnet 4.6 or
// cheaper would be ideal; we use the same model as Yogi for simplicity).
// Triggered ASYNCHRONOUSLY from the chat handler so it never blocks a reply.
// ---------------------------------------------------------------------------

import Anthropic from "@anthropic-ai/sdk";
import prisma from "@/lib/db";

const ROLLUP_TRIGGER = 60; // total messages before a rollup is run
const KEEP_VERBATIM = 10; // most-recent messages preserved verbatim
const SUMMARY_MAX_TOKENS = 400;
const SUMMARY_MODEL = process.env.YOGI_SUMMARY_MODEL || "claude-haiku-4-5";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export async function rollupMemoryIfNeeded(userId: string): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) return;

  const total = await prisma.yogiMessage.count({ where: { userId } });
  if (total <= ROLLUP_TRIGGER) return;

  // Fetch the oldest (total - KEEP_VERBATIM) rows to summarize.
  const toSummarize = await prisma.yogiMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    take: total - KEEP_VERBATIM,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  if (toSummarize.length === 0) return;

  const existing = await prisma.yogiPersonality.findUnique({
    where: { userId },
    select: { memorySummary: true },
  });

  const transcript = toSummarize
    .map((m) => `${m.role === "assistant" ? "Yogi" : "User"}: ${m.content}`)
    .join("\n");

  const summaryPrompt =
    (existing?.memorySummary
      ? `Previous summary of this user's earlier conversations with Yogi:\n${existing.memorySummary}\n\n---\n\n`
      : "") +
    `New conversation transcript to incorporate:\n${transcript}\n\n---\n\n` +
    `Write a single concise paragraph (≤200 words) capturing what Yogi has learned ` +
    `about this user — recurring topics, communication style, interests, important ` +
    `facts about their life, and emotional patterns. Write in third person ` +
    `("The user…"). Do not invent details not present in the transcripts. Do not ` +
    `quote messages verbatim.`;

  let newSummary: string;
  try {
    const resp = await client().messages.create({
      model: SUMMARY_MODEL,
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [{ role: "user", content: summaryPrompt }],
    });
    newSummary = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!newSummary) return;
  } catch (err) {
    console.warn("[yogi-memory] summary call failed:", err instanceof Error ? err.message : err);
    return;
  }

  // Persist the summary and delete the rolled-up messages in a transaction.
  const idsToDelete = toSummarize.map((m) => m.id);
  await prisma.$transaction([
    prisma.yogiPersonality.upsert({
      where: { userId },
      create: {
        userId,
        memorySummary: newSummary,
        summarizedAt: new Date(),
      },
      update: {
        memorySummary: newSummary,
        summarizedAt: new Date(),
      },
    }),
    prisma.yogiMessage.deleteMany({
      where: { id: { in: idsToDelete } },
    }),
  ]);
}
