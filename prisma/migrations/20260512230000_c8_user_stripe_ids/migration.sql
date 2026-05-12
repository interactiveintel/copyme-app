-- C8 follow-up: persist Stripe customer + subscription IDs on the User row
-- so refund / cancel endpoints can look up payments without requiring the
-- caller to pass the IDs in (closes the v4.8.x REFUND_LOOKUP_UNAVAILABLE
-- 503 in /api/billing/refund).
--
-- Both nullable — most users have no Stripe relationship until they
-- complete a paid checkout. customer_id is unique (one per user, persists
-- across subscriptions); subscription_id is just indexed (we re-create on
-- new subscriptions, clear on customer.subscription.deleted).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" VARCHAR(64);
ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");
CREATE INDEX "users_stripe_subscription_id_idx" ON "users"("stripe_subscription_id");
