// ---------------------------------------------------------------------------
// Smart Match Agent — AI-powered user discovery
// ---------------------------------------------------------------------------

import type { AgentConfig, AgentTool } from "./types";
import prisma from "@/lib/db";

// ---------------------------------------------------------------------------
// Mock data — fallback user profiles when DB is empty
// ---------------------------------------------------------------------------

const MOCK_USERS = [
  {
    id: "usr_a1b2c3",
    displayName: "Maria Santos",
    interests: ["photography", "hiking", "coffee culture", "travel writing", "yoga", "sustainability", "film"],
    location: { globalArea: "Americas", region: "Brazil", cityZip: "Sao Paulo" },
    profileType: "personal" as const,
    bio: "Visual storyteller exploring the world one frame at a time.",
  },
  {
    id: "usr_d4e5f6",
    displayName: "James Chen",
    interests: ["machine learning", "rock climbing", "board games", "cooking", "jazz", "open source", "reading"],
    location: { globalArea: "Americas", region: "United States", cityZip: "San Francisco" },
    profileType: "personal" as const,
    bio: "Engineer by day, chef by night. Building things that matter.",
  },
  {
    id: "usr_g7h8i9",
    displayName: "Aisha Patel",
    interests: ["UX design", "watercolor painting", "meditation", "podcasting", "cycling", "veganism", "architecture"],
    location: { globalArea: "Europe", region: "United Kingdom", cityZip: "London" },
    profileType: "personal" as const,
    bio: "Designing experiences that make people smile.",
  },
  {
    id: "usr_j1k2l3",
    displayName: "Luca Romano",
    interests: ["entrepreneurship", "wine tasting", "football", "classical music", "history", "mentoring", "startups"],
    location: { globalArea: "Europe", region: "Italy", cityZip: "Milan" },
    profileType: "social" as const,
    bio: "Startup founder connecting creators across borders.",
  },
  {
    id: "usr_m4n5o6",
    displayName: "Yuki Tanaka",
    interests: ["anime art", "game development", "tea ceremony", "calligraphy", "robotics", "music production", "cats"],
    location: { globalArea: "Asia", region: "Japan", cityZip: "Tokyo" },
    profileType: "personal" as const,
    bio: "Blending tradition with technology, one pixel at a time.",
  },
  {
    id: "usr_p7q8r9",
    displayName: "Fatima Al-Hassan",
    interests: ["data science", "Arabic poetry", "marathon running", "volunteering", "astronomy", "baking", "chess"],
    location: { globalArea: "Middle East", region: "UAE", cityZip: "Dubai" },
    profileType: "personal" as const,
    bio: "Finding patterns in data and stars in the sky.",
  },
  {
    id: "usr_s1t2u3",
    displayName: "Green Valley Co-op",
    interests: ["organic farming", "community building", "sustainability", "local markets", "education", "composting", "beekeeping"],
    location: { globalArea: "Americas", region: "United States", cityZip: "Portland" },
    profileType: "legal_entity" as const,
    bio: "Growing food, growing community.",
  },
];

const ICEBREAKERS = [
  "I noticed we both love {interest} — what got you into it?",
  "Your profile caught my eye! I'm also passionate about {interest}. What's your favorite aspect of it?",
  "Hey there! As a fellow {interest} enthusiast, I'd love to hear about your experience with it.",
  "I see you're into {interest} — I've been exploring that too! Any recommendations for a fellow enthusiast?",
  "We seem to share a love for {interest}. I'd love to swap stories sometime!",
  "Your {interest} background is fascinating. I've been wanting to learn more about it!",
  "I noticed we're both in {location} and share an interest in {interest} — small world!",
];

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

