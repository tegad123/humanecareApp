'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Shield,
  UserPlus,
  AlertCircle,
  CheckCircle,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
  Spinner,
  Badge,
  Button,
  Input,
  Modal,
} from '@/components/ui';
import { clientApiFetch } from '@/lib/api-client';
import {
  fetchTeamMembers,
  inviteTeamMember,
  updateMemberRole,
  removeMember,
  type TeamMember,
} from '@/lib/api/settings';

/* ── Constants ── */

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full access to all settings and team management' },
  { value: 'admin', label: 'Admin', description: 'Manage clinicians, templates, and team members' },
  { value: 'recruiter', label: 'Recruiter', description: 'Manage assigned clinicians and onboarding' },
  { value: 'compliance', label: 'Compliance', description: 'Review documents and compliance items' },
  { value: 'scheduler', label: 'Scheduler', description: 'Manage scheduling tasks' },
  { value: 'payroll', label: 'Payroll', description: 'Access payroll-related information' },
] as const;

function roleBadgeVariant(role: string): 'info' | 'success' | 'warning' | 'neutral' {
  switch (role) {
    case 'super_admin':
      return 'info';
    case 'admin':
      return 'success';
    default:
      return 'neutral';
  }
}

function formatRole(role: string) {
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* ── Page ── */

export default function SettingsPage() {
  const { getToken } = useAuth();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    role: string;
    organizationId: string;
    organization?: { name: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Invite modal
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Role edit
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);

  // Remove confirm
  const [removeConfirm, setRemoveConfirm] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [me, teamData] = await Promise.all([
        clientApiFetch<any>('/users/me', token),
        fetchTeamMembers(token),
      ]);
      setCurrentUser(me);
      setMembers(teamData);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';

  // Can the current user change this member's role?
  function canEditMember(member: TeamMember) {
    if (member.id === currentUser?.id) return false;
    if (isSuperAdmin) return true;
    if (currentUser?.role === 'admin') {
      return member.role !== 'super_admin' && member.role !== 'admin';
    }
    return false;
  }

  /* ── Invite ── */

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const token = await getToken();
      await inviteTeamMember(token, {
        email: inviteEmail.trim(),
        name: inviteName.trim() || undefined,
        role: inviteRole,
        organizationId: currentUser!.organizationId,
      });
      setInviteOpen(false);
      setInviteEmail('');
      setInviteName('');
      setInviteRole('admin');
      setSuccessMsg('Invitation sent successfully');
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  }

  /* ── Change Role ── */

  async function handleRoleChange(memberId: string, newRole: string) {
    setRoleLoading(memberId);
    setError(null);
    try {
      const token = await getToken();
      await updateMemberRole(token, memberId, newRole);
      setEditingRole(null);
      setSuccessMsg('Role updated successfully');
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setRoleLoading(null);
    }
  }

  /* ── Remove ── */

  async function handleRemove(memberId: string) {
    setRemoveLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await removeMember(token, memberId);
      setRemoveConfirm(null);
      setSuccessMsg('Team member removed');
      setTimeout(() => setSuccessMsg(null), 4000);
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to remove team member');
    } finally {
      setRemoveLoading(false);
    }
  }

  /* ── Render ── */

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !currentUser) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
        <p className="text-sm text-slate-600">{error}</p>
      </Card>
    );
  }

  const removeMemberObj = members.find((m) => m.id === removeConfirm);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your team members, roles, and organization settings.
        </p>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">{successMsg}</p>
        </div>
      )}

      {/* Error banner */}
      {error && currentUser && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* ── Team Members ── */}
      <div data-tour="team-members-card">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">
                Team Members
              </h2>
              <span className="text-xs text-slate-400">
                ({members.length})
              </span>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                variant="primary"
                data-tour="invite-member-btn"
                onClick={() => setInviteOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No team members yet. Invite someone to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-2.5 font-medium">Member</th>
                    <th className="px-5 py-2.5 font-medium">Role</th>
                    <th className="px-5 py-2.5 font-medium">Joined</th>
                    {isAdmin && (
                      <th className="px-5 py-2.5 font-medium text-right">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {members.map((member) => {
                    const isYou = member.id === currentUser?.id;
                    const isPending = !member.name && member.email;
                    const editable = canEditMember(member);

                    return (
                      <tr
                        key={member.id}
                        className="hover:bg-slate-50 transition"
                      >
                        {/* Name & email */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 uppercase shrink-0">
                              {(member.name || member.email)[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {member.name || 'Pending invite'}
                                {isYou && (
                                  <span className="ml-1.5 text-xs text-slate-400 font-normal">
                                    (you)
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-5 py-3">
                          {editingRole === member.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                className="text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                defaultValue={member.role}
                                disabled={roleLoading === member.id}
                                onChange={(e) =>
                                  handleRoleChange(member.id, e.target.value)
                                }
                              >
                                {ROLE_OPTIONS.filter(
                                  (opt) =>
                                    isSuperAdmin ||
                                    (opt.value !== 'super_admin' &&
                                      opt.value !== 'admin'),
                                ).map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {roleLoading === member.id && (
                                <Spinner size="sm" />
                              )}
                              <button
                                onClick={() => setEditingRole(null)}
                                className="text-xs text-slate-400 hover:text-slate-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant={roleBadgeVariant(member.role)}>
                                {formatRole(member.role)}
                              </Badge>
                              {isPending && (
                                <span className="text-xs text-amber-500 font-medium">
                                  Pending
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Joined date */}
                        <td className="px-5 py-3 text-slate-600">
                          {formatDate(member.createdAt)}
                        </td>

                        {/* Actions */}
                        {isAdmin && (
                          <td className="px-5 py-3 text-right">
                            {editable && editingRole !== member.id && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => setEditingRole(member.id)}
                                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                >
                                  Change Role
                                </button>
                                <button
                                  onClick={() => setRemoveConfirm(member.id)}
                                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* ── Role Descriptions ── */}
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">
            Role Permissions
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ROLE_OPTIONS.map((role) => (
              <div
                key={role.value}
                className="rounded-lg border border-slate-100 p-3"
              >
                <Badge variant={roleBadgeVariant(role.value)} className="mb-1.5">
                  {role.label}
                </Badge>
                <p className="text-xs text-slate-500">{role.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Invite Modal ── */}
      <Modal
        open={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setInviteError(null);
        }}
        title="Invite Team Member"
      >
        <div className="space-y-4">
          {inviteError && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <p className="text-xs text-red-800">{inviteError}</p>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />

          <Input
            label="Name (optional)"
            placeholder="Jane Doe"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              {ROLE_OPTIONS.filter(
                (opt) => isSuperAdmin || opt.value !== 'super_admin',
              ).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400">
              {ROLE_OPTIONS.find((r) => r.value === inviteRole)?.description}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setInviteOpen(false);
                setInviteError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={inviteLoading}
              onClick={handleInvite}
              disabled={!inviteEmail.trim()}
            >
              Send Invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Remove Confirmation Modal ── */}
      <Modal
        open={!!removeConfirm}
        onClose={() => setRemoveConfirm(null)}
        title="Remove Team Member"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to remove{' '}
            <span className="font-semibold text-slate-900">
              {removeMemberObj?.name || removeMemberObj?.email}
            </span>{' '}
            from the team? They will lose access to the admin dashboard
            immediately.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRemoveConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={removeLoading}
              onClick={() => removeConfirm && handleRemove(removeConfirm)}
              className="!bg-red-600 hover:!bg-red-700"
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
