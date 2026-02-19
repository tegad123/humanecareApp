import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface TemplateDocument {
  id: string;
  templateId: string;
  name: string;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
}

export interface ItemDefinition {
  id: string;
  templateId: string;
  label: string;
  section: string;
  type: string;
  required: boolean;
  blocking: boolean;
  adminOnly: boolean;
  hasExpiration: boolean;
  sortOrder: number;
  configJson: any;
  instructions: string | null;
  highRisk: boolean;
  enabled: boolean;
  linkedDocumentId: string | null;
}

export interface Template {
  id: string;
  name: string;
  slug: string;
  state: string | null;
  discipline: string | null;
  description: string | null;
  organizationId: string | null;
  sourceTemplateId: string | null;
  isCustomized: boolean;
  itemDefinitions?: ItemDefinition[];
  _count?: { itemDefinitions: number };
  createdAt: string;
}

/* ── Template CRUD ── */

export async function fetchTemplates(token: string | null) {
  return clientApiFetch<Template[]>('/checklist-templates', token);
}

export async function fetchTemplate(token: string | null, id: string) {
  return clientApiFetch<Template>(`/checklist-templates/${id}`, token);
}

export async function cloneTemplate(token: string | null, templateId: string, name?: string) {
  return clientApiFetch<Template>(`/templates/${templateId}/clone`, token, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/* ── Item Definition CRUD ── */

export async function updateItemDefinition(
  token: string | null,
  templateId: string,
  defId: string,
  data: Partial<ItemDefinition>,
) {
  return clientApiFetch<ItemDefinition>(`/templates/${templateId}/items/${defId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function createItemDefinition(
  token: string | null,
  templateId: string,
  data: {
    label: string;
    section: string;
    type: string;
    required?: boolean;
    blocking?: boolean;
    highRisk?: boolean;
    instructions?: string;
    hasExpiration?: boolean;
    configJson?: any;
  },
) {
  return clientApiFetch<ItemDefinition>(`/templates/${templateId}/items`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteItemDefinition(
  token: string | null,
  templateId: string,
  defId: string,
) {
  return clientApiFetch<{ success: boolean; softDeleted: boolean }>(
    `/templates/${templateId}/items/${defId}`,
    token,
    { method: 'DELETE' },
  );
}

export async function reorderItems(
  token: string | null,
  templateId: string,
  orderedIds: string[],
) {
  return clientApiFetch<{ success: boolean }>(
    `/templates/${templateId}/items/reorder`,
    token,
    { method: 'PATCH', body: JSON.stringify({ orderedIds }) },
  );
}

/* ── Template Documents ── */

export async function fetchTemplateDocuments(token: string | null, templateId: string) {
  return clientApiFetch<TemplateDocument[]>(`/templates/${templateId}/documents`, token);
}

export async function uploadTemplateDocument(
  token: string | null,
  templateId: string,
  data: { name: string; fileName: string; contentType: string; fileSizeBytes?: number },
) {
  return clientApiFetch<{ document: TemplateDocument; uploadUrl: string }>(
    `/templates/${templateId}/documents`,
    token,
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function getDocumentDownloadUrl(
  token: string | null,
  templateId: string,
  docId: string,
) {
  return clientApiFetch<{ url: string; name: string; mimeType: string | null }>(
    `/templates/${templateId}/documents/${docId}/download`,
    token,
  );
}

export async function getClinicianDocumentDownloadUrl(
  token: string | null,
  templateId: string,
  docId: string,
) {
  return clientApiFetch<{ url: string; name: string; mimeType: string | null }>(
    `/templates/${templateId}/documents/${docId}/clinician-download`,
    token,
  );
}

export async function deleteTemplateDocument(
  token: string | null,
  templateId: string,
  docId: string,
) {
  return clientApiFetch<{ success: boolean }>(
    `/templates/${templateId}/documents/${docId}`,
    token,
    { method: 'DELETE' },
  );
}

/* ── Email Settings ── */

export interface EmailSettings {
  id?: string;
  subject: string;
  introText: string;
  requiredItemsIntro: string;
  signatureBlock: string;
  legalDisclaimer: string;
}

export async function fetchEmailSettings(token: string | null) {
  return clientApiFetch<EmailSettings>('/email-settings', token);
}

export async function updateEmailSettings(token: string | null, data: Partial<EmailSettings>) {
  return clientApiFetch<EmailSettings>('/email-settings', token, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchEmailDefaults(token: string | null) {
  return clientApiFetch<EmailSettings>('/email-settings/defaults', token);
}
