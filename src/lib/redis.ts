import Redis from "ioredis";

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export default redis;

// ---------------------------------------------------------------------------
// Key helpers
// ---------------------------------------------------------------------------

function inboxKey(userId: string, contactId: string): string {
  return `inbox:${userId}:${contactId}`;
}

function onlineKey(userId: string): string {
  return `online:${userId}`;
}

function rateLimitKey(userId: string): string {
  return `ratelimit:${userId}`;
}

// ---------------------------------------------------------------------------
// Inbox cache (last 7 messages per contact)
// ---------------------------------------------------------------------------

const MAX_INBOX_MESSAGES = 7;

/**
 * Cache the last 7 messages between a user and a contact.
 * TTL: 24 hours.
 */
export async function cacheInbox(
  userId: string,
  contactId: string,
  messages: unknown[],
): Promise<void> {
  const key = inboxKey(userId, contactId);
  const trimmed = messages.slice(0, MAX_INBOX_MESSAGES);
  await redis.set(key, JSON.stringify(trimmed), "EX", 86400);
}

/**
 * Retrieve cached inbox messages for a user + contact pair.
 * Returns null if not cached.
 */
export async function getInbox(
  userId: string,
  contactId: string,
): Promise<unknown[] | null> {
  const key = inboxKey(userId, contactId);
  const data = await redis.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as unknown[];
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Online presence (5 minute TTL)
// ---------------------------------------------------------------------------

const ONLINE_TTL_SECONDS = 300; // 5 minutes

/**
 * Mark a user as online with a 5-minute TTL.
 */
export async function setOnlineStatus(userId: string): Promise<void> {
  await redis.set(onlineKey(userId), "1", "EX", ONLINE_TTL_SECONDS);
}

/**
 * Check whether a user is currently online.
 */
export async function isOnline(userId: string): Promise<boolean> {
  const result = await redis.exists(onlineKey(userId));
  return result === 1;
}

// ---------------------------------------------------------------------------
// Rate limiting (sliding window per minute)
// ---------------------------------------------------------------------------

const RATE_LIMITS: Record<string, number> = {
  basic: 100,
  business: 500,
  ecommerce: 2000,
};

function resolveTierLimit(tier: string): number {
  const normalized = tier.toLowerCase();
  if (normalized.startsWith("business")) return RATE_LIMITS.business;
  if (normalized === "ecommerce") return RATE_LIMITS.ecommerce;
  return RATE_LIMITS.basic;
}

/**
 * Check and increment the rate limit counter for a user.
 * Returns `{ allowed: true }` when within limits, otherwise
 * `{ allowed: false, retryAfterSeconds }`.
 */
export async function rateLimit(
  userId: string,
  tier: string = "basic",
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const key = rateLimitKey(userId);
  const limit = resolveTierLimit(tier);

  const current = await redis.incr(key);

  // First request in the window — set 60-second expiry
  if (current === 1) {
    await redis.expire(key, 60);
  }

  if (current > limit) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : 60 };
  }

  return { allowed: true };
}
