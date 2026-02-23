import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface Clinician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  discipline: string;
  status: string;
  npi: string | null;
  coverageArea: string | null;
  notes: string | null;
  templateId: string;
  assignedRecruiterId: string | null;
  clerkUserId: string | null;
  organizationId: string;
  createdAt: string;
}

export interface ChecklistItemDefinition {
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
  configJson: Record<string, any> | null;
  instructions: string | null;
  highRisk: boolean;
  linkedDocumentId: string | null;
}

export interface ChecklistItem {
  id: string;
  clinicianId: string;
  itemDefinitionId: string;
  status: string;
  valueText: string | null;
  valueDate: string | null;
  valueSelect: string | null;
  docStoragePath: string | null;
  docOriginalName: string | null;
  docMimeType: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  rejectionComment: string | null;
  signerName: string | null;
  signatureTimestamp: string | null;
  signerIp: string | null;
  signatureHash: string | null;
  signedDocPath: string | null;
  itemDefinition: ChecklistItemDefinition;
}

export interface ClinicianProgress {
  total: number;
  completed: number;
  submitted: number;
  rejected: number;
  expired: number;
  notStarted: number;
  requiredTotal: number;
  requiredCompleted: number;
  blockingTotal: number;
  blockingCompleted: number;
  percentage: number;
}

/* ── API calls ── */

export async function fetchMyChecklist(token: string | null) {
  return clientApiFetch<{ items: ChecklistItem[]; sections: Record<string, ChecklistItem[]> }>(
    '/clinicians/me/checklist',
    token,
  );
}

export async function fetchMyProgress(token: string | null) {
  return clientApiFetch<ClinicianProgress>('/clinicians/me/progress', token);
}

export async function fetchMyProfile(token: string | null) {
  return clientApiFetch<Clinician>('/clinicians/me', token);
}

export async function submitChecklistItem(
  token: string | null,
  itemId: string,
  data: Record<string, any>,
) {
  return clientApiFetch<ChecklistItem>(`/checklist-items/${itemId}/submit`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getUploadUrl(
  token: string | null,
  params: { clinicianId: string; itemId: string; fileName: string; contentType: string },
) {
  return clientApiFetch<{ url: string; key: string }>('/storage/upload-url', token, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function getDownloadUrl(token: string | null, key: string) {
  return clientApiFetch<{ url: string }>(
    `/storage/download-url?key=${encodeURIComponent(key)}`,
    token,
  );
}

export async function getLinkedDocumentUrl(
  token: string | null,
  templateId: string,
  docId: string,
) {
  return clientApiFetch<{ url: string; name: string; mimeType: string | null }>(
    `/templates/${templateId}/documents/${docId}/clinician-download`,
    token,
  );
}