function scoreUserMatch(
  user: (typeof MOCK_USERS)[number],
  query: string,
  userInterests?: string[],
  userLocation?: string,
): number {
  const q = query.toLowerCase();
  let score = 0;

  // Interest overlap
  const matchedInterests = user.interests.filter(
    (i) => q.includes(i.toLowerCase()) || (userInterests ?? []).some((ui) => ui.toLowerCase() === i.toLowerCase()),
  );
  score += matchedInterests.length * 15;

  // Name match
  if (user.displayName.toLowerCase().includes(q)) score += 20;

  // Location match
  const locFields = [user.location.globalArea, user.location.region, user.location.cityZip];
  if (locFields.some((f) => f.toLowerCase().includes(q))) score += 10;
  if (userLocation && locFields.some((f) => f.toLowerCase().includes(userLocation.toLowerCase()))) score += 12;

  // Bio keyword match
  const qWords = q.split(/\s+/);
  const bioWords = user.bio.toLowerCase();
  score += qWords.filter((w) => w.length > 3 && bioWords.includes(w)).length * 3;

  // Clamp to 0-100
  return Math.min(100, Math.max(0, score));
}

const searchUsersTool: AgentTool = {
  name: "search_users",
  description: "Search for users by interests, location, keywords, or any combination. Returns up to 7 results ranked by relevance.",
  parameters: {
    query: { type: "string", description: "Free-text search query" },
    interests: { type: "array", description: "Interest tags to filter by", items: { type: "string" } },
    location: { type: "string", description: "Location to filter by" },
    limit: { type: "number", description: "Max results (default 7)" },
  },
  execute: async (params) => {
    const query = (params.query as string) ?? "";
    const limit = Math.min((params.limit as number) ?? 7, 7);

    // Try real database first
    try {
      const dbUsers = await prisma.user.findMany({
        where: {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { interests: { some: { interestText: { contains: query, mode: "insensitive" } } } },
            { location: { OR: [
              { globalArea: { contains: query, mode: "insensitive" } },
              { region: { contains: query, mode: "insensitive" } },
            ] } },
          ],
        },
        take: limit,
        select: {
          id: true,
          displayName: true,
          profileType: true,
          interests: { select: { interestText: true }, orderBy: { slotNumber: "asc" } },
          location: { select: { globalArea: true, region: true, cityZip: true } },
        },
      });

      if (dbUsers.length > 0) {
        return {
          results: dbUsers.map((u, i) => ({
            id: u.id,
            displayName: u.displayName,
            interests: u.interests.map((x) => x.interestText),
            location: u.location ?? { globalArea: null, region: null, cityZip: null },
            profileType: u.profileType,
            score: 80 - i * 10,
          })),
          total: dbUsers.length,
          query,
          source: "database",
        };
      }
    } catch {
      // DB unavailable — fall through to mock
    }

    // Fallback to mock data
    const interests = (params.interests as string[]) ?? [];
    const location = (params.location as string) ?? "";
    const scored = MOCK_USERS.map((user) => ({
      ...user,
      score: scoreUserMatch(user, query, interests, location),
    }))
      .filter((u) => u.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    if (scored.length === 0) {
      const suggestions = MOCK_USERS.slice(0, 3).map((u) => ({
        id: u.id,
        displayName: u.displayName,
        interests: u.interests.slice(0, 3),
        location: u.location,
        score: 25,
        reason: "Suggested based on popularity",
      }));
      return { results: suggestions, total: suggestions.length, query, noExactMatch: true, source: "mock" };
    }

    return {
      results: scored.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        interests: u.interests,
        location: u.location,
        profileType: u.profileType,
        score: u.score,
        bio: u.bio,
      })),
      total: scored.length,
      query,
      source: "mock",
    };
  },
};

const analyzeCompatibilityTool: AgentTool = {
  name: "analyze_compatibility",
  description: "Analyze compatibility between two users based on interests, location, and profile type. Returns a score 0-100 with reasoning.",
  parameters: {
    userId: { type: "string", description: "First user ID" },
    targetId: { type: "string", description: "Second user ID" },
    query: { type: "string", description: "Context about the match request" },
  },
  execute: async (params) => {
    const query = (params.query as string) ?? "";

    // Simulate a compatibility analysis
    const score = 45 + Math.floor(Math.random() * 40); // 45-85 range
    const factors = [
      { factor: "Shared interests", weight: 35, score: 30 + Math.floor(Math.random() * 50) },
      { factor: "Location proximity", weight: 20, score: 20 + Math.floor(Math.random() * 60) },
      { factor: "Communication style", weight: 25, score: 40 + Math.floor(Math.random() * 40) },
      { factor: "Activity level", weight: 20, score: 35 + Math.floor(Math.random() * 45) },
    ];

    return {
      overallScore: score,
      factors,
      recommendation: score >= 70
        ? "Strong match! You share multiple interests and have compatible communication styles."
        : score >= 50
          ? "Good potential match. You have some overlapping interests that could spark great conversations."
          : "Moderate match. While you have different backgrounds, diverse connections can lead to interesting exchanges.",
      query,
    };
  },
};

