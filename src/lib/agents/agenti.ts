// ---------------------------------------------------------------------------
// Agenti AI — Trainable personality-aware conversational agent
// Each user gets a unique AI personality that learns and adapts
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentTool } from "./types";

// ---------------------------------------------------------------------------
// Personality Profile — accumulated from user interactions
// ---------------------------------------------------------------------------

export interface PersonalityProfile {
  userId: string;
  // Communication style
  tone: "formal" | "casual" | "friendly" | "professional" | "playful";
  verbosity: "concise" | "moderate" | "detailed";
  emojiUsage: "none" | "minimal" | "moderate" | "heavy";
  // Interests and topics
  topInterests: string[];
  recentTopics: string[];
  // Behavioral patterns
  responsePreference: "direct" | "thoughtful" | "encouraging" | "analytical";
  humorLevel: number; // 0-10
  empathyLevel: number; // 0-10
  curiosityLevel: number; // 0-10
  // Conversation history summary
  totalInteractions: number;
  lastInteraction: string;
  conversationMemory: string[]; // Key facts learned about user
  // Training data
  likedResponses: string[]; // Responses user liked (thumbs up)
  dislikedPatterns: string[]; // Patterns user disliked (thumbs down)
}

export const DEFAULT_PERSONALITY: Omit<PersonalityProfile, "userId"> = {
  tone: "friendly",
  verbosity: "moderate",
  emojiUsage: "minimal",
  topInterests: [],
  recentTopics: [],
  responsePreference: "encouraging",
  humorLevel: 5,
  empathyLevel: 7,
  curiosityLevel: 8,
  totalInteractions: 0,
  lastInteraction: new Date().toISOString(),
  conversationMemory: [],
  likedResponses: [],
  dislikedPatterns: [],
};

// ---------------------------------------------------------------------------
// Personality analysis — extract style from user messages
// ---------------------------------------------------------------------------

