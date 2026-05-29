-- Tier E Sprint 6 (v4.15.12): group calls up to 7.
--
-- Adds:
--   1. calls.is_group boolean (default false) — distinguishes 1:1 from group
--   2. call_participants table — per-user state for both 1:1 and group calls
-- Does NOT touch existing 1:1 rows; legacy data continues to work without
-- a backfill (1:1 paths read calls.callee_id directly; group paths read
-- call_participants).

-- ---------------------------------------------------------------------
-- 1. is_group flag on calls
-- ---------------------------------------------------------------------
ALTER TABLE "calls"
  ADD COLUMN IF NOT EXISTS "is_group" BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------
-- 2. call_participants table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "call_participants" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "call_id"     UUID NOT NULL,
  "user_id"     UUID NOT NULL,
  "status"      VARCHAR(20) NOT NULL DEFAULT 'ringing',
  "accepted_at" TIMESTAMP(3),
  "left_at"     TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Uniqueness — a user can only appear once per call. Even if they
-- decline then get re-invited, the new attempt is a new Call row.
CREATE UNIQUE INDEX IF NOT EXISTS "call_participants_call_user_uniq"
  ON "call_participants" ("call_id", "user_id");

-- Drives the "ringing for me?" poll across both 1:1 and group calls.
CREATE INDEX IF NOT EXISTS "call_participants_user_status_idx"
  ON "call_participants" ("user_id", "status");

-- FK to calls. ON DELETE CASCADE because a Call row deletion should
-- take its participants with it (no orphan rows).
ALTER TABLE "call_participants"
  ADD CONSTRAINT "call_participants_call_fk"
  FOREIGN KEY ("call_id") REFERENCES "calls" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- FK to users — SET NULL on user delete so call history survives
-- account deletion (matches the existing calls.caller_fk pattern).
-- We allow NULL on call_participants.user_id by ALTER below since the
-- column was created NOT NULL.
ALTER TABLE "call_participants"
  ALTER COLUMN "user_id" DROP NOT NULL;
ALTER TABLE "call_participants"
  ADD CONSTRAINT "call_participants_user_fk"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- 3. Backfill: existing 1:1 calls get a single CallParticipant row
--    (the callee), mirroring the Call.status as the per-user status.
--    This unifies the read path so /api/calls/incoming + per-participant
--    PATCH only have to query CallParticipant going forward.
--
--    Map Call.status → per-participant status:
--      ringing/accepted → ringing/accepted (passthrough)
--      ended            → left
--      declined/missed  → declined/missed (passthrough)
--      failed           → declined (best-fit for historical rows)
-- ---------------------------------------------------------------------
INSERT INTO "call_participants" ("call_id", "user_id", "status", "accepted_at", "left_at", "created_at", "updated_at")
SELECT
  c."id",
  c."callee_id",
  CASE c."status"
    WHEN 'ringing'  THEN 'ringing'
    WHEN 'accepted' THEN 'accepted'
    WHEN 'ended'    THEN 'left'
    WHEN 'declined' THEN 'declined'
    WHEN 'missed'   THEN 'missed'
    WHEN 'failed'   THEN 'declined'
    ELSE                 'left'
  END,
  c."accepted_at",
  c."ended_at",
  c."created_at",
  c."updated_at"
FROM "calls" c
WHERE NOT EXISTS (
  SELECT 1 FROM "call_participants" cp
  WHERE cp."call_id" = c."id" AND cp."user_id" = c."callee_id"
);