const suggestInterestsTool: AgentTool = {
  name: "suggest_interests",
  description: "Suggest new interests a user might enjoy based on their current profile and browsing patterns.",
  parameters: {
    currentInterests: { type: "array", description: "User's current interests", items: { type: "string" } },
    query: { type: "string", description: "Context or preferences" },
  },
  execute: async (params) => {
    const current = (params.currentInterests as string[]) ?? [];
    const query = (params.query as string) ?? "";

    // Interest affinity map — realistic suggestions based on common pairings
    const affinityMap: Record<string, string[]> = {
      photography: ["photo editing", "street art", "nature walks", "drone piloting"],
      hiking: ["trail running", "rock climbing", "bird watching", "camping"],
      cooking: ["food photography", "wine tasting", "farmers markets", "fermentation"],
      "machine learning": ["data visualization", "mathematics", "robotics", "philosophy of AI"],
      "ux design": ["typography", "psychology", "accessibility", "product management"],
      yoga: ["meditation", "wellness", "breathwork", "holistic health"],
      travel: ["language learning", "cultural exchange", "travel writing", "backpacking"],
      music: ["music production", "vinyl collecting", "live concerts", "sound design"],
      reading: ["book clubs", "creative writing", "poetry", "philosophy"],
      gaming: ["game design", "esports", "VR experiences", "board games"],
    };

    const suggestions: string[] = [];
    for (const interest of current) {
      const key = interest.toLowerCase();
      for (const [affinityKey, relatedInterests] of Object.entries(affinityMap)) {
        if (key.includes(affinityKey)) {
          suggestions.push(...relatedInterests.filter((r) => !current.some((c) => c.toLowerCase() === r.toLowerCase())));
        }
      }
    }

    // Add query-based suggestions
    if (query) {
      const qLower = query.toLowerCase();
      for (const [key, related] of Object.entries(affinityMap)) {
        if (qLower.includes(key)) {
          suggestions.push(...related);
        }
      }
    }

    // Deduplicate and limit to 7
    const unique = [...new Set(suggestions)].slice(0, 7);

    // If we couldn't find affinity matches, suggest popular ones
    if (unique.length === 0) {
      return {
        suggestions: ["photography", "travel", "cooking", "reading", "fitness", "technology", "art"],
        source: "popular",
        message: "Here are some popular interests on CopyMe that might resonate with you.",
      };
    }

    return {
      suggestions: unique,
      source: "affinity",
      basedOn: current,
      message: `Based on your interests in ${current.slice(0, 3).join(", ")}, you might also enjoy these.`,
    };
  },
};

