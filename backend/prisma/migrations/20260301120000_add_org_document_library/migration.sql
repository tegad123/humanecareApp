-- AlterTable: Make templateId nullable to support org-level documents
ALTER TABLE "template_documents" ALTER COLUMN "template_id" DROP NOT NULL;

-- AddColumn: Document category for organization document library
ALTER TABLE "template_documents" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other';

-- AddColumn: Optional description for documents
ALTER TABLE "template_documents" ADD COLUMN "description" TEXT;
