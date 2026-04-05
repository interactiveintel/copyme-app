// ---------------------------------------------------------------------------
// Onboarding Agent — new user guidance
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentTool } from "./types";

// ---------------------------------------------------------------------------
// Interest suggestion pools — curated by category
// ---------------------------------------------------------------------------

const INTEREST_POOLS: Record<string, string[]> = {
  technology: ["web development", "AI & ML", "cybersecurity", "blockchain", "mobile apps", "cloud computing", "data science"],
  creative: ["photography", "graphic design", "creative writing", "film making", "digital art", "music production", "illustration"],
  sports: ["running", "cycling", "yoga", "rock climbing", "swimming", "martial arts", "hiking"],
  business: ["entrepreneurship", "marketing", "investing", "leadership", "networking", "product management", "consulting"],
  science: ["astronomy", "biology", "physics", "chemistry", "environmental science", "neuroscience", "mathematics"],
  culture: ["language learning", "cooking", "travel", "book clubs", "film analysis", "philosophy", "cultural exchange"],
  lifestyle: ["mindfulness", "sustainability", "minimalism", "gardening", "coffee culture", "wellness", "volunteering"],
};

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

const suggestInterestsTool: AgentTool = {
  name: "suggest_interests",
  description: "Suggest 7 interests for a user based on partial profile information, preferences, or keywords.",
  parameters: {
    currentInterests: { type: "array", description: "Interests the user already has", items: { type: "string" } },
    preferences: { type: "string", description: "Free-text description of what the user likes" },
    query: { type: "string", description: "Context for the suggestion" },
  },
  execute: async (params) => {
    const current = (params.currentInterests as string[]) ?? [];
    const preferences = ((params.preferences as string) ?? (params.query as string) ?? "").toLowerCase();

    // Detect relevant categories from preferences
    const categoryKeywords: Record<string, string[]> = {
      technology: ["tech", "coding", "programming", "computer", "software", "ai", "web", "app"],
      creative: ["art", "design", "photo", "music", "write", "creative", "film", "draw"],
      sports: ["sport", "fitness", "gym", "run", "swim", "climb", "yoga", "hike"],
      business: ["business", "startup", "entrepreneur", "market", "finance", "invest", "manage"],
      science: ["science", "math", "research", "physics", "biology", "space", "lab"],
      culture: ["culture", "language", "travel", "food", "cook", "book", "read", "film"],
      lifestyle: ["health", "wellness", "garden", "sustain", "mindful", "meditat", "volunteer"],
    };

    const matchedCategories: string[] = [];
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => preferences.includes(kw))) {
        matchedCategories.push(category);
      }
    }

    // If no categories detected, pick diverse ones
    if (matchedCategories.length === 0) {
      matchedCategories.push("technology", "creative", "lifestyle");
    }

    // Collect suggestions from matched categories, excluding current interests
    const suggestions: { interest: string; category: string; reason: string }[] = [];
    const currentLower = new Set(current.map((c) => c.toLowerCase()));

    for (const category of matchedCategories) {
      const pool = INTEREST_POOLS[category] ?? [];
      for (const interest of pool) {
        if (!currentLower.has(interest.toLowerCase()) && suggestions.length < 7) {
          suggestions.push({
            interest,
            category,
            reason: `Popular in ${category} — helps you connect with like-minded users`,
          });
        }
      }
    }

    // Fill remaining slots with diverse picks
    if (suggestions.length < 7) {
      const allCategories = Object.keys(INTEREST_POOLS);
      for (const cat of allCategories) {
        if (suggestions.length >= 7) break;
        const pool = INTEREST_POOLS[cat];
        const pick = pool.find(
          (p) => !currentLower.has(p.toLowerCase()) && !suggestions.some((s) => s.interest === p),
        );
        if (pick) {
          suggestions.push({ interest: pick, category: cat, reason: "Broadens your discoverability" });
        }
      }
    }

    return {
      suggestions: suggestions.slice(0, 7),
      total: Math.min(suggestions.length, 7),
      maxSlots: 7,
      remainingSlots: 7 - current.length,
      tip: "CopyMe allows exactly 7 interest slots. Choose wisely to maximize connections!",
    };
  },
};

