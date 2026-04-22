-- Sprint 7 (v3.6.0): Yogi production mode — DB-backed personality, conversation
-- history, and per-user-per-day cost tracking.

-- CreateTable
CREATE TABLE "yogi_personalities" (
    "user_id" UUID NOT NULL,
    "tone" VARCHAR(50) NOT NULL DEFAULT 'friendly',
    "humor" INTEGER NOT NULL DEFAULT 5,
    "empathy" INTEGER NOT NULL DEFAULT 7,
    "total_chats" INTEGER NOT NULL DEFAULT 0,
    "interests" JSONB,
    "memory_summary" TEXT,
    "summarized_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yogi_personalities_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "yogi_messages" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(16) NOT NULL,
    "content" TEXT NOT NULL,
    "mode" VARCHAR(16) NOT NULL DEFAULT 'text',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yogi_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yogi_cost_logs" (
    "user_id" UUID NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "cache_write_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_micro_usd" INTEGER NOT NULL DEFAULT 0,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yogi_cost_logs_pkey" PRIMARY KEY ("user_id", "day")
);

-- CreateIndex
CREATE INDEX "yogi_messages_user_id_created_at_idx" ON "yogi_messages"("user_id", "created_at");
CREATE INDEX "yogi_cost_logs_day_idx" ON "yogi_cost_logs"("day");

-- AddForeignKey
ALTER TABLE "yogi_personalities" ADD CONSTRAINT "yogi_personalities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yogi_messages" ADD CONSTRAINT "yogi_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yogi_cost_logs" ADD CONSTRAINT "yogi_cost_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
