-- Phase 3: access continuity, exports/legal hold, QAPI primitives

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgAccessMode') THEN
    CREATE TYPE "OrgAccessMode" AS ENUM ('active', 'read_only', 'suspended');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExportJobStatus') THEN
    CREATE TYPE "ExportJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CorrectiveActionStatus') THEN
    CREATE TYPE "CorrectiveActionStatus" AS ENUM ('open', 'closed');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PolicyDocumentType') THEN
    CREATE TYPE "PolicyDocumentType" AS ENUM ('terms', 'privacy', 'baa');
  END IF;
END
$$;

ALTER TABLE "organizations"
ADD COLUMN "access_mode" "OrgAccessMode" NOT NULL DEFAULT 'active',
ADD COLUMN "grace_period_ends_at" TIMESTAMP(3),
ADD COLUMN "retention_days" INTEGER NOT NULL DEFAULT 2555;

CREATE TABLE "organization_export_jobs" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "requested_by_user_id" TEXT,
  "status" "ExportJobStatus" NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json',
  "file_storage_path" TEXT,
  "error_message" TEXT,
  "metadata_json" JSONB,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "organization_export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "organization_export_jobs_organization_id_requested_at_idx"
  ON "organization_export_jobs"("organization_id", "requested_at");
CREATE INDEX "organization_export_jobs_status_requested_at_idx"
  ON "organization_export_jobs"("status", "requested_at");

ALTER TABLE "organization_export_jobs"
  ADD CONSTRAINT "organization_export_jobs_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_export_jobs"
  ADD CONSTRAINT "organization_export_jobs_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "legal_holds" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "case_reference" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "released_at" TIMESTAMP(3),
  "released_by_user_id" TEXT,
  CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "legal_holds_organization_id_active_created_at_idx"
  ON "legal_holds"("organization_id", "active", "created_at");

ALTER TABLE "legal_holds"
  ADD CONSTRAINT "legal_holds_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "legal_holds"
  ADD CONSTRAINT "legal_holds_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "legal_holds"
  ADD CONSTRAINT "legal_holds_released_by_user_id_fkey"
    FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "corrective_actions" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "owner_user_id" TEXT,
  "due_date" TIMESTAMP(3),
  "closure_date" TIMESTAMP(3),
  "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'open',
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corrective_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "corrective_actions_organization_id_status_due_date_idx"
  ON "corrective_actions"("organization_id", "status", "due_date");

ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "corrective_actions"
  ADD CONSTRAINT "corrective_actions_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "policy_acceptances" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "document_type" "PolicyDocumentType" NOT NULL,
  "document_version" TEXT NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_acceptances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "policy_acceptances_organization_id_document_type_accepted_at_idx"
  ON "policy_acceptances"("organization_id", "document_type", "accepted_at");
CREATE INDEX "policy_acceptances_user_id_document_type_accepted_at_idx"
  ON "policy_acceptances"("user_id", "document_type", "accepted_at");

ALTER TABLE "policy_acceptances"
  ADD CONSTRAINT "policy_acceptances_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "policy_acceptances"
  ADD CONSTRAINT "policy_acceptances_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

