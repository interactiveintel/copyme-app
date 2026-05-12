-- AlterTable
ALTER TABLE "users" ADD COLUMN     "preferred_locale" VARCHAR(10) NOT NULL DEFAULT 'en';

-- CreateTable
CREATE TABLE "translation_cost_logs" (
    "user_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "translation_cost_logs_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "translation_cost_logs_day_idx" ON "translation_cost_logs"("day");

-- AddForeignKey
ALTER TABLE "translation_cost_logs" ADD CONSTRAINT "translation_cost_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
