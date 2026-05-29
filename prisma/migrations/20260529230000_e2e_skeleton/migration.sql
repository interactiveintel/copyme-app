-- v4.16.9 (Sprint 8 skeleton): E2E publish/fetch surface.
--
-- Adds the minimum schema for clients to publish their Signal X3DH
-- pre-key bundle + receive encrypted messages from peers. NO send-
-- path integration yet — the existing cleartext path keeps working
-- exactly as-is until a future Tier S ship wires libsignal into
-- /api/messages/send.
--
-- All three columns are nullable so the rollout can be opt-in per
-- user without breaking existing rows.

-- ---------------------------------------------------------------------
-- 1. users.e2e_public_bundle (serialized PreKeyBundle JSON) +
--    users.e2e_registration_id (32-bit ID, stored as INT for headroom).
-- ---------------------------------------------------------------------
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "e2e_public_bundle"    TEXT,
  ADD COLUMN IF NOT EXISTS "e2e_registration_id"  INTEGER;

-- ---------------------------------------------------------------------
-- 2. messages.e2e_ciphertext (opt-in encrypted blob). Replaces the
--    role of `content` for E2E messages; `content` may carry a
--    placeholder so legacy clients render something meaningful.
-- ---------------------------------------------------------------------
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "e2e_ciphertext" BYTEA;
