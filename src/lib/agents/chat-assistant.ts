// ---------------------------------------------------------------------------
// Chat Assistant Agent — conversation enhancement
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentTool } from "./types";

// ---------------------------------------------------------------------------
// Reply suggestion templates — organized by conversation context
// ---------------------------------------------------------------------------

const REPLY_TEMPLATES: Record<string, string[]> = {
  greeting: [
    "Hey! Great to connect with you. How's your day going?",
    "Hi there! I've been looking forward to chatting. What are you up to?",
    "Hello! Nice to meet you. I saw we share some interests!",
  ],
  question: [
    "That's a great question! From my experience, I'd say...",
    "Interesting you ask that — I've actually been thinking about the same thing.",
    "Good question! Here's my take on it...",
  ],
  shared_interest: [
    "I'm so glad we both enjoy that! What got you started?",
    "No way, me too! We should definitely share tips.",
    "That's awesome! I've been into it for a while now.",
  ],
  casual: [
    "Ha, that's really cool! Tell me more about it.",
    "That sounds amazing! I'd love to hear the full story.",
    "Oh nice! I totally get what you mean.",
  ],
  professional: [
    "Thank you for sharing that. I think there's real potential for collaboration here.",
    "I appreciate your perspective. Let me share some thoughts on how we might work together.",
    "That's a solid approach. Have you considered expanding on that idea?",
  ],
  empathetic: [
    "I completely understand how you feel. That sounds challenging.",
    "Thanks for sharing that with me. I'm here if you want to talk more.",
    "That takes courage to share. I really appreciate your openness.",
  ],
  enthusiastic: [
    "This is so exciting! I can't wait to learn more about it!",
    "Wow, that's incredible! You must be really passionate about this.",
    "That's amazing! I love your energy around this topic.",
  ],
};

// ---------------------------------------------------------------------------
// Language detection patterns
// ---------------------------------------------------------------------------

const LANGUAGE_PATTERNS: Record<string, { name: string; markers: RegExp[] }> = {
  en: { name: "English", markers: [/\b(the|and|is|are|was|were|have|has|it|that|this)\b/i] },
  es: { name: "Spanish", markers: [/\b(el|la|los|las|de|en|que|por|con|una?)\b/i] },
  fr: { name: "French", markers: [/\b(le|la|les|de|des|un|une|et|est|que|dans)\b/i] },
  pt: { name: "Portuguese", markers: [/\b(o|a|os|as|de|em|que|por|com|uma?)\b/i] },
  de: { name: "German", markers: [/\b(der|die|das|und|ist|ein|eine|nicht|von|auf)\b/i] },
  it: { name: "Italian", markers: [/\b(il|lo|la|di|che|non|per|una?|con|sono)\b/i] },
  ja: { name: "Japanese", markers: [/[\u3040-\u309F\u30A0-\u30FF]/] },
  zh: { name: "Chinese", markers: [/[\u4E00-\u9FFF]/] },
  ko: { name: "Korean", markers: [/[\uAC00-\uD7AF]/] },
  ar: { name: "Arabic", markers: [/[\u0600-\u06FF]/] },
};

// ---------------------------------------------------------------------------
// Mock translation map — realistic translations for demo
// ---------------------------------------------------------------------------

const TRANSLATIONS: Record<string, Record<string, string>> = {
  es: {
    hello: "hola",
    "how are you": "como estas",
    "nice to meet you": "mucho gusto",
    goodbye: "adios",
    thanks: "gracias",
    "good morning": "buenos dias",
  },
  fr: {
    hello: "bonjour",
    "how are you": "comment allez-vous",
    "nice to meet you": "enchante",
    goodbye: "au revoir",
    thanks: "merci",
    "good morning": "bonjour",
  },
  de: {
    hello: "hallo",
    "how are you": "wie geht es Ihnen",
    "nice to meet you": "freut mich",
    goodbye: "auf Wiedersehen",
    thanks: "danke",
    "good morning": "guten Morgen",
  },
  pt: {
    hello: "ola",
    "how are you": "como voce esta",
    "nice to meet you": "prazer em conhece-lo",
    goodbye: "adeus",
    thanks: "obrigado",
    "good morning": "bom dia",
  },
  ja: {
    hello: "konnichiwa",
    "how are you": "ogenki desu ka",
    "nice to meet you": "hajimemashite",
    goodbye: "sayounara",
    thanks: "arigatou",
    "good morning": "ohayou gozaimasu",
  },
};

