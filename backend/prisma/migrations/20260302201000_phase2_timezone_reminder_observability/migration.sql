-- Phase 2 continuation: organization timezone + reminder job observability

ALTER TABLE "organizations"
ADD COLUMN "timezone" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'JobRunStatus') THEN
    CREATE TYPE "JobRunStatus" AS ENUM ('running', 'success', 'failed');
  END IF;
END
$$;

CREATE TABLE "job_runs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT,
  "job_name" TEXT NOT NULL,
  "status" "JobRunStatus" NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL,
  "finished_at" TIMESTAMP(3),
  "processed_count" INTEGER NOT NULL DEFAULT 0,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_runs_job_name_created_at_idx"
  ON "job_runs"("job_name", "created_at");
CREATE INDEX "job_runs_organization_id_job_name_created_at_idx"
  ON "job_runs"("organization_id", "job_name", "created_at");

ALTER TABLE "job_runs"
  ADD CONSTRAINT "job_runs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

