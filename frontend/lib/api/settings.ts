import { clientApiFetch } from '../api-client';

/* ── Types ── */

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
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
