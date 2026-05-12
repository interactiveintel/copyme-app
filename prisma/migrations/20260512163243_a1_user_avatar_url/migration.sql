-- AlterTable
ALTER TABLE "ad_event_days" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "business_ads" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" VARCHAR(500);

-- AlterTable
ALTER TABLE "yogi_cost_logs" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "yogi_personalities" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "phone_otps" (
    "id" UUID NOT NULL,
    "phone_hash" VARCHAR(64) NOT NULL,
    "code_hash" TEXT NOT NULL,
    "phone_encrypted" BYTEA,
    "ip_hash" VARCHAR(64),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phone_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_hash" TEXT NOT NULL,
    "device_id" UUID NOT NULL,
    "device_label" VARCHAR(120),
    "user_agent" VARCHAR(255),
    "ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "replay_detected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recovery_files" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "secondary_phone_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumed_at" TIMESTAMP(3),

    CONSTRAINT "recovery_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_deletions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "export_url" VARCHAR(500),
    "export_ready_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "erased_at" TIMESTAMP(3),

    CONSTRAINT "account_deletions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surveys" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "questions" JSONB NOT NULL,
    "target_interests" JSONB,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "reward_type" VARCHAR(20) NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "survey_responses" (
    "id" UUID NOT NULL,
    "survey_id" UUID NOT NULL,
    "user_hash" VARCHAR(64) NOT NULL,
    "answers" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "survey_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_suspensions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "details" VARCHAR(2000),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "escalates_at" TIMESTAMP(3),
    "lifted_at" TIMESTAMP(3),
    "appeal_url" VARCHAR(500),

    CONSTRAINT "account_suspensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "phone_otps_phone_hash_created_at_idx" ON "phone_otps"("phone_hash", "created_at");

-- CreateIndex
CREATE INDEX "phone_otps_expires_at_idx" ON "phone_otps"("expires_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_revoked_at_idx" ON "sessions"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "sessions_device_id_idx" ON "sessions"("device_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "recovery_files_user_id_key" ON "recovery_files"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_deletions_user_id_key" ON "account_deletions"("user_id");

-- CreateIndex
CREATE INDEX "account_deletions_effective_at_erased_at_idx" ON "account_deletions"("effective_at", "erased_at");

-- CreateIndex
CREATE INDEX "surveys_owner_id_status_idx" ON "surveys"("owner_id", "status");

-- CreateIndex
CREATE INDEX "surveys_status_created_at_idx" ON "surveys"("status", "created_at");

-- CreateIndex
CREATE INDEX "survey_responses_survey_id_created_at_idx" ON "survey_responses"("survey_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "survey_responses_survey_id_user_hash_key" ON "survey_responses"("survey_id", "user_hash");

-- CreateIndex
CREATE INDEX "account_suspensions_user_id_lifted_at_idx" ON "account_suspensions"("user_id", "lifted_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recovery_files" ADD CONSTRAINT "recovery_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_deletions" ADD CONSTRAINT "account_deletions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_suspensions" ADD CONSTRAINT "account_suspensions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
