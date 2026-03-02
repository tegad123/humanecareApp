import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface OrgDocument {
  id: string;
  organizationId: string;
  templateId: null;
  name: string;
  category: string;
  description: string | null;
  storagePath: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

/* ── API Calls ── */

export async function fetchOrgDocuments(token: string | null) {
  return clientApiFetch<OrgDocument[]>('/org-documents', token);
}

export async function fetchOrgDocumentCount(token: string | null) {
  return clientApiFetch<number>('/org-documents/count', token);
}

export async function uploadOrgDocument(
  token: string | null,
  data: {
    name: string;
    category?: string;
    description?: string;
    fileName: string;
    contentType: string;
    fileSizeBytes?: number;
  },
) {
  return clientApiFetch<{ document: OrgDocument; uploadUrl: string }>(
    '/org-documents',
    token,
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

export async function updateOrgDocument(
  token: string | null,
  docId: string,
  data: { name?: string; category?: string; description?: string },
) {
  return clientApiFetch<OrgDocument>(`/org-documents/${docId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getOrgDocumentDownloadUrl(
  token: string | null,
  docId: string,
) {
  return clientApiFetch<{ url: string; name: string; mimeType: string | null }>(
    `/org-documents/${docId}/download`,
    token,
  );
}

export async function getOrgDocClinicianDownloadUrl(
  token: string | null,
  docId: string,
) {
  return clientApiFetch<{ url: string; name: string; mimeType: string | null }>(
    `/org-documents/${docId}/clinician-download`,
    token,
  );
}

export async function deleteOrgDocument(
  token: string | null,
  docId: string,
) {
  return clientApiFetch<{ success: boolean }>(`/org-documents/${docId}`, token, {
    method: 'DELETE',
  });
}