// ---------------------------------------------------------------------------
// Tone analysis
// ---------------------------------------------------------------------------

const TONE_INDICATORS: Record<string, { keywords: string[]; emoji: string }> = {
  friendly: { keywords: ["hey", "hi", "cool", "awesome", "nice", "love", "glad", "happy", "fun", "enjoy"], emoji: "😊" },
  professional: { keywords: ["regarding", "please", "would", "appreciate", "opportunity", "discuss", "proposal", "meeting"], emoji: "💼" },
  urgent: { keywords: ["asap", "urgent", "immediately", "emergency", "critical", "deadline", "hurry", "now"], emoji: "⚡" },
  casual: { keywords: ["lol", "haha", "yeah", "nah", "gonna", "wanna", "kinda", "btw", "sup"], emoji: "😄" },
  enthusiastic: { keywords: ["amazing", "incredible", "fantastic", "wow", "excited", "thrilled", "love", "brilliant"], emoji: "🎉" },
  empathetic: { keywords: ["sorry", "understand", "feel", "care", "support", "hope", "wish", "thinking of"], emoji: "💛" },
  inquisitive: { keywords: ["how", "why", "what", "when", "where", "curious", "wonder", "question"], emoji: "🤔" },
};

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const suggestReplyTool: AgentTool = {
  name: "suggest_reply",
  description: "Generate 3 contextually appropriate reply suggestions based on conversation history and detected tone.",
  parameters: {
    context: { type: "string", description: "The recent conversation context or last message received" },
    tone: { type: "string", description: "Preferred tone: friendly, professional, casual, enthusiastic", enum: ["friendly", "professional", "casual", "enthusiastic", "empathetic"] },
  },
  execute: async (params) => {
    const context = ((params.context as string) ?? "").toLowerCase();
    const preferredTone = (params.tone as string) ?? "";

    // Detect context type
    let contextType = "casual";
    if (context.match(/\?|how|what|why|when/)) contextType = "question";
    if (context.match(/hi|hello|hey|greetings/)) contextType = "greeting";
    if (context.match(/interest|hobby|love|passion|enjoy/)) contextType = "shared_interest";
    if (preferredTone === "professional" || context.match(/work|business|project|meeting/)) contextType = "professional";
    if (context.match(/sorry|sad|difficult|hard|struggle/)) contextType = "empathetic";
    if (context.match(/amazing|awesome|incredible|exciting/)) contextType = "enthusiastic";

    const replies = REPLY_TEMPLATES[contextType] ?? REPLY_TEMPLATES.casual;

    return {
      suggestions: replies.map((text, i) => ({
        id: i + 1,
        text,
        tone: contextType,
        wordCount: text.split(/\s+/).length,
        withinRuleOf7: text.split(/\s+/).length <= 70,
      })),
      detectedContext: contextType,
      tip: "All suggestions are within the 70-word limit for Basic tier.",
    };
  },
};

