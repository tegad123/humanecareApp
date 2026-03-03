-- Phase 2: tamper-evident audit events + signature certificate evidence

-- Checklist item evidence metadata
ALTER TABLE "clinician_checklist_items"
ADD COLUMN "signer_user_agent" TEXT,
ADD COLUMN "signer_timezone_offset_minutes" INTEGER,
ADD COLUMN "signature_certificate_path" TEXT;

-- Immutable audit event stream
CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "actor_user_id" TEXT,
  "actor_role" "Role",
  "clinician_id" TEXT,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "reason" TEXT,
  "old_value_json" JSONB,
  "new_value_json" JSONB,
  "details_json" JSONB,
  "payload_canonical" TEXT NOT NULL,
  "prev_hash" TEXT,
  "event_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_organization_id_created_at_idx"
  ON "audit_events"("organization_id", "created_at");
CREATE INDEX "audit_events_request_id_idx"
  ON "audit_events"("request_id");
CREATE UNIQUE INDEX "audit_events_event_hash_key"
  ON "audit_events"("event_hash");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_clinician_id_fkey"
    FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only protection for audit_events
CREATE OR REPLACE FUNCTION prevent_audit_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_prevent_update
BEFORE UPDATE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_events_mutation();

CREATE TRIGGER audit_events_prevent_delete
BEFORE DELETE ON "audit_events"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_events_mutation();

-- Signature evidence certificate records
CREATE TABLE "signature_certificates" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "clinician_id" TEXT NOT NULL,
  "checklist_item_id" TEXT NOT NULL,
  "signer_name" TEXT NOT NULL,
  "signer_account_id" TEXT,
  "signer_ip" TEXT,
  "signer_user_agent" TEXT,
  "signer_timezone_offset_minutes" INTEGER,
  "signed_at" TIMESTAMP(3) NOT NULL,
  "linked_document_id" TEXT,
  "linked_document_path" TEXT,
  "linked_document_hash" TEXT NOT NULL,
  "linked_document_version" INTEGER,
  "agreement_hash" TEXT NOT NULL,
  "certificate_storage_path" TEXT NOT NULL,
  "certificate_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "signature_certificates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "signature_certificates_organization_id_clinician_id_created_at_idx"
  ON "signature_certificates"("organization_id", "clinician_id", "created_at");
CREATE INDEX "signature_certificates_checklist_item_id_idx"
  ON "signature_certificates"("checklist_item_id");

ALTER TABLE "signature_certificates"
  ADD CONSTRAINT "signature_certificates_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_certificates"
  ADD CONSTRAINT "signature_certificates_clinician_id_fkey"
    FOREIGN KEY ("clinician_id") REFERENCES "clinicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "signature_certificates"
  ADD CONSTRAINT "signature_certificates_checklist_item_id_fkey"
    FOREIGN KEY ("checklist_item_id") REFERENCES "clinician_checklist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