const improveDescriptionTool: AgentTool = {
  name: "improve_description",
  description: "Rewrite a user description field to be more discoverable. Each field is limited to 5 words per the Rule of 7.",
  parameters: {
    text: { type: "string", description: "Current description text to improve" },
    field: { type: "string", description: "Which field: institution, typeDescription, level, location" },
  },
  execute: async (params) => {
    const text = (params.text as string) ?? "";
    const field = (params.field as string) ?? "typeDescription";
    const words = text.trim().split(/\s+/).filter(Boolean);

    // Generate improved alternatives
    const improvements: Record<string, string[]> = {
      institution: [
        words.slice(0, 5).join(" "),
        text.replace(/university of /i, "").replace(/the /i, "").split(/\s+/).slice(0, 5).join(" "),
        text.replace(/college|university|institute/i, "Uni").split(/\s+/).slice(0, 5).join(" "),
      ],
      typeDescription: [
        words.slice(0, 5).join(" "),
        "Passionate " + words.slice(0, 4).join(" "),
        words.slice(0, 3).join(" ") + " enthusiast",
      ],
      level: [
        words.slice(0, 5).join(" "),
        "Experienced " + words.slice(0, 4).join(" "),
        "Expert in " + words.slice(0, 3).join(" "),
      ],
      location: [
        words.slice(0, 5).join(" "),
        text.replace(/city of /i, "").split(/\s+/).slice(0, 5).join(" "),
        words.slice(0, 3).join(" ") + " area",
      ],
    };

    const options = (improvements[field] ?? improvements.typeDescription)
      .filter((opt) => opt.trim().length > 0)
      .map((opt) => ({
        text: opt.trim(),
        wordCount: opt.trim().split(/\s+/).length,
        compliant: opt.trim().split(/\s+/).length <= 5,
      }));

    return {
      original: text,
      originalWordCount: words.length,
      improvements: options,
      field,
      ruleOf7Limit: "5 words per description field",
      isOriginalCompliant: words.length <= 5,
    };
  },
};

const validateProfileTool: AgentTool = {
  name: "validate_profile",
  description: "Check profile completeness and suggest improvements. Returns a score 0-100 with specific recommendations.",
  parameters: {
    profile: {
      type: "object",
      description: "User profile data",
      properties: {
        displayName: { type: "string" },
        interests: { type: "array", items: { type: "string" } },
        location: { type: "object" },
        descriptions: { type: "array" },
      },
    },
    query: { type: "string", description: "Context for validation" },
  },
  execute: async (params) => {
    const profile = (params.profile as Record<string, unknown>) ?? {};
    const displayName = (profile.displayName as string) ?? "";
    const interests = (profile.interests as string[]) ?? [];
    const location = (profile.location as Record<string, string>) ?? {};
    const descriptions = (profile.descriptions as Record<string, string>[]) ?? [];

    const checks: { field: string; status: "complete" | "incomplete" | "improvable"; suggestion: string; points: number }[] = [];
    let score = 0;
    const maxScore = 100;

    // Display name check (20 points)
    if (displayName.length > 0) {
      const nameWords = displayName.split(/\s+/).length;
      if (nameWords <= 7) {
        checks.push({ field: "displayName", status: "complete", suggestion: "Great display name!", points: 20 });
        score += 20;
      } else {
        checks.push({ field: "displayName", status: "improvable", suggestion: "Shorten to 7 words or fewer", points: 10 });
        score += 10;
      }
    } else {
      checks.push({ field: "displayName", status: "incomplete", suggestion: "Add a display name (max 7 words)", points: 0 });
    }

    // Interests check (30 points)
    if (interests.length === 7) {
      checks.push({ field: "interests", status: "complete", suggestion: "All 7 interest slots filled!", points: 30 });
      score += 30;
    } else if (interests.length > 0) {
      const pts = Math.round((interests.length / 7) * 30);
      checks.push({ field: "interests", status: "improvable", suggestion: `Add ${7 - interests.length} more interests to fill all 7 slots`, points: pts });
      score += pts;
    } else {
      checks.push({ field: "interests", status: "incomplete", suggestion: "Add up to 7 interests to be discoverable", points: 0 });
    }

    // Location check (25 points)
    const locationFields = ["globalArea", "region", "cityZip", "localDescription"];
    const filledLocationFields = locationFields.filter((f) => (location[f] ?? "").length > 0).length;
    if (filledLocationFields >= 3) {
      checks.push({ field: "location", status: "complete", suggestion: "Location is well-defined!", points: 25 });
      score += 25;
    } else if (filledLocationFields > 0) {
      const pts = Math.round((filledLocationFields / 3) * 25);
      checks.push({ field: "location", status: "improvable", suggestion: "Add more location details for better local matching", points: pts });
      score += pts;
    } else {
      checks.push({ field: "location", status: "incomplete", suggestion: "Add your location to find nearby users", points: 0 });
    }

    // Descriptions check (25 points)
    if (descriptions.length > 0) {
      checks.push({ field: "descriptions", status: "complete", suggestion: "Profile descriptions look good!", points: 25 });
      score += 25;
    } else {
      checks.push({ field: "descriptions", status: "incomplete", suggestion: "Add education, business, or other descriptions", points: 0 });
    }

    return {
      score: Math.min(score, maxScore),
      maxScore,
      grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
      checks,
      completeness: `${Math.round((score / maxScore) * 100)}%`,
      nextStep: checks.find((c) => c.status === "incomplete")?.suggestion ?? checks.find((c) => c.status === "improvable")?.suggestion ?? "Your profile looks great!",
    };
  },
};

