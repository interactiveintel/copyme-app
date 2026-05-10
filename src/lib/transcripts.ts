// Voice / video transcripts (S-135).
//
// The actual STT call goes to a third-party (e.g. Whisper / Deepgram /
// Anthropic). This module is the seam — `transcribe()` returns the
// transcript text for a given clip URL. By default we return an empty
// transcript so the rest of the app doesn't block on the integration.
// The user-facing toggle lives in Profile → Privacy and writes to
// `userPrefs.transcripts`.

import { addBreadcrumb } from "@/lib/observability";

export interface TranscribeResult {
  text: string;
  language?: string;
  confidence?: number;
  /** Provider that produced this transcript (for debugging & cost tracking). */
  provider: string;
}

export type TranscriptProvider = (clipUrl: string, mime: string) => Promise<TranscribeResult>;

let provider: TranscriptProvider | null = null;

export function registerTranscriptProvider(p: TranscriptProvider): void {
  provider = p;
}

export async function transcribe(clipUrl: string, mime: string): Promise<TranscribeResult> {
  addBreadcrumb("transcripts.requested", { mime });
  if (!provider) {
    return {
      text: "",
      provider: "noop",
      confidence: 0,
    };
  }
  try {
    return await provider(clipUrl, mime);
  } catch (err) {
    addBreadcrumb("transcripts.error", { reason: (err as Error).message });
    return { text: "", provider: "error", confidence: 0 };
  }
}
