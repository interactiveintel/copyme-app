-- Sprint 10 (v3.9.0): location targeting + per-day event aggregates.
-- All additive. The denormalized impressions/clicks counters on
-- business_ads stay (cheap to read for the ad list view); the new
-- ad_event_days table powers the time-series analytics.

-- AlterTable
ALTER TABLE "business_ads" ADD COLUMN "target_global_area" VARCHAR(100);
ALTER TABLE "business_ads" ADD COLUMN "target_region" VARCHAR(100);

-- CreateTable
CREATE TABLE "ad_event_days" (
    "ad_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_event_days_pkey" PRIMARY KEY ("ad_id", "day")
);

-- CreateIndex
CREATE INDEX "ad_event_days_day_idx" ON "ad_event_days"("day");

-- AddForeignKey
ALTER TABLE "ad_event_days" ADD CONSTRAINT "ad_event_days_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "business_ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
