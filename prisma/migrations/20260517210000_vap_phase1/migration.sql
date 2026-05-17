-- Tier D Phase 1 — VAP-only payments (no BaaS partner required).
--
-- Adds:
--   1. Two new MessageType enum values (vap_transfer, vap_request) so
--      VAP events render as inline thread bubbles alongside regular text.
--   2. A `vap_requests` table for pending money-requests + split-bill
--      participants. Requests carry an expiry (default 7 days) and a
--      lifecycle: pending → paid|declined|expired|canceled.
--   3. A `split_group_id` column on requests so a single split-bill
--      lookup returns all participants without a separate parent table.
--
-- All money lives in the existing `vap_accounts` + `vap_transactions`
-- tables. This migration adds the *coordination* layer, not new ledgers.

-- AlterEnum: AddValue won't roll back so we run each separately so
-- a failure mid-migration doesn't leave a partial enum. Postgres
-- requires these to be committed before they can be USED, so we don't
-- use the new values elsewhere in this migration.
ALTER TYPE "MessageType" ADD VALUE 'vap_transfer';
ALTER TYPE "MessageType" ADD VALUE 'vap_request';

-- CreateTable
CREATE TABLE "vap_requests" (
    "id" UUID NOT NULL,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "note" VARCHAR(140),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "split_group_id" UUID,
    "fulfilled_transaction_id" UUID,
    "message_id" UUID,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vap_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vap_requests_to_user_id_status_idx" ON "vap_requests"("to_user_id", "status");

-- CreateIndex
CREATE INDEX "vap_requests_from_user_id_idx" ON "vap_requests"("from_user_id");

-- CreateIndex
CREATE INDEX "vap_requests_split_group_id_idx" ON "vap_requests"("split_group_id");

-- CreateIndex
CREATE INDEX "vap_requests_expires_at_idx" ON "vap_requests"("expires_at") WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "vap_requests" ADD CONSTRAINT "vap_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vap_requests" ADD CONSTRAINT "vap_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vap_requests" ADD CONSTRAINT "vap_requests_fulfilled_transaction_id_fkey" FOREIGN KEY ("fulfilled_transaction_id") REFERENCES "vap_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
