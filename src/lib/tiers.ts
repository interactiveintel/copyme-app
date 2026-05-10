// Tier resolution + cap raise (S-241 + S-242).
//
// Pro raises message word cap to 140, contact cap to 30, retention to 30.
// Business unlocks ad creator, surveys, and Yogi-pro budgets.

import { LIMITS } from "@/lib/ruleOf7";

export type Tier = "basic" | "pro" | "business" | "enterprise";

export interface ResolvedLimits {
  maxMessageWords: number;
  maxImages: number;
  maxVoiceSeconds: number;
  maxVideoSeconds: number;
  contactsAtOnce: number;
  inboxPerContact: number;
  groupSize: number;
  /** Caps that aren't in the lib/ruleOf7 table but matter at the API layer. */
  yogiDailyTokenBudget: number;
  canCreateAds: boolean;
  canCreateSurveys: boolean;
}

const PRO: ResolvedLimits = {
  maxMessageWords: 140,
  maxImages: 14,
  maxVoiceSeconds: 140,
  maxVideoSeconds: 140,
  contactsAtOnce: 30,
  inboxPerContact: 30,
  groupSize: 14,
  yogiDailyTokenBudget: 50_000,
  canCreateAds: false,
  canCreateSurveys: false,
};

const BUSINESS: ResolvedLimits = {
  maxMessageWords: 700,
  maxImages: 70,
  maxVoiceSeconds: 700,
  maxVideoSeconds: 700,
  contactsAtOnce: 700,
  inboxPerContact: 700,
  groupSize: 70,
  yogiDailyTokenBudget: 250_000,
  canCreateAds: true,
  canCreateSurveys: true,
};

export function limitsForTier(tier: Tier): ResolvedLimits {
  switch (tier) {
    case "pro":        return PRO;
    case "business":
    case "enterprise": return BUSINESS;
    case "basic":
    default:
      return {
        maxMessageWords: LIMITS.BASIC.maxMessageWords,
        maxImages: LIMITS.BASIC.maxImages,
        maxVoiceSeconds: LIMITS.BASIC.maxVoiceSeconds,
        maxVideoSeconds: LIMITS.BASIC.maxVideoSeconds,
        contactsAtOnce: LIMITS.BASIC.contactsAtOnce,
        inboxPerContact: LIMITS.BASIC.inboxPerContact,
        groupSize: LIMITS.BASIC.groupSize,
        yogiDailyTokenBudget: 5_000,
        canCreateAds: false,
        canCreateSurveys: false,
      };
  }
}

/**
 * Map the prisma `accountTier` enum to our resolution tier. The DB has
 * basic/business_3/business_7/business_50/ecommerce; we collapse business_*
 * → "business" and ecommerce → "enterprise".
 */
export function tierFromDb(dbTier: string): Tier {
  if (dbTier === "ecommerce") return "enterprise";
  if (dbTier.startsWith("business")) return "business";
  if (dbTier === "pro") return "pro";
  return "basic";
}
