-- CreateEnum
CREATE TYPE "ProfileType" AS ENUM ('personal', 'social', 'legal_entity');

-- CreateEnum
CREATE TYPE "AccountTier" AS ENUM ('basic', 'business_3', 'business_7', 'business_50', 'ecommerce');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('USD', 'EUR');

-- CreateEnum
CREATE TYPE "DescriptionCategory" AS ENUM ('education', 'business', 'religion', 'other');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('basic', 'business_3', 'business_7', 'business_50', 'ecommerce');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'voice', 'video');

-- CreateEnum
CREATE TYPE "VapTransactionType" AS ENUM ('transfer', 'payment', 'deposit', 'withdrawal', 'fee', 'refund');

-- CreateEnum
CREATE TYPE "VapTransactionStatus" AS ENUM ('pending', 'completed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "VapTier" AS ENUM ('standard', 'premium', 'merchant');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "display_name" VARCHAR(45) NOT NULL,
    "profile_type" "ProfileType" NOT NULL DEFAULT 'personal',
    "phone_hash" TEXT,
    "email_hash" TEXT,
    "phone_encrypted" BYTEA,
    "email_encrypted" BYTEA,
    "account_tier" "AccountTier" NOT NULL DEFAULT 'basic',
    "vap_enabled" BOOLEAN NOT NULL DEFAULT false,
    "preferred_currency" "Currency" NOT NULL DEFAULT 'USD',
    "password_hash" TEXT NOT NULL,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_locations" (
    "user_id" UUID NOT NULL,
    "global_area" VARCHAR(100),
    "country_phone_code" VARCHAR(10),
    "region" VARCHAR(100),
    "city_zip" VARCHAR(100),
    "local_description" VARCHAR(255),
    "location_verified" BOOLEAN NOT NULL DEFAULT false,
    "location_visible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_locations_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "user_id" UUID NOT NULL,
    "slot_number" SMALLINT NOT NULL,
    "interest_text" VARCHAR(45) NOT NULL,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("user_id","slot_number")
);

-- CreateTable
CREATE TABLE "user_descriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category" "DescriptionCategory" NOT NULL,
    "level" VARCHAR(100),
    "location" VARCHAR(255),
    "institution" VARCHAR(255),
    "type_description" VARCHAR(255),

    CONSTRAINT "user_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "PlanType" NOT NULL DEFAULT 'basic',
    "period_type" "PeriodType" NOT NULL DEFAULT 'monthly',
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "max_search_results" INTEGER NOT NULL DEFAULT 7,
    "max_contacts_at_once" INTEGER NOT NULL DEFAULT 7,
    "max_contacts_per_period" INTEGER NOT NULL DEFAULT 7,
    "max_survey_participants" INTEGER NOT NULL DEFAULT 7,
    "max_group_size" INTEGER NOT NULL DEFAULT 7,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "group_id" UUID,
    "type" "MessageType" NOT NULL DEFAULT 'text',
    "content" TEXT,
    "media_urls" JSONB,
    "duration_seconds" INTEGER,
    "language_original" VARCHAR(10),
    "language_translated" VARCHAR(10),
    "translated_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_from_inbox_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "owner_id" UUID NOT NULL,
    "max_members" INTEGER NOT NULL DEFAULT 7,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "user_id" UUID NOT NULL,
    "contact_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("user_id","contact_id")
);

-- CreateTable
CREATE TABLE "vap_accounts" (
    "user_id" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "weekly_transfer_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "annual_transfer_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tier" "VapTier" NOT NULL DEFAULT 'standard',
    "tax_registration_id" VARCHAR(50),
    "last_transaction_at" TIMESTAMP(3),
    "virtual_card_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vap_accounts_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "vap_transactions" (
    "id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID,
    "type" "VapTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "fee_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "VapTransactionStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vap_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_hash_key" ON "users"("email_hash");

-- CreateIndex
CREATE INDEX "users_account_tier_idx" ON "users"("account_tier");

-- CreateIndex
CREATE INDEX "users_last_activity_at_idx" ON "users"("last_activity_at");

-- CreateIndex
CREATE INDEX "user_locations_global_area_region_idx" ON "user_locations"("global_area", "region");

-- CreateIndex
CREATE INDEX "user_locations_country_phone_code_idx" ON "user_locations"("country_phone_code");

-- CreateIndex
CREATE INDEX "user_descriptions_user_id_category_idx" ON "user_descriptions"("user_id", "category");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_expires_at_idx" ON "subscriptions"("expires_at");

-- CreateIndex
CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_receiver_id_created_at_idx" ON "messages"("receiver_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_group_id_created_at_idx" ON "messages"("group_id", "created_at");

-- CreateIndex
CREATE INDEX "messages_expires_from_inbox_at_idx" ON "messages"("expires_from_inbox_at");

-- CreateIndex
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE INDEX "contacts_contact_id_idx" ON "contacts"("contact_id");

-- CreateIndex
CREATE INDEX "vap_transactions_sender_id_created_at_idx" ON "vap_transactions"("sender_id", "created_at");

-- CreateIndex
CREATE INDEX "vap_transactions_receiver_id_created_at_idx" ON "vap_transactions"("receiver_id", "created_at");

-- CreateIndex
CREATE INDEX "vap_transactions_status_idx" ON "vap_transactions"("status");

-- AddForeignKey
ALTER TABLE "user_locations" ADD CONSTRAINT "user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_descriptions" ADD CONSTRAINT "user_descriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vap_accounts" ADD CONSTRAINT "vap_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vap_transactions" ADD CONSTRAINT "vap_transactions_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vap_transactions" ADD CONSTRAINT "vap_transactions_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
