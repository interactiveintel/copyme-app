// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type ProfileType = "personal" | "social" | "legal_entity";

export type AccountTier =
  | "basic"
  | "business_3"
  | "business_7"
  | "business_50"
  | "ecommerce";

export type Currency = "USD" | "EUR";

export type DescriptionCategory =
  | "education"
  | "business"
  | "religion"
  | "other";

export type PlanType =
  | "basic"
  | "business_3"
  | "business_7"
  | "business_50"
  | "ecommerce";

export type PeriodType = "monthly" | "quarterly" | "annual";

export type MessageType = "text" | "image" | "voice" | "video";

export type VapTransactionType =
  | "transfer"
  | "payment"
  | "deposit"
  | "withdrawal"
  | "fee"
  | "refund";

export type VapTransactionStatus =
  | "pending"
  | "completed"
  | "failed"
  | "reversed";

export type VapTier = "standard" | "premium" | "merchant";

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  displayName: string;
  profileType: ProfileType;
  phoneHash: string | null;
  emailHash: string | null;
  phoneEncrypted: Buffer | null;
  emailEncrypted: Buffer | null;
  accountTier: AccountTier;
  vapEnabled: boolean;
  preferredCurrency: Currency;
  passwordHash: string;
  lastActivityAt: Date | null;
  createdAt: Date;
}

export interface UserLocation {
  userId: string;
  globalArea: string | null;
  countryPhoneCode: string | null;
  region: string | null;
  cityZip: string | null;
  localDescription: string | null;
  locationVerified: boolean;
  locationVisible: boolean;
}

export interface UserInterest {
  userId: string;
  slotNumber: number;
  interestText: string;
}

export interface UserDescription {
  id: string;
  userId: string;
  category: DescriptionCategory;
  level: string | null;
  location: string | null;
  institution: string | null;
  typeDescription: string | null;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  groupId: string | null;
  type: MessageType;
  content: string | null;
  mediaUrls: unknown | null;
  durationSeconds: number | null;
  languageOriginal: string | null;
  languageTranslated: string | null;
  translatedText: string | null;
  createdAt: Date;
  expiresFromInboxAt: Date | null;
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  maxMembers: number;
  createdAt: Date;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  joinedAt: Date;
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export interface Contact {
  userId: string;
  contactId: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export interface Subscription {
  id: string;
  userId: string;
  plan: PlanType;
  periodType: PeriodType;
  autoRenew: boolean;
  maxSearchResults: number;
  maxContactsAtOnce: number;
  maxContactsPerPeriod: number;
  maxSurveyParticipants: number;
  maxGroupSize: number;
  startsAt: Date;
  expiresAt: Date;
}

// ---------------------------------------------------------------------------
// VAP (Virtual Account & Payments)
// ---------------------------------------------------------------------------

export interface VapAccount {
  userId: string;
  balance: number;
  currency: Currency;
  weeklyTransferTotal: number;
  annualTransferTotal: number;
  tier: VapTier;
  taxRegistrationId: string | null;
  lastTransactionAt: Date | null;
  virtualCardCount: number;
}

export interface VapTransaction {
  id: string;
  senderId: string;
  receiverId: string | null;
  type: VapTransactionType;
  amount: number;
  currency: Currency;
  feeAmount: number;
  status: VapTransactionStatus;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Rule of 7 constants
// ---------------------------------------------------------------------------

export const RULE_OF_7 = {
  /** Max interest slots per user */
  MAX_INTERESTS: 7,
  /** Default max search results returned */
  MAX_SEARCH_RESULTS: 7,
  /** Default max contacts that can be messaged at once */
  MAX_CONTACTS_AT_ONCE: 7,
  /** Default max new contacts per subscription period */
  MAX_CONTACTS_PER_PERIOD: 7,
  /** Default max survey participants */
  MAX_SURVEY_PARTICIPANTS: 7,
  /** Default max group members */
  MAX_GROUP_SIZE: 7,
  /** Message expiry in days for basic tier */
  MESSAGE_EXPIRY_DAYS: 7,
} as const;

export type RuleOf7 = typeof RULE_OF_7;

// ---------------------------------------------------------------------------
// Tier-based limits (overrides to Rule of 7 defaults)
// ---------------------------------------------------------------------------

export const TIER_LIMITS: Record<
  AccountTier,
  {
    maxSearchResults: number;
    maxContactsAtOnce: number;
    maxContactsPerPeriod: number;
    maxSurveyParticipants: number;
    maxGroupSize: number;
  }
> = {
  basic: {
    maxSearchResults: 7,
    maxContactsAtOnce: 7,
    maxContactsPerPeriod: 7,
    maxSurveyParticipants: 7,
    maxGroupSize: 7,
  },
  business_3: {
    maxSearchResults: 21,
    maxContactsAtOnce: 21,
    maxContactsPerPeriod: 21,
    maxSurveyParticipants: 21,
    maxGroupSize: 21,
  },
  business_7: {
    maxSearchResults: 49,
    maxContactsAtOnce: 49,
    maxContactsPerPeriod: 49,
    maxSurveyParticipants: 49,
    maxGroupSize: 49,
  },
  business_50: {
    maxSearchResults: 350,
    maxContactsAtOnce: 350,
    maxContactsPerPeriod: 350,
    maxSurveyParticipants: 350,
    maxGroupSize: 350,
  },
  ecommerce: {
    maxSearchResults: 350,
    maxContactsAtOnce: 350,
    maxContactsPerPeriod: 350,
    maxSurveyParticipants: 350,
    maxGroupSize: 350,
  },
} as const;

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
