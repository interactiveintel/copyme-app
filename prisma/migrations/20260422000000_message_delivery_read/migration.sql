-- Sprint 3 (v3.2.0): delivery + read receipts on messages.
-- Additive migration — existing rows get NULL for both columns, which the
-- code treats as "not yet delivered" / "not yet read" (correct for legacy
-- rows since the polling inbox will mark them delivered on next fetch).

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "delivered_at" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "read_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");
