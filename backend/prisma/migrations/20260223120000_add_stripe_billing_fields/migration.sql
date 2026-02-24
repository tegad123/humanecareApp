-- CreateEnum (idempotent — survives partial prior run)
DO $$ BEGIN
  CREATE TYPE "PlanTier" AS ENUM ('starter', 'growth', 'pro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (idempotent)
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan_tier" "PlanTier" NOT NULL DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan_flags" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_email" TEXT;

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");