export function analyzeMessageStyle(messages: string[]): Partial<PersonalityProfile> {
  const allText = messages.join(" ");
  const avgLength = messages.reduce((s, m) => s + m.split(" ").length, 0) / Math.max(messages.length, 1);
  const emojiCount = (allText.match(/[\u{1F600}-\u{1F9FF}]/gu) || []).length;
  const questionCount = (allText.match(/\?/g) || []).length;
  const exclamationCount = (allText.match(/!/g) || []).length;

  const result: Partial<PersonalityProfile> = {};

  // Determine verbosity
  if (avgLength < 10) result.verbosity = "concise";
  else if (avgLength < 30) result.verbosity = "moderate";
  else result.verbosity = "detailed";

  // Determine emoji usage
  const emojiRatio = emojiCount / Math.max(messages.length, 1);
  if (emojiRatio === 0) result.emojiUsage = "none";
  else if (emojiRatio < 0.5) result.emojiUsage = "minimal";
  else if (emojiRatio < 1.5) result.emojiUsage = "moderate";
  else result.emojiUsage = "heavy";

  // Determine curiosity from questions
  result.curiosityLevel = Math.min(10, Math.round(questionCount / Math.max(messages.length, 1) * 15));

  // Determine enthusiasm from exclamations
  const enthusiasm = exclamationCount / Math.max(messages.length, 1);
  if (enthusiasm > 0.5) result.tone = "playful";
  else if (enthusiasm > 0.2) result.tone = "friendly";

  // Extract potential interests from keywords
  const interestKeywords: Record<string, string> = {
    "code|programming|developer|software|api": "technology",
    "design|creative|art|visual|aesthetic": "design",
    "music|song|band|concert|playlist": "music",
    "travel|trip|flight|explore|adventure": "travel",
    "fitness|workout|gym|health|exercise": "fitness",
    "food|cook|recipe|restaurant|eat": "food",
    "book|read|novel|story|write": "literature",
    "movie|film|series|watch|show": "entertainment",
    "business|startup|entrepreneur|market": "business",
    "science|research|experiment|discover": "science",
    "photo|camera|shot|lens|portrait": "photography",
    "game|play|gaming|stream|esports": "gaming",
  };

  const detectedInterests: string[] = [];
  for (const [pattern, interest] of Object.entries(interestKeywords)) {
    if (new RegExp(pattern, "i").test(allText)) {
      detectedInterests.push(interest);
    }
  }
  if (detectedInterests.length > 0) {
    result.topInterests = detectedInterests.slice(0, 7);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Build personalized system prompt from personality profile
// ---------------------------------------------------------------------------

function buildPersonalizedPrompt(profile: PersonalityProfile): string {
  const toneGuide: Record<string, string> = {
    formal: "Use polished, respectful language. Avoid slang.",
    casual: "Be relaxed and conversational. Use natural language.",
    friendly: "Be warm, approachable, and supportive.",
    professional: "Be clear, structured, and business-appropriate.",
    playful: "Be witty, light-hearted, and fun.",
  };

  const verbosityGuide: Record<string, string> = {
    concise: "Keep responses brief — 1-3 sentences max.",
    moderate: "Provide balanced responses — enough detail without being verbose.",
    detailed: "Give thorough, well-explained responses with examples.",
  };

  const responseGuide: Record<string, string> = {
    direct: "Get straight to the point. No fluff.",
    thoughtful: "Consider multiple angles before responding.",
    encouraging: "Be supportive and affirming. Celebrate progress.",
    analytical: "Break things down logically. Use reasoning.",
  };

  const memoryContext = profile.conversationMemory.length > 0
    ? `\n\nThings I remember about this user:\n${profile.conversationMemory.map((m) => `- ${m}`).join("\n")}`
    : "";

  const interestContext = profile.topInterests.length > 0
    ? `\n\nUser's interests: ${profile.topInterests.join(", ")}`
    : "";

  const recentContext = profile.recentTopics.length > 0
    ? `\nRecent conversation topics: ${profile.recentTopics.join(", ")}`
    : "";

  const trainingContext = profile.dislikedPatterns.length > 0
    ? `\n\nAVOID these patterns the user dislikes:\n${profile.dislikedPatterns.map((p) => `- ${p}`).join("\n")}`
    : "";

  return `You are Agenti — the personal AI companion inside CopyMe. You are unique to each user and you learn their personality over time.

PERSONALITY CONFIGURATION:
- Tone: ${toneGuide[profile.tone]}
- Length: ${verbosityGuide[profile.verbosity]}
- Style: ${responseGuide[profile.responsePreference]}
- Humor level: ${profile.humorLevel}/10
- Empathy level: ${profile.empathyLevel}/10
- Emoji usage: ${profile.emojiUsage === "none" ? "Do not use emoji" : profile.emojiUsage === "heavy" ? "Use emoji freely" : "Use emoji sparingly"}

CORE PRINCIPLES:
1. You follow the Rule of 7 — keep responses under 70 words when possible
2. You are a genuine companion, not a generic chatbot
3. You remember context from past conversations
4. You adapt your communication style to match the user
5. You help users become better communicators
6. You can discuss any topic but always tie back to meaningful connection
7. When speaking via voice, use natural conversational patterns — shorter sentences, verbal acknowledgments
${interestContext}${recentContext}${memoryContext}${trainingContext}

VOICE MODE NOTES:
When the user is speaking via voice, respond conversationally as if having a real-time dialogue. Keep responses natural and flowing. Use contractions. Avoid bullet points or formatting — speak like a person.

Total interactions with this user: ${profile.totalInteractions}`;
}

// ---------------------------------------------------------------------------
// Agenti Tools
// ---------------------------------------------------------------------------

const learnAboutUser: AgentTool = {
  name: "learn_about_user",
  description: "Store a fact or preference learned about the user from conversation",
  parameters: {
    fact: { type: "string", description: "The fact or preference to remember", required: true },
    category: { type: "string", description: "Category: interest, preference, goal, personal, style", required: true },
  },
  execute: async (params) => {
    return {
      stored: true,
      fact: params.fact,
      category: params.category,
      message: `Noted: "${params.fact}" — I'll remember this for our future conversations.`,
    };
  },
};

const analyzePersonality: AgentTool = {
  name: "analyze_personality",
  description: "Analyze the user's communication style from their messages",
  parameters: {
    messages: { type: "string", description: "Pipe-separated list of recent user messages to analyze", required: true },
  },
  execute: async (params) => {
    const msgs = (params.messages as string).split("|").filter(Boolean);
    const analysis = analyzeMessageStyle(msgs);
    return {
      analysis,
      summary: `Communication style: ${analysis.tone ?? "unknown"} tone, ${analysis.verbosity ?? "unknown"} length, ${analysis.emojiUsage ?? "unknown"} emoji usage. Curiosity: ${analysis.curiosityLevel ?? 5}/10. Detected interests: ${(analysis.topInterests ?? []).join(", ") || "none yet"}.`,
    };
  },
};

const suggestTopic: AgentTool = {
  name: "suggest_topic",
  description: "Suggest a conversation topic based on user's interests and recent activity",
  parameters: {
    currentMood: { type: "string", description: "User's apparent mood: happy, neutral, stressed, curious, bored", required: false },
  },
  execute: async (params) => {
    const mood = (params.currentMood as string) || "neutral";
    const topicsByMood: Record<string, string[]> = {
      happy: ["What's the best thing that happened to you this week?", "Any exciting plans coming up?", "What's something you're proud of lately?"],
      neutral: ["Learned anything interesting recently?", "What's been on your mind?", "If you could master any skill overnight, what would it be?"],
      stressed: ["Want to talk about what's weighing on you?", "What usually helps you decompress?", "Sometimes a different perspective helps — want to brainstorm?"],
      curious: ["What's a question you've been wanting to explore?", "Discovered any fascinating rabbit holes lately?", "What would you want to know if you could ask anyone anything?"],
      bored: ["Want me to challenge you with a creative prompt?", "How about we play a word game — Rule of 7 style?", "Let's explore something new together. Pick a topic you know nothing about!"],
    };
    const suggestions = topicsByMood[mood] || topicsByMood.neutral;
    return { mood, suggestions, selected: suggestions[Math.floor(Math.random() * suggestions.length)] };
  },
};

const adaptStyle: AgentTool = {
  name: "adapt_style",
  description: "Adjust the AI's communication style based on user feedback",
  parameters: {
    aspect: { type: "string", description: "What to adjust: tone, verbosity, humor, empathy, emoji", required: true },
    direction: { type: "string", description: "Direction: increase, decrease, or a specific value", required: true },
  },
  execute: async (params) => {
    return {
      adjusted: true,
      aspect: params.aspect,
      direction: params.direction,
      message: `Got it — I'll adjust my ${params.aspect} ${params.direction}. Let me know if this feels better.`,
    };
  },
};

const provideFeedback: AgentTool = {
  name: "provide_feedback",
  description: "Record user feedback on AI response quality to improve future responses",
  parameters: {
    rating: { type: "string", description: "Rating: liked, disliked, neutral", required: true },
    reason: { type: "string", description: "Why the user gave this rating", required: false },
    responseId: { type: "string", description: "ID of the response being rated", required: false },
  },
  execute: async (params) => {
    return {
      recorded: true,
      rating: params.rating,
      reason: params.reason || "No reason specified",
      message: params.rating === "liked"
        ? "Thanks! I'll keep doing more of this."
        : params.rating === "disliked"
          ? "Noted — I'll adjust my approach. Thanks for the feedback."
          : "Got it, thanks for letting me know.",
    };
  },
};

// ---------------------------------------------------------------------------
// Create Agenti config
// ---------------------------------------------------------------------------

export function createAgentiConfig(personality?: PersonalityProfile): AgentConfig {
  const profile: PersonalityProfile = personality ?? {
    userId: "default",
    ...DEFAULT_PERSONALITY,
  };

  return {
    name: "Agenti",
    description: "Personal AI companion that learns and adapts to each user's personality",
    systemPrompt: buildPersonalizedPrompt(profile),
    tools: [learnAboutUser, analyzePersonality, suggestTopic, adaptStyle, provideFeedback],
    maxSteps: 5,
    temperature: 0.7,
  };
}
