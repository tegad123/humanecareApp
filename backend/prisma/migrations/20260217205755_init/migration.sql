-- CreateEnum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'recruiter', 'compliance', 'scheduler', 'payroll', 'clinician');

-- CreateEnum
CREATE TYPE "Discipline" AS ENUM ('PT', 'OT', 'SLP', 'MSW', 'RN', 'LPN', 'HHA', 'PTA', 'COTA', 'OTHER');

-- CreateEnum
CREATE TYPE "ChecklistItemType" AS ENUM ('file_upload', 'text', 'date', 'select', 'e_signature', 'admin_status');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('not_started', 'submitted', 'pending_review', 'approved', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "ClinicianStatus" AS ENUM ('not_started', 'onboarding', 'ready', 'not_ready', 'inactive');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('starter', 'growth', 'pro');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan_tier" "PlanTier" NOT NULL DEFAULT 'starter',
    "plan_flags" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clerk_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "Role" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinicians" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "discipline" "Discipline" NOT NULL,
    "template_id" TEXT,
    "assigned_recruiter_id" TEXT,
    "status" "ClinicianStatus" NOT NULL DEFAULT 'not_started',
    "admin_override_active" BOOLEAN NOT NULL DEFAULT false,
    "admin_override_value" "ClinicianStatus",
    "admin_override_reason" TEXT,
    "admin_override_expires_at" TIMESTAMP(3),
    "npi" TEXT,
    "coverage_area" TEXT,
    "rate_internal" DECIMAL(10,2),
    "notes" TEXT,
    "clerk_user_id" TEXT,
    "invite_token" TEXT,
    "invite_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "state" TEXT,
    "discipline" "Discipline",
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_item_definitions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "type" "ChecklistItemType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "admin_only" BOOLEAN NOT NULL DEFAULT false,
    "has_expiration" BOOLEAN NOT NULL DEFAULT false,
    "expiration_field_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_item_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinician_checklist_items" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinician_id" TEXT NOT NULL,
    "item_definition_id" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'not_started',
    "value_text" TEXT,
    "value_date" TIMESTAMP(3),
    "value_select" TEXT,
    "doc_storage_path" TEXT,
    "doc_original_name" TEXT,
    "doc_mime_type" TEXT,
    "expires_at" TIMESTAMP(3),
    "doc_type" TEXT,
    "extracted_expiration_date" TIMESTAMP(3),
    "ai_confidence" DECIMAL(5,4),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "rejection_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinician_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_role" "Role",
    "clinician_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internal_notes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "clinician_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_clerk_user_id_idx" ON "users"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinicians_clerk_user_id_key" ON "clinicians"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clinicians_invite_token_key" ON "clinicians"("invite_token");

-- CreateIndex
CREATE INDEX "clinicians_organization_id_idx" ON "clinicians"("organization_id");

-- CreateIndex
CREATE INDEX "clinicians_organization_id_status_idx" ON "clinicians"("organization_id", "status");

-- CreateIndex
CREATE INDEX "clinicians_email_idx" ON "clinicians"("email");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_templates_slug_key" ON "checklist_templates"("slug");

-- CreateIndex
CREATE INDEX "checklist_templates_organization_id_idx" ON "checklist_templates"("organization_id");

-- CreateIndex
CREATE INDEX "checklist_item_definitions_template_id_idx" ON "checklist_item_definitions"("template_id");

-- CreateIndex
CREATE INDEX "clinician_checklist_items_organization_id_idx" ON "clinician_checklist_items"("organization_id");

-- CreateIndex
CREATE INDEX "clinician_checklist_items_clinician_id_idx" ON "clinician_checklist_items"("clinician_id");

-- CreateIndex
CREATE INDEX "clinician_checklist_items_status_idx" ON "clinician_checklist_items"("status");

-- CreateIndex
CREATE INDEX "clinician_checklist_items_expires_at_idx" ON "clinician_checklist_items"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_organization_id_idx" ON "audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "audit_logs_clinician_id_idx" ON "audit_logs"("clinician_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "internal_notes_organization_id_clinician_id_idx" ON "internal_notes"("organization_id", "clinician_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinicians" ADD CONSTRAINT "clinicians_assigned_recruiter_id_fkey" FOREIGN KEY ("assigned_recruiter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_definitions" ADD CONSTRAINT "checklist_item_definitions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_checklist_items" ADD CONSTRAINT "clinician_checklist_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_checklist_items" ADD CONSTRAINT "clinician_checklist_items_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_checklist_items" ADD CONSTRAINT "clinician_checklist_items_item_definition_id_fkey" FOREIGN KEY ("item_definition_id") REFERENCES "checklist_item_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinician_checklist_items" ADD CONSTRAINT "clinician_checklist_items_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_clinician_id_fkey" FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_notes" ADD CONSTRAINT "internal_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
