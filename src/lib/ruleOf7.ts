// ---------------------------------------------------------------------------
// Rule of 7 — validation & enforcement utilities
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Tier-based limits
// ---------------------------------------------------------------------------

export const LIMITS = {
  BASIC: {
    inboxPerContact: 7,
    maxMessageWords: 70,
    maxImages: 7,
    maxVoiceSeconds: 70,
    maxVideoSeconds: 70,
    maxVideoSizeMB: 70,
    searchResults: 7,
    contactsAtOnce: 7,
    contactsPerWeek: 49, // 7 * 7
    groupSize: 7,
    interestSlots: 7,
    profileNameWords: 7,
    adSlots: 7,
    adRotationHours: 7,
    displayNameChars: 45,
  },
  BUSINESS: {
    inboxPerContact: 70,
    maxMessageWords: 700,
    maxImages: 70,
    maxVoiceSeconds: 700,
    maxVideoSeconds: 700,
    maxVideoSizeMB: 700,
    searchResults: 70,
    contactsAtOnce: 70,
    contactsPerWeek: 490, // 70 * 7
    groupSize: 70,
    interestSlots: 7,
    profileNameWords: 7,
    adSlots: 70,
    adRotationHours: 7,
    displayNameChars: 45,
  },
  ECOMMERCE: {
    inboxPerContact: 700,
    maxMessageWords: 7000,
    maxImages: 700,
    maxVoiceSeconds: 7000,
    maxVideoSeconds: 7000,
    maxVideoSizeMB: 7000,
    searchResults: 700,
    contactsAtOnce: 700,
    contactsPerWeek: 4900, // 700 * 7
    groupSize: 700,
    interestSlots: 7,
    profileNameWords: 7,
    adSlots: 700,
    adRotationHours: 7,
    displayNameChars: 45,
  },
} as const;

export type TierName = keyof typeof LIMITS;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function tierKey(tier: string): TierName {
  const normalized = tier.toLowerCase();
  if (normalized.startsWith("business")) return "BUSINESS";
  if (normalized === "ecommerce") return "ECOMMERCE";
  return "BASIC";
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

/**
 * Validate that message text does not exceed the word limit for the tier
 * (default: 70 words for BASIC).
 */
export function validateMessageContent(
  text: string,
  tier: string = "basic",
): ValidationResult {
  const limit = LIMITS[tierKey(tier)].maxMessageWords;
  const count = wordCount(text);
  if (count > limit) {
    return {
      valid: false,
      error: `Message exceeds ${limit}-word limit (has ${count} words)`,
    };
  }
  return { valid: true };
}

/**
 * Validate a display name: max 7 words, max 45 characters.
 */
export function validateDisplayName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: "Display name is required" };
  }
  if (name.length > LIMITS.BASIC.displayNameChars) {
    return {
      valid: false,
      error: `Display name exceeds ${LIMITS.BASIC.displayNameChars} characters (has ${name.length})`,
    };
  }
  const words = wordCount(name);
  if (words > LIMITS.BASIC.profileNameWords) {
    return {
      valid: false,
      error: `Display name exceeds ${LIMITS.BASIC.profileNameWords}-word limit (has ${words} words)`,
    };
  }
  return { valid: true };
}

/**
 * Validate an interest tag: max 7 words, max 45 characters.
 */
export function validateInterest(text: string): ValidationResult {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: "Interest text is required" };
  }
  if (text.length > LIMITS.BASIC.displayNameChars) {
    return {
      valid: false,
      error: `Interest exceeds ${LIMITS.BASIC.displayNameChars} characters (has ${text.length})`,
    };
  }
  const words = wordCount(text);
  if (words > LIMITS.BASIC.profileNameWords) {
    return {
      valid: false,
      error: `Interest exceeds ${LIMITS.BASIC.profileNameWords}-word limit (has ${words} words)`,
    };
  }
  return { valid: true };
}

/**
 * Get the weekly contact limit for a given tier.
 */
export function getContactLimit(tier: string): number {
  return LIMITS[tierKey(tier)].contactsPerWeek;
}

/**
 * Get the search result limit for a given tier.
 */
export function getSearchLimit(tier: string): number {
  return LIMITS[tierKey(tier)].searchResults;
}

/**
 * Validate that the media count does not exceed 7 items.
 */
export function validateMediaCount(count: number): ValidationResult {
  if (count > LIMITS.BASIC.maxImages) {
    return {
      valid: false,
      error: `Media count exceeds ${LIMITS.BASIC.maxImages}-item limit (has ${count})`,
    };
  }
  return { valid: true };
}

/**
 * Validate that a duration does not exceed 70 seconds.
 */
export function validateDuration(seconds: number): ValidationResult {
  if (seconds > LIMITS.BASIC.maxVoiceSeconds) {
    return {
      valid: false,
      error: `Duration exceeds ${LIMITS.BASIC.maxVoiceSeconds}-second limit (has ${seconds}s)`,
    };
  }
  return { valid: true };
}
