-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'growth', 'pro');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "plan_tier" "PlanTier" NOT NULL DEFAULT 'starter';
ALTER TABLE "organizations" ADD COLUMN "plan_flags" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "billing_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");
