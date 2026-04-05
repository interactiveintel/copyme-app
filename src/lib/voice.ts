// ---------------------------------------------------------------------------
// Voice utilities — Web Speech API wrappers for STT and TTS
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Speech-to-Text (SpeechRecognition)
// ---------------------------------------------------------------------------

type SpeechRecognitionEvent = Event & {
  results: { [key: number]: { [key: number]: { transcript: string } }; length: number };
  resultIndex: number;
};

export interface VoiceListenerOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult: (transcript: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
}

export function createVoiceListener(options: VoiceListenerOptions) {
  const SpeechRecognition =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    options.onError?.("Speech recognition not supported in this browser");
    return null;
  }

  const recognition = new (SpeechRecognition as new () => {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event & { error: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
    abort: () => void;
  })();

  recognition.lang = options.language || "en-US";
  recognition.continuous = options.continuous ?? false;
  recognition.interimResults = options.interimResults ?? true;

  recognition.onresult = (event: SpeechRecognitionEvent) => {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript;
    const isFinal = !!(result as unknown as { isFinal: boolean }).isFinal;
    options.onResult(transcript, isFinal);
  };

  recognition.onerror = (event) => {
    options.onError?.(event.error);
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    abort: () => recognition.abort(),
  };
}

// ---------------------------------------------------------------------------
// Text-to-Speech (SpeechSynthesis)
// ---------------------------------------------------------------------------

export interface SpeakOptions {
  text: string;
  voice?: string; // Voice name or language
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0 - 2.0
  volume?: number; // 0 - 1.0
  onStart?: () => void;
  onEnd?: () => void;
  onBoundary?: (charIndex: number) => void;
}

export function speak(options: SpeakOptions): { cancel: () => void } {
  const synth = window.speechSynthesis;

  // Cancel any ongoing speech
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(options.text);
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;

  // Try to find a matching voice
  const voices = synth.getVoices();
  if (options.voice) {
    const match = voices.find(
      (v) =>
        v.name.toLowerCase().includes(options.voice!.toLowerCase()) ||
        v.lang.toLowerCase().startsWith(options.voice!.toLowerCase())
    );
    if (match) utterance.voice = match;
  } else {
    // Default to a natural-sounding English voice
    const preferred = voices.find(
      (v) =>
        v.lang.startsWith("en") &&
        (v.name.includes("Samantha") ||
          v.name.includes("Karen") ||
          v.name.includes("Daniel") ||
          v.name.includes("Google") ||
          v.name.includes("Natural"))
    );
    if (preferred) utterance.voice = preferred;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onboundary = (e) => options.onBoundary?.(e.charIndex);

  synth.speak(utterance);

  return { cancel: () => synth.cancel() };
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Check browser support
// ---------------------------------------------------------------------------

export function checkVoiceSupport() {
  return {
    speechRecognition: !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    ),
    speechSynthesis: !!window.speechSynthesis,
  };
}
