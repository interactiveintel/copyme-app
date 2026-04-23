-- Sprint 12 (v4.1.0): referral fields on users.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "referral_code" VARCHAR(16);
ALTER TABLE "users" ADD COLUMN "referred_by_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- AddForeignKey (self-reference, set NULL if the referrer is deleted)
ALTER TABLE "users"
  ADD CONSTRAINT "users_referred_by_id_fkey"
  FOREIGN KEY ("referred_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
