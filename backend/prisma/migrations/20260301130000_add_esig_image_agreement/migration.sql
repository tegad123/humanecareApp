-- Add signature image path and agreement text for enhanced e-signatures
ALTER TABLE "clinician_checklist_items" ADD COLUMN "signature_image_path" TEXT;
ALTER TABLE "clinician_checklist_items" ADD COLUMN "agreement_text" TEXT;