const findNearbyTool: AgentTool = {
  name: "find_nearby",
  description: "Find users in the same location hierarchy (city, region, or global area).",
  parameters: {
    location: { type: "string", description: "Location to search near" },
    query: { type: "string", description: "Additional context" },
  },
  execute: async (params) => {
    const location = ((params.location as string) ?? (params.query as string) ?? "").toLowerCase();

    // Try real database first
    try {
      const dbUsers = await prisma.user.findMany({
        where: {
          location: {
            OR: [
              { globalArea: { contains: location, mode: "insensitive" } },
              { region: { contains: location, mode: "insensitive" } },
              { cityZip: { contains: location, mode: "insensitive" } },
            ],
          },
        },
        take: 7,
        select: {
          id: true,
          displayName: true,
          interests: { select: { interestText: true }, orderBy: { slotNumber: "asc" }, take: 3 },
          location: { select: { globalArea: true, region: true, cityZip: true } },
        },
      });

      if (dbUsers.length > 0) {
        return {
          nearby: dbUsers.map((u) => ({
            id: u.id,
            displayName: u.displayName,
            interests: u.interests.map((x) => x.interestText),
            location: u.location ?? { globalArea: null, region: null, cityZip: null },
            distance: u.location?.cityZip?.toLowerCase().includes(location) ? "same city" : "same region",
          })),
          total: dbUsers.length,
          searchedLocation: location,
          source: "database",
        };
      }
    } catch {
      // DB unavailable — fall through to mock
    }

    // Fallback to mock data
    const nearby = MOCK_USERS.filter((u) => {
      const locFields = [u.location.globalArea, u.location.region, u.location.cityZip];
      return locFields.some((f) => f.toLowerCase().includes(location));
    }).map((u) => ({
      id: u.id,
      displayName: u.displayName,
      interests: u.interests.slice(0, 3),
      location: u.location,
      distance: u.location.cityZip.toLowerCase().includes(location) ? "same city" : "same region",
    }));

    if (nearby.length === 0) {
      const globalMatches = MOCK_USERS.slice(0, 3).map((u) => ({
        id: u.id,
        displayName: u.displayName,
        interests: u.interests.slice(0, 3),
        location: u.location,
        distance: "global",
      }));
      return { nearby: globalMatches, total: globalMatches.length, searchedLocation: location, expanded: true, source: "mock" };
    }

    return { nearby, total: nearby.length, searchedLocation: location, source: "mock" };
  },
};

const generateIcebreakerTool: AgentTool = {
  name: "generate_icebreaker",
  description: "Generate a personalized conversation starter based on shared interests between two users.",
  parameters: {
    sharedInterests: { type: "array", description: "Interests both users share", items: { type: "string" } },
    targetName: { type: "string", description: "Name of the person to message" },
    targetLocation: { type: "string", description: "Location of target user" },
    query: { type: "string", description: "Context about the connection" },
  },
  execute: async (params) => {
    const interests = (params.sharedInterests as string[]) ?? ["shared activities"];
    const targetName = (params.targetName as string) ?? "this person";
    const location = (params.targetLocation as string) ?? "";
    const interest = interests[0] ?? "common interests";

    const templates = ICEBREAKERS.map((t) =>
      t.replace(/{interest}/g, interest).replace(/{location}/g, location || "the same area"),
    );

    // Pick 3 varied icebreakers
    const selected = [templates[0], templates[3], templates[5]].filter(Boolean);

    return {
      icebreakers: selected,
      targetName,
      sharedInterests: interests,
      tip: "Keep your opening message under 70 words to comply with the Rule of 7!",
    };
  },
};

// ---------------------------------------------------------------------------
// Agent configuration
// ---------------------------------------------------------------------------

const SMART_MATCH_TOOLS: AgentTool[] = [
  searchUsersTool,
  analyzeCompatibilityTool,
  suggestInterestsTool,
  findNearbyTool,
  generateIcebreakerTool,
];

export function createSmartMatchConfig(): AgentConfig {
  return {
    name: "smart-match",
    description: "AI-powered user discovery and connection recommendations",
    systemPrompt: `You are CopyMe's Smart Match agent. You help users find meaningful connections based on shared interests, location, and communication style.

Your responsibilities:
1. Search for compatible users based on the user's interests and preferences
2. Analyze compatibility between users and explain why they might connect well
3. Suggest new interests that could expand the user's network
4. Find nearby users for local connections
5. Generate personalized icebreakers to start conversations

Always respect the Rule of 7: return at most 7 results, keep suggestions concise (max 7 words each), and prioritize quality over quantity.

When suggesting matches, explain WHY they're a good match — shared interests, complementary skills, or location proximity. Be warm and encouraging but not overly enthusiastic.`,
    tools: SMART_MATCH_TOOLS,
    maxSteps: 5,
    temperature: 0.7,
  };
}

export { MOCK_USERS };
