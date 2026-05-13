-- v4.11.1 follow-up: store the plaintext recipient email on the
-- verification-token row so the verify endpoint can send a welcome
-- email at the moment of first verification (phone-first users
-- previously never got one).
--
-- Plaintext is acceptable here because the token row is short-lived
-- (24-hour TTL) and is deleted on use. The User row continues to
-- store only the encrypted/hashed email.
--
-- Nullable so existing in-flight tokens without this column still work.

-- AlterTable
ALTER TABLE "email_verification_tokens" ADD COLUMN "email" VARCHAR(254);
