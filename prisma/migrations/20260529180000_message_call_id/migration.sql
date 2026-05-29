-- Tier E Sprint 6 polish (v4.15.17): per-thread group call bubbles.
--
-- A 1:1 call writes one Message row and uses Call.messageId to link
-- back. A group call writes N Messages (one per caller↔callee pair)
-- so each callee sees the call in their chat thread with the caller.
-- updateCallStatus has to update ALL of them when the call's
-- aggregate status flips — needs a back-reference column on Message.

-- ---------------------------------------------------------------------
-- 1. messages.call_id (nullable). NOT a FK — Call rows can outlive
--    individual Messages (Rule of 7 cycles old messages out), and
--    deleting a Call shouldn't cascade-delete chat history that
--    happens to mention it. The application enforces consistency.
-- ---------------------------------------------------------------------
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "call_id" UUID;

-- Drives the "all messages for this call" query in updateCallStatus.
CREATE INDEX IF NOT EXISTS "messages_call_id_idx"
  ON "messages" ("call_id");

-- ---------------------------------------------------------------------
-- 2. Backfill: link existing 1:1 call messages to their Call so the
--    new query path also works for historical rows.
-- ---------------------------------------------------------------------
UPDATE "messages" m
SET    "call_id" = c."id"
FROM   "calls" c
WHERE  c."message_id" = m."id"
  AND  m."call_id" IS NULL;
