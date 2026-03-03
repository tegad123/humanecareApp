import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface OrganizationComplianceSettings {
  id: string;
  requireDualApprovalForHighRiskOverride: boolean;
  timezone: string | null;
  retentionDays: number;
}

/* ── Team Members ── */

export async function fetchTeamMembers(token: string | null) {
  return clientApiFetch<TeamMember[]>('/users', token);
}

export async function inviteTeamMember(
  token: string | null,
  data: { email: string; name?: string; role: string; organizationId: string },
) {
  return clientApiFetch<TeamMember & { message: string }>(
    '/users/invite',
    token,
    { method: 'POST', body: JSON.stringify(data) },
  );
}

export async function updateMemberRole(
  token: string | null,
  userId: string,
  role: string,
) {
  return clientApiFetch<TeamMember>(`/users/${userId}/role`, token, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeMember(token: string | null, userId: string) {
  return clientApiFetch<{ message: string }>(`/users/${userId}`, token, {
    method: 'DELETE',
  });
}

export async function fetchOrganizationComplianceSettings(token: string | null) {
  return clientApiFetch<OrganizationComplianceSettings>('/users/organization-settings', token);
}

export async function updateOrganizationComplianceSettings(
  token: string | null,
  data: Partial<
    Pick<
      OrganizationComplianceSettings,
      'requireDualApprovalForHighRiskOverride' | 'timezone' | 'retentionDays'
    >
  >,
) {
  return clientApiFetch<OrganizationComplianceSettings>('/users/organization-settings', token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
