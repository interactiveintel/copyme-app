-- Beta invite-code gate (v4.12.0).
--
-- Two tables: invite_codes (the code itself) + invite_code_redemptions
-- (one row per signup that used it). A code can be one-shot (max_uses=1)
-- or shared (max_uses=N), can carry an expiry, and tracks who minted it.
--
-- Activation is gated by the BETA_INVITE_REQUIRED env var; without it
-- the schema sits dormant and signup behaves as before.

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "minted_by_id" UUID,
    "note" VARCHAR(120),
    "max_uses" INTEGER NOT NULL DEFAULT 1,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invite_code_redemptions" (
    "id" UUID NOT NULL,
    "invite_code_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invite_code_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "invite_code_redemptions_user_id_idx" ON "invite_code_redemptions"("user_id");

-- CreateIndex
CREATE INDEX "invite_code_redemptions_invite_code_id_idx" ON "invite_code_redemptions"("invite_code_id");

-- AddForeignKey
ALTER TABLE "invite_code_redemptions" ADD CONSTRAINT "invite_code_redemptions_invite_code_id_fkey" FOREIGN KEY ("invite_code_id") REFERENCES "invite_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
