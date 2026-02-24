import { clientApiFetch } from '../api-client';
import type {
  Clinician,
  ChecklistItem,
  ClinicianProgress,
} from './clinicians';

export type { Clinician, ChecklistItem, ClinicianProgress };

/* ── Extended types for admin views ── */

export interface ClinicianWithProgress extends Clinician {
  progress: ClinicianProgress;
  template?: { id: string; name: string };
  assignedRecruiter?: { id: string; name: string; email: string } | null;
  adminOverrideActive?: boolean;
  adminOverrideValue?: string | null;
  adminOverrideReason?: string | null;
  adminOverrideExpiresAt?: string | null;
}

export interface ClinicianListResponse {
  clinicians: ClinicianWithProgress[];
  total: number;
}

export interface ClinicianStats {
  total: number;
  ready: number;
  onboarding: number;
  notReady: number;
  inactive: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  discipline: string;
  organizationId: string | null;
  isGlobal: boolean;
  itemDefinitions?: { id: string; label: string; section: string }[];
}

export interface InternalNote {
  id: string;
  clinicianId: string;
  content: string;
  createdAt: string;
  author: { id: string; name: string; email: string; role: string };
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  detailsJson: Record<string, any> | null;
  createdAt: string;
  actorUser?: { id: string; name: string; email: string; role: string } | null;
  clinician?: { id: string; firstName: string; lastName: string } | null;
}

/* ── Dashboard ── */

export async function fetchStats(token: string | null) {
  return clientApiFetch<ClinicianStats>('/clinicians/stats', token);
}

/* ── Clinician CRUD ── */

export async function fetchClinicians(
  token: string | null,
  params?: {
    status?: string;
    discipline?: string;
    search?: string;
    limit?: number;
    offset?: number;
  },
) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.discipline) query.set('discipline', params.discipline);
  if (params?.search) query.set('search', params.search);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return clientApiFetch<ClinicianListResponse>(`/clinicians${qs ? `?${qs}` : ''}`, token);
}

export async function fetchClinician(token: string | null, id: string) {
  return clientApiFetch<ClinicianWithProgress>(`/clinicians/${id}`, token);
}

export async function createClinician(
  token: string | null,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    discipline: string;
    templateId: string;
    assignedRecruiterId?: string;
    npi?: string;
    coverageArea?: string;
    notes?: string;
  },
) {
  return clientApiFetch<Clinician>('/clinicians', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClinician(
  token: string | null,
  id: string,
  data: Record<string, any>,
) {
  return clientApiFetch<Clinician>(`/clinicians/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/* ── Checklist ── */

export async function fetchClinicianChecklist(token: string | null, clinicianId: string) {
  return clientApiFetch<{ items: ChecklistItem[]; sections: Record<string, ChecklistItem[]> }>(
    `/clinicians/${clinicianId}/checklist`,
    token,
  );
}

export async function fetchClinicianProgress(token: string | null, clinicianId: string) {
  return clientApiFetch<ClinicianProgress>(`/clinicians/${clinicianId}/progress`, token);
}

export async function reviewChecklistItem(
  token: string | null,
  itemId: string,
  data: { status: 'approved' | 'rejected'; rejectionReason?: string; rejectionComment?: string },
) {
  return clientApiFetch<ChecklistItem>(`/checklist-items/${itemId}/review`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/* ── Templates ── */

export async function fetchTemplates(token: string | null) {
  return clientApiFetch<ChecklistTemplate[]>('/checklist-templates', token);
}

/* ── Notes ── */

export async function fetchNotes(token: string | null, clinicianId: string) {
  return clientApiFetch<InternalNote[]>(`/clinicians/${clinicianId}/notes`, token);
}

export async function addNote(token: string | null, clinicianId: string, content: string) {
  return clientApiFetch<InternalNote>(`/clinicians/${clinicianId}/notes`, token, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

/* ── Overrides ── */

export interface OverrideResult {
  overrideActive: boolean;
  overrideValue?: string;
  reason?: string;
  expiresAt?: string;
  status?: string;
}

export async function setOverride(
  token: string | null,
  clinicianId: string,
  data: { reason: string; expiresInHours: number; overrideValue?: string },
) {
  return clientApiFetch<OverrideResult>(`/clinicians/${clinicianId}/override`, token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function clearOverride(token: string | null, clinicianId: string) {
  return clientApiFetch<OverrideResult>(`/clinicians/${clinicianId}/override`, token, {
    method: 'DELETE',
  });
}

/* ── Invites ── */

export async function resendClinicianInvite(token: string | null, clinicianId: string) {
  return clientApiFetch<Clinician>(`/clinicians/${clinicianId}/resend-invite`, token, {
    method: 'POST',
  });
}

/* ── Expiring Items ── */

export interface ExpiringItem {
  id: string;
  label: string;
  section: string;
  blocking: boolean;
  expiresAt: string | null;
  daysRemaining?: number | null;
  clinician: {
    id: string;
    firstName: string;
    lastName: string;
    discipline: string;
    status: string;
  };
}

export interface ExpiringItemsResponse {
  expiringSoon: ExpiringItem[];
  expired: ExpiringItem[];
}

export async function fetchExpiringItems(
  token: string | null,
  params?: { days?: number; limit?: number },
) {
  const query = new URLSearchParams();
  if (params?.days) query.set('days', String(params.days));
  if (params?.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return clientApiFetch<ExpiringItemsResponse>(
    `/clinicians/expiring-items${qs ? `?${qs}` : ''}`,
    token,
  );
}

/* ── File Export ── */

export interface ClinicianFile {
  label: string;
  section: string;
  fileName: string;
  mimeType: string | null;
  downloadUrl: string;
}

export async function fetchClinicianFiles(token: string | null, clinicianId: string) {
  return clientApiFetch<{ clinicianName: string; files: ClinicianFile[] }>(
    `/clinicians/${clinicianId}/files`,
    token,
  );
}

/* ── Audit Logs ── */

export async function fetchAuditLogs(
  token: string | null,
  params?: { clinicianId?: string; limit?: number; offset?: number },
) {
  const query = new URLSearchParams();
  if (params?.clinicianId) query.set('clinicianId', params.clinicianId);
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.offset) query.set('offset', String(params.offset));
  const qs = query.toString();
  return clientApiFetch<AuditLog[]>(`/audit-logs${qs ? `?${qs}` : ''}`, token);
}
