-- AlterTable
ALTER TABLE "checklist_item_definitions" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "high_risk" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "instructions" TEXT,
ADD COLUMN     "linked_document_id" TEXT;

-- AlterTable
ALTER TABLE "checklist_templates" ADD COLUMN     "is_customized" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_template_id" TEXT;

-- AlterTable
ALTER TABLE "clinician_checklist_items" ADD COLUMN     "signature_hash" TEXT,
ADD COLUMN     "signature_timestamp" TIMESTAMP(3),
ADD COLUMN     "signed_doc_path" TEXT,
ADD COLUMN     "signer_ip" TEXT,
ADD COLUMN     "signer_name" TEXT;

-- CreateTable
CREATE TABLE "template_documents" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_email_settings" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "subject" TEXT,
    "intro_text" TEXT,
    "required_items_intro" TEXT,
    "signature_block" TEXT,
    "legal_disclaimer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_email_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_documents_organization_id_idx" ON "template_documents"("organization_id");

-- CreateIndex
CREATE INDEX "template_documents_template_id_idx" ON "template_documents"("template_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_email_settings_organization_id_key" ON "org_email_settings"("organization_id");

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_source_template_id_fkey" FOREIGN KEY ("source_template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_item_definitions" ADD CONSTRAINT "checklist_item_definitions_linked_document_id_fkey" FOREIGN KEY ("linked_document_id") REFERENCES "template_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_documents" ADD CONSTRAINT "template_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_documents" ADD CONSTRAINT "template_documents_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_email_settings" ADD CONSTRAINT "org_email_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
