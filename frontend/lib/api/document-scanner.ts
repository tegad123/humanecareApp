import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface BulkUploadDocument {
  id: string;
  originalFileName: string;
  mimeType: string;
  status: 'pending_upload' | 'uploaded' | 'scanning' | 'scanned' | 'matched' | 'committed' | 'failed' | 'skipped';
  aiExtractedDocType: string | null;
  aiExtractedExpiration: string | null;
  aiConfidence: number | null;
  aiExtractedClinicianName: string | null;
  matchedClinicianId: string | null;
  matchedItemDefinitionId: string | null;
  matchedChecklistItemId: string | null;
  confirmedExpiration: string | null;
  confirmedDocType: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface BulkUploadJob {
  id: string;
  status: 'pending' | 'uploading' | 'scanning' | 'review' | 'completed' | 'failed';
  totalFiles: number;
  processedFiles: number;
  matchedFiles: number;
  committedFiles: number;
  failedFiles: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  documents: BulkUploadDocument[];
}

export interface BulkUploadCreateResponse {
  jobId: string;
  documents: Array<{ docId: string; uploadUrl: string; key: string }>;
}

/* ── API Functions ── */

export async function createBulkUpload(
  token: string | null,
  files: Array<{ fileName: string; contentType: string }>,
) {
  return clientApiFetch<BulkUploadCreateResponse>(
    '/document-scanner/bulk-upload',
    token,
    { method: 'POST', body: JSON.stringify({ files }) },
  );
}

export async function confirmUploads(token: string | null, jobId: string) {
  return clientApiFetch<BulkUploadJob>(
    `/document-scanner/bulk-upload/${jobId}/confirm-uploads`,
    token,
    { method: 'POST' },
  );
}

export async function getBulkUploadJob(token: string | null, jobId: string) {
  return clientApiFetch<BulkUploadJob>(
    `/document-scanner/bulk-upload/${jobId}`,
    token,
  );
}

export async function listBulkUploadJobs(token: string | null) {
  return clientApiFetch<BulkUploadJob[]>(
    '/document-scanner/bulk-upload',
    token,
  );
}

export async function updateDocumentMatch(
  token: string | null,
  jobId: string,
  docId: string,
  data: {
    matchedClinicianId?: string;
    matchedItemDefinitionId?: string;
    confirmedExpiration?: string;
    confirmedDocType?: string;
    status?: 'matched' | 'skipped';
  },
) {
  return clientApiFetch<BulkUploadDocument>(
    `/document-scanner/bulk-upload/${jobId}/documents/${docId}`,
    token,
    { method: 'PATCH', body: JSON.stringify(data) },
  );
}

export async function commitBulkUpload(token: string | null, jobId: string) {
  return clientApiFetch<BulkUploadJob>(
    `/document-scanner/bulk-upload/${jobId}/commit`,
    token,
    { method: 'POST' },
  );
}