const condenseMessageTool: AgentTool = {
  name: "condense_message",
  description: "Rewrite a message to fit within 70 words while preserving the core meaning. Essential for Rule of 7 compliance.",
  parameters: {
    text: { type: "string", description: "The message to condense" },
    targetWords: { type: "number", description: "Target word count (default 70)" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const targetWords = (params.targetWords as number) ?? 70;
    const words = text.split(/\s+/).filter(Boolean);
    const originalCount = words.length;

    if (originalCount <= targetWords) {
      return {
        condensed: text,
        originalWordCount: originalCount,
        condensedWordCount: originalCount,
        alreadyCompliant: true,
        message: "Your message is already within the word limit!",
      };
    }

    // Smart condensation: keep first sentence, summarize the rest
    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    let condensed = "";
    let wordCount = 0;

    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\s+/).length;
      if (wordCount + sentenceWords <= targetWords) {
        condensed += sentence.trim() + " ";
        wordCount += sentenceWords;
      } else {
        break;
      }
    }

    // If even the first sentence is too long, truncate intelligently
    if (condensed.trim().length === 0) {
      condensed = words.slice(0, targetWords).join(" ") + "...";
      wordCount = targetWords;
    }

    return {
      condensed: condensed.trim(),
      originalWordCount: originalCount,
      condensedWordCount: wordCount,
      reduction: `${Math.round(((originalCount - wordCount) / originalCount) * 100)}%`,
      alreadyCompliant: false,
    };
  },
};