const suggestLocationDescriptionTool: AgentTool = {
  name: "suggest_location_description",
  description: "Help describe a location in max 5 words for the localDescription field.",
  parameters: {
    city: { type: "string", description: "City name" },
    region: { type: "string", description: "State/province/region" },
    details: { type: "string", description: "Any extra details about the area" },
    text: { type: "string", description: "Free-text location info" },
  },
  execute: async (params) => {
    const city = (params.city as string) ?? "";
    const region = (params.region as string) ?? "";
    const details = (params.details as string) ?? (params.text as string) ?? "";
    const input = [city, region, details].filter(Boolean).join(" ");

    // Generate concise location descriptions (max 5 words)
    const suggestions = [
      city ? `Downtown ${city} area` : `Central ${region || "metro"} area`,
      `${city || region || "Local"} community hub`,
      details ? details.split(/\s+/).slice(0, 5).join(" ") : `Near ${city || "city center"}`,
      `${city || region || "Urban"} creative district`,
      `Heart of ${city || region || "the city"}`,
    ].map((s) => {
      const words = s.split(/\s+/);
      return {
        text: words.slice(0, 5).join(" "),
        wordCount: Math.min(words.length, 5),
        compliant: words.length <= 5,
      };
    });

    return {
      suggestions,
      inputUsed: input,
      ruleOf7Limit: "5 words max for location description",
    };
  },
};

const generateBioTool: AgentTool = {
  name: "generate_bio",
  description: "Create an AI-generated bio/description based on interests, location, and profile type.",
  parameters: {
    interests: { type: "array", description: "User's interests", items: { type: "string" } },
    location: { type: "string", description: "User's location" },
    profileType: { type: "string", description: "personal, social, or legal_entity" },
    query: { type: "string", description: "Context or preferences for the bio" },
  },
  execute: async (params) => {
    const interests = (params.interests as string[]) ?? [];
    const location = (params.location as string) ?? "";
    const profileType = (params.profileType as string) ?? "personal";
    const query = (params.query as string) ?? "";

    const interestStr = interests.slice(0, 3).join(", ") || "various interests";
    const locationStr = location || "around the world";

    // Generate multiple bio options tailored to profile type
    const bios: Record<string, string[]> = {
      personal: [
        `Passionate about ${interestStr}. Based in ${locationStr}, always looking to connect with like-minded people.`,
        `${interestStr} enthusiast from ${locationStr}. Let's share ideas and build meaningful connections.`,
        `Exploring ${interestStr} from ${locationStr}. Curious mind, open heart, always learning.`,
      ],
      social: [
        `Community builder focused on ${interestStr}. Connecting people in ${locationStr} and beyond.`,
        `Bringing together ${interestStr} lovers in ${locationStr}. Join the conversation!`,
        `A hub for ${interestStr} in ${locationStr}. Growing connections, sharing knowledge.`,
      ],
      legal_entity: [
        `${locationStr}-based organization specializing in ${interestStr}. Connecting professionals and enthusiasts alike.`,
        `Dedicated to ${interestStr} excellence in ${locationStr}. Building partnerships that matter.`,
        `Your go-to for ${interestStr} in ${locationStr}. Professional, approachable, community-driven.`,
      ],
    };

    const options = (bios[profileType] ?? bios.personal).map((bio, i) => ({
      id: i + 1,
      text: bio,
      wordCount: bio.split(/\s+/).length,
      tone: i === 0 ? "warm" : i === 1 ? "engaging" : "professional",
    }));

    return {
      bios: options,
      basedOn: { interests: interests.slice(0, 3), location, profileType },
      tip: "Remember: your display name is limited to 7 words. Use your bio in descriptions to share more about yourself.",
    };
  },
};

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

const ONBOARDING_TOOLS: AgentTool[] = [
  suggestInterestsTool,
  improveDescriptionTool,
  validateProfileTool,
  suggestLocationDescriptionTool,
  generateBioTool,
];

export function createOnboardingConfig(): AgentConfig {
  return {
    name: "onboarding",
    description: "AI-powered new user onboarding and profile optimization",
    systemPrompt: `You are CopyMe's Onboarding Guide. Help new users set up their profile for maximum discoverability while respecting the Rule of 7.

Key constraints you help users navigate:
- 7 interest slots maximum — choose wisely
- Display name: max 7 words, 45 characters
- Description fields: max 5 words each
- Location description: max 5 words

Your approach:
1. Be warm and welcoming — first impressions matter
2. Help users understand WHY each field matters for discovery
3. Suggest specific, actionable improvements
4. Always validate against Rule of 7 constraints
5. Celebrate progress — profile building should feel rewarding

When suggesting interests, consider discoverability: choose interests that are specific enough to attract quality matches but broad enough to have a community.`,
    tools: ONBOARDING_TOOLS,
    maxSteps: 4,
    temperature: 0.7,
  };
}
