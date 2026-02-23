-- AlterTable
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "stripe_subscription_id" TEXT;
ALTER TABLE "organizations" ADD COLUMN "billing_email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_subscription_id_key" ON "organizations"("stripe_subscription_id");