const detectLanguageTool: AgentTool = {
  name: "detect_language",
  description: "Detect the language of a given text message.",
  parameters: {
    text: { type: "string", description: "Text to analyze" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";

    let bestMatch = { code: "en", name: "English", confidence: 0.5 };

    for (const [code, { name, markers }] of Object.entries(LANGUAGE_PATTERNS)) {
      for (const marker of markers) {
        const matches = text.match(new RegExp(marker, "gi"));
        if (matches) {
          const confidence = Math.min(0.95, 0.3 + matches.length * 0.1);
          if (confidence > bestMatch.confidence) {
            bestMatch = { code, name, confidence };
          }
        }
      }
    }

    return {
      language: bestMatch.name,
      code: bestMatch.code,
      confidence: Math.round(bestMatch.confidence * 100),
      script: bestMatch.code === "ja" ? "Japanese (mixed)" : bestMatch.code === "zh" ? "Chinese characters" : "Latin",
    };
  },
};

const translateMessageTool: AgentTool = {
  name: "translate_message",
  description: "Translate a message to a target language. Supports major languages.",
  parameters: {
    text: { type: "string", description: "Text to translate" },
    targetLanguage: { type: "string", description: "ISO 639-1 code (e.g., 'es', 'fr', 'de')" },
    sourceLanguage: { type: "string", description: "Source language code (auto-detected if omitted)" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const target = (params.targetLanguage as string) ?? "es";
    const langName = LANGUAGE_PATTERNS[target]?.name ?? target;

    // Check for known translations
    const textLower = text.toLowerCase().trim();
    const translations = TRANSLATIONS[target] ?? {};
    const directTranslation = translations[textLower];

    if (directTranslation) {
      return {
        original: text,
        translated: directTranslation,
        sourceLanguage: "English",
        targetLanguage: langName,
        confidence: 95,
      };
    }

    // Generate a plausible mock translation
    const mockTranslation = `[${langName}] ${text}`;

    return {
      original: text,
      translated: mockTranslation,
      sourceLanguage: "English",
      targetLanguage: langName,
      confidence: 85,
      note: "Translation generated by CopyMe AI. For critical communications, consider verifying with a native speaker.",
    };
  },
};

const analyzeToneTool: AgentTool = {
  name: "analyze_tone",
  description: "Analyze the emotional tone and sentiment of a message. Returns primary and secondary tones with confidence scores.",
  parameters: {
    text: { type: "string", description: "Text to analyze for tone" },
  },
  execute: async (params) => {
    const text = ((params.text as string) ?? "").toLowerCase();

    const scores: { tone: string; score: number; emoji: string }[] = [];

    for (const [tone, { keywords, emoji }] of Object.entries(TONE_INDICATORS)) {
      const matchCount = keywords.filter((kw) => text.includes(kw)).length;
      if (matchCount > 0) {
        scores.push({
          tone,
          score: Math.min(95, matchCount * 20 + 30),
          emoji,
        });
      }
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Default if nothing matched
    if (scores.length === 0) {
      scores.push({ tone: "neutral", score: 60, emoji: "😐" });
    }

    return {
      primaryTone: scores[0],
      secondaryTone: scores[1] ?? null,
      allTones: scores,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      sentimentDirection: scores[0].tone === "urgent" || scores[0].tone === "empathetic" ? "negative-leaning" : "positive-leaning",
      suggestion: scores[0].tone === "urgent"
        ? "Consider softening the urgency if this is not time-critical."
        : scores[0].tone === "professional"
          ? "Great professional tone! This reads well for business contexts."
          : "Your tone feels warm and approachable. Great for building connections!",
    };
  },
};

const suggestEmojiTool: AgentTool = {
  name: "suggest_emoji",
  description: "Suggest relevant emoji that match the mood and content of a message.",
  parameters: {
    text: { type: "string", description: "Message to suggest emoji for" },
  },
  execute: async (params) => {
    const text = ((params.text as string) ?? "").toLowerCase();

    const emojiMap: Record<string, string[]> = {
      happy: ["😊", "😄", "🎉", "✨", "🌟"],
      sad: ["😢", "💙", "🫂", "💛", "🌧"],
      love: ["❤️", "💕", "🥰", "💖", "😍"],
      work: ["💼", "📊", "🚀", "💡", "🎯"],
      food: ["🍕", "🍜", "🧑‍🍳", "😋", "🍽"],
      travel: ["✈️", "🌍", "🗺", "🏔", "🌅"],
      music: ["🎵", "🎸", "🎶", "🎤", "🎧"],
      sport: ["⚽", "🏃", "💪", "🏆", "🎮"],
      nature: ["🌿", "🌺", "🌊", "🦋", "☀️"],
      tech: ["💻", "🤖", "📱", "⚙️", "🔧"],
      greeting: ["👋", "🤝", "😊", "🙌", "✌️"],
      thanks: ["🙏", "💛", "✨", "😊", "🌟"],
    };

    const matched: string[] = [];

    for (const [category, emojis] of Object.entries(emojiMap)) {
      if (text.includes(category) || (category === "greeting" && text.match(/hi|hello|hey/)) || (category === "thanks" && text.match(/thank|appreciate|grateful/))) {
        matched.push(...emojis.slice(0, 3));
      }
    }

    // Default suggestions if nothing matched
    if (matched.length === 0) {
      matched.push("👍", "😊", "✨", "💬", "🙌");
    }

    const unique = [...new Set(matched)].slice(0, 7);

    return {
      emojis: unique,
      count: unique.length,
      tip: "Use emoji sparingly in CopyMe — they count toward your word limit!",
    };
  },
};

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

const CHAT_ASSISTANT_TOOLS: AgentTool[] = [
  suggestReplyTool,
  condenseMessageTool,
  detectLanguageTool,
  translateMessageTool,
  analyzeToneTool,
  suggestEmojiTool,
];

export function createChatAssistantConfig(): AgentConfig {
  return {
    name: "chat-assistant",
    description: "AI-powered conversation enhancement within Rule of 7 constraints",
    systemPrompt: `You are CopyMe's Chat Assistant. You help users communicate more effectively within the Rule of 7 constraints.

Key rules you enforce:
- Messages must be 70 words or fewer (Basic tier)
- Suggestions should be concise and impactful
- Respect the user's tone preferences
- Always remind about word limits when relevant

Your capabilities:
1. Suggest contextually appropriate replies (3 options per request)
2. Condense long messages to fit the 70-word limit
3. Detect and translate between languages
4. Analyze message tone to help users communicate better
5. Suggest emoji that match the message mood

Be helpful, friendly, and always keep the Rule of 7 in mind.`,
    tools: CHAT_ASSISTANT_TOOLS,
    maxSteps: 3,
    temperature: 0.6,
  };
}
