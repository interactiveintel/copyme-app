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
  // v4.16.36: distinct Pro tier. Previously the pricing page SOLD Pro
  // and Business at different prices, but tierKey() collapsed both to
  // the BUSINESS bucket — so a Pro buyer got full Business entitlements.
  // These intermediate values mirror the (formerly dead) PRO spec in
  // lib/tiers.ts: 2× Basic on messaging, 30 contacts, ~4× search.
  PRO: {
    inboxPerContact: 30,
    maxMessageWords: 140,
    maxImages: 14,
    maxVoiceSeconds: 140,
    maxVideoSeconds: 140,
    maxVideoSizeMB: 140,
    searchResults: 30,
    contactsAtOnce: 30,
    contactsPerWeek: 210, // 30 * 7
    groupSize: 14,
    interestSlots: 7,
    profileNameWords: 7,
    adSlots: 30,
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
  if (normalized === "ecommerce") return "ECOMMERCE";
  // v4.16.36: the billing webhook stores the "pro" plan as the
  // business_3 enum slot (there is no `pro` enum value) and "business"
  // as business_7. Map business_3 / a literal "pro" to the PRO bucket;
  // business_7 / business_50 remain full BUSINESS.
  if (normalized === "business_3" || normalized === "pro") return "PRO";
  if (normalized.startsWith("business")) return "BUSINESS";
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
 * Get the concurrent "at once" contact cap for a given tier. This is the
 * number of rows a user may hold in the Contact table at any one time.
 */
export function getContactAtOnceLimit(tier: string): number {
  return LIMITS[tierKey(tier)].contactsAtOnce;
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
