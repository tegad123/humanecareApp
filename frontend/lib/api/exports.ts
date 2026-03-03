import { clientApiFetch } from '../api-client';

export interface OrganizationExportJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: string;
  requestedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  downloadUrl?: string | null;
}

export interface LegalHold {
  id: string;
  reason: string;
  caseReference: string | null;
  active: boolean;
  createdByUserId: string | null;
  createdAt: string;
  releasedAt: string | null;
  releasedByUserId: string | null;
}

export interface CorrectiveAction {
  id: string;
  title: string;
  description: string | null;
  ownerUserId: string | null;
  dueDate: string | null;
  closureDate: string | null;
  status: 'open' | 'closed';
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QapiSummary {
  rangeDays: number;
  since: string;
  totals: {
    overrides: number;
    rejections: number;
    lateRenewals: number;
    discrepancies: number;
    correctiveActionsOpen: number;
    correctiveActionsClosed: number;
  };
}

export interface QapiTrendsPoint {
  day: string;
  overrides: number;
  rejections: number;
  lateRenewals: number;
}

export interface QapiTrends {
  rangeDays: number;
  since: string;
  points: QapiTrendsPoint[];
}

export interface RetentionHealth {
  accessMode: 'active' | 'read_only' | 'suspended';
  gracePeriodEndsAt: string | null;
  retentionDays: number | null;
  activeLegalHolds: number;
  retentionCleanupLastRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    processedCount: number;
    successCount: number;
    failureCount: number;
    errorMessage: string | null;
  } | null;
  accessModeTransitionLastRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    processedCount: number;
    successCount: number;
    failureCount: number;
    errorMessage: string | null;
  } | null;
}

export async function createOrgExport(token: string | null) {
  return clientApiFetch<OrganizationExportJob>('/exports/org', token, {
    method: 'POST',
  });
}

export async function listOrgExports(token: string | null) {
  return clientApiFetch<OrganizationExportJob[]>('/exports', token);
}

export async function getOrgExport(token: string | null, exportId: string) {
  return clientApiFetch<OrganizationExportJob>(`/exports/${exportId}`, token);
}

export async function listLegalHolds(token: string | null, activeOnly = false) {
  const query = new URLSearchParams();
  if (activeOnly) query.set('activeOnly', 'true');
  const qs = query.toString();
  return clientApiFetch<LegalHold[]>(`/exports/legal-holds${qs ? `?${qs}` : ''}`, token);
}

export async function createLegalHold(
  token: string | null,
  data: { reason: string; caseReference?: string },
) {
  return clientApiFetch<LegalHold>('/exports/legal-holds', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function releaseLegalHold(token: string | null, legalHoldId: string) {
  return clientApiFetch<LegalHold>(`/exports/legal-holds/${legalHoldId}/release`, token, {
    method: 'POST',
  });
}

export async function fetchQapiSummary(token: string | null, days = 90) {
  return clientApiFetch<QapiSummary>(`/exports/qapi/summary?days=${days}`, token);
}

export async function fetchQapiTrends(token: string | null, days = 90) {
  return clientApiFetch<QapiTrends>(`/exports/qapi/trends?days=${days}`, token);
}

export async function fetchRetentionHealth(token: string | null) {
  return clientApiFetch<RetentionHealth>('/jobs/retention-health', token);
}

export async function listCorrectiveActions(token: string | null) {
  return clientApiFetch<CorrectiveAction[]>('/exports/corrective-actions', token);
}

export async function createCorrectiveAction(
  token: string | null,
  data: {
    title: string;
    description?: string;
    ownerUserId?: string;
    dueDate?: string;
  },
) {
  return clientApiFetch<CorrectiveAction>('/exports/corrective-actions', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateCorrectiveAction(
  token: string | null,
  correctiveActionId: string,
  data: Partial<{
    title: string;
    description: string;
    ownerUserId: string | null;
    dueDate: string | null;
    closureDate: string | null;
    status: 'open' | 'closed';
  }>,
) {
  return clientApiFetch<CorrectiveAction>(
    `/exports/corrective-actions/${correctiveActionId}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    },
  );
}

export interface PolicyDocument {
  documentType: 'terms' | 'privacy' | 'baa';
  currentVersion: string;
  title: string;
  summary: string;
  userAcceptedVersion?: string | null;
  userAcceptedAt?: string | null;
  orgAcceptedVersion?: string | null;
  orgAcceptedAt?: string | null;
  isCurrentVersionAcceptedByUser?: boolean;
}

export async function fetchPolicyDocuments(token: string | null) {
  return clientApiFetch<{ documents: PolicyDocument[] }>('/exports/policies', token);
}

export async function acceptPolicyDocument(
  token: string | null,
  data: { documentType: 'terms' | 'privacy' | 'baa'; documentVersion: string },
) {
  return clientApiFetch<{
    id: string;
    documentType: 'terms' | 'privacy' | 'baa';
    documentVersion: string;
    acceptedAt: string;
  }>('/exports/policies/accept', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
