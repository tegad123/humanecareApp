-- Enums
CREATE TYPE "AssignmentAttestationState" AS ENUM ('attested', 'revoked', 'expired');
CREATE TYPE "OverrideReasonCode" AS ENUM ('emergency_staffing', 'temporary_transfer', 'documentation_pending', 'admin_exception', 'other');

-- Organization controls
ALTER TABLE "organizations"
ADD COLUMN "require_dual_approval_for_high_risk_override" BOOLEAN NOT NULL DEFAULT false;

-- Clinician override controls
ALTER TABLE "clinicians"
ADD COLUMN "admin_override_reason_code" "OverrideReasonCode",
ADD COLUMN "admin_override_second_approver_id" TEXT,
ADD COLUMN "admin_override_second_approved_at" TIMESTAMP(3);

-- Template publish controls
ALTER TABLE "checklist_templates"
ADD COLUMN "published_revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "last_published_at" TIMESTAMP(3),
ADD COLUMN "last_published_by_id" TEXT;

-- Assignment attestations
CREATE TABLE "assignment_attestations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "clinician_id" TEXT NOT NULL,
  "state" "AssignmentAttestationState" NOT NULL,
  "reason_code" TEXT NOT NULL,
  "reason_text" TEXT,
  "attested_by_user_id" TEXT,
  "attested_by_role" "Role",
  "attested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "revoked_by_user_id" TEXT,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "assignment_attestations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "assignment_attestations_organization_id_clinician_id_created_a_idx"
  ON "assignment_attestations"("organization_id", "clinician_id", "created_at");
CREATE INDEX "assignment_attestations_state_idx"
  ON "assignment_attestations"("state");

ALTER TABLE "assignment_attestations"
  ADD CONSTRAINT "assignment_attestations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_attestations"
  ADD CONSTRAINT "assignment_attestations_clinician_id_fkey"
    FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assignment_attestations"
  ADD CONSTRAINT "assignment_attestations_attested_by_user_id_fkey"
    FOREIGN KEY ("attested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "assignment_attestations"
  ADD CONSTRAINT "assignment_attestations_revoked_by_user_id_fkey"
    FOREIGN KEY ("revoked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Template publish attestations
CREATE TABLE "template_publish_attestations" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "published_by_user_id" TEXT NOT NULL,
  "published_by_role" "Role" NOT NULL,
  "published_revision" INTEGER NOT NULL,
  "jurisdiction_state" TEXT,
  "discipline" "Discipline",
  "required_categories_json" JSONB NOT NULL,
  "attestation_accepted" BOOLEAN NOT NULL DEFAULT false,
  "attestation_text" TEXT,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "template_publish_attestations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "template_publish_attestations_organization_id_template_id_publi_idx"
  ON "template_publish_attestations"("organization_id", "template_id", "published_at");

ALTER TABLE "template_publish_attestations"
  ADD CONSTRAINT "template_publish_attestations_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_publish_attestations"
  ADD CONSTRAINT "template_publish_attestations_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "template_publish_attestations"
  ADD CONSTRAINT "template_publish_attestations_published_by_user_id_fkey"
    FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

