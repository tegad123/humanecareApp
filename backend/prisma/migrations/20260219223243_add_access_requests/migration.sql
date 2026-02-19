-- CreateEnum
CREATE TYPE "AccessRequestStatus" AS ENUM ('pending', 'reviewed', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "access_requests" (
    "id" TEXT NOT NULL,
    "agency_name" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "work_email" TEXT NOT NULL,
    "phone" TEXT,
    "state" TEXT,
    "estimated_clinician_count" INTEGER,
    "emr" TEXT,
    "status" "AccessRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_requests_status_idx" ON "access_requests"("status");

-- CreateIndex
CREATE INDEX "access_requests_created_at_idx" ON "access_requests"("created_at");
