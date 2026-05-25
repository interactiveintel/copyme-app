-- Tier E Sprint 1 (v4.15.0): 1:1 voice call support.
--
-- One new value on the MessageType enum so the chat can render an
-- inline call bubble, and one new table for the call records.

-- ---------------------------------------------------------------------
-- 1. Extend MessageType enum
-- ---------------------------------------------------------------------
ALTER TYPE "MessageType" ADD VALUE IF NOT EXISTS 'call';

-- ---------------------------------------------------------------------
-- 2. calls table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "calls" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "caller_id"        UUID NOT NULL,
  "callee_id"        UUID NOT NULL,
  "call_type"        VARCHAR(10) NOT NULL DEFAULT 'voice',
  "status"           VARCHAR(20) NOT NULL DEFAULT 'ringing',
  "room"             VARCHAR(64) NOT NULL,
  "message_id"       UUID,
  "accepted_at"      TIMESTAMP(3),
  "ended_at"         TIMESTAMP(3),
  "duration_seconds" INTEGER,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 3. Indexes
--    - (callee_id, status) drives the "ringing for me?" poll (Sprint 1)
--      and "missed for me?" inbox surface (Sprint 5).
--    - (caller_id) drives "what did I call?" history.
--    - (created_at) drives time-bounded history queries.
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "calls_callee_status_idx" ON "calls" ("callee_id", "status");
CREATE INDEX IF NOT EXISTS "calls_caller_idx"        ON "calls" ("caller_id");
CREATE INDEX IF NOT EXISTS "calls_created_at_idx"    ON "calls" ("created_at");

-- ---------------------------------------------------------------------
-- 4. FKs to users + messages. We use SET NULL on user delete because we
--    want call history to survive an account deletion (anonymized) for
--    the requester. message FK is also SET NULL — the bound message
--    might be deleted independently as part of Rule-of-7 cycling.
-- ---------------------------------------------------------------------
ALTER TABLE "calls"
  ADD CONSTRAINT "calls_caller_fk"  FOREIGN KEY ("caller_id")  REFERENCES "users"    ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "calls_callee_fk"  FOREIGN KEY ("callee_id")  REFERENCES "users"    ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "calls_message_fk" FOREIGN KEY ("message_id") REFERENCES "messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
