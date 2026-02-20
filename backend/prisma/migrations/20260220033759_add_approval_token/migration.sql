-- AlterTable
ALTER TABLE "access_requests" ADD COLUMN "approval_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_approval_token_key" ON "access_requests"("approval_token");
