-- Sprint 9 (v3.8.0): B2B ad marketplace — advertiser side.

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('draft', 'pending_payment', 'pending_review', 'approved', 'rejected', 'paused', 'expired');

-- CreateTable
CREATE TABLE "business_ads" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "brand" VARCHAR(80) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "tagline" VARCHAR(200),
    "body" VARCHAR(700) NOT NULL,
    "image_url" VARCHAR(500),
    "cta_label" VARCHAR(40) NOT NULL DEFAULT 'Learn more',
    "cta_url" VARCHAR(500) NOT NULL,
    "category" VARCHAR(40) NOT NULL DEFAULT 'for-you',
    "target_interests" JSONB,
    "status" "AdStatus" NOT NULL DEFAULT 'draft',
    "price_micro_usd" INTEGER NOT NULL DEFAULT 100000,
    "stripe_checkout_id" VARCHAR(120),
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" VARCHAR(300),
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_ads_stripe_checkout_id_key" ON "business_ads"("stripe_checkout_id");
CREATE INDEX "business_ads_owner_id_status_idx" ON "business_ads"("owner_id", "status");
CREATE INDEX "business_ads_status_activated_at_idx" ON "business_ads"("status", "activated_at");
CREATE INDEX "business_ads_category_status_idx" ON "business_ads"("category", "status");

-- AddForeignKey
ALTER TABLE "business_ads" ADD CONSTRAINT "business_ads_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
