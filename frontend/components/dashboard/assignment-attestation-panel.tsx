'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Badge, Button, Card, CardContent } from '@/components/ui';
import {
  attestAssignment,
  revokeAssignmentAttestation,
  type ClinicianWithProgress,
} from '@/lib/api/admin';

const ATTEST_REASON_OPTIONS = [
  { value: 'all_requirements_verified', label: 'All requirements verified' },
  { value: 'manager_review_completed', label: 'Manager review completed' },
  { value: 'conditional_clearance', label: 'Conditional clearance' },
  { value: 'other', label: 'Other' },
];

const REVOKE_REASON_OPTIONS = [
  { value: 'credential_change', label: 'Credential change' },
  { value: 'manual_reassessment', label: 'Manual reassessment' },
  { value: 'incident_review', label: 'Incident review' },
  { value: 'other', label: 'Other' },
];

export function AssignmentAttestationPanel({
  clinician,
  onChanged,
}: {
  clinician: ClinicianWithProgress;
  onChanged: () => void;
}) {
  const { getToken } = useAuth();
  const [attestReasonCode, setAttestReasonCode] = useState('all_requirements_verified');
  const [attestReasonText, setAttestReasonText] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('');
  const [revokeReasonCode, setRevokeReasonCode] = useState('manual_reassessment');
  const [revokeReasonText, setRevokeReasonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attestation = clinician.assignmentAttestation;
  const isAttested = attestation?.state === 'attested';
  const isSystemReady = (clinician.systemStatus || clinician.status) === 'ready';

  async function handleAttest() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await attestAssignment(token, clinician.id, {
        reasonCode: attestReasonCode,
        reasonText: attestReasonText.trim() || undefined,
        expiresInHours: expiresInHours ? Number(expiresInHours) : undefined,
      });
      setAttestReasonText('');
      setExpiresInHours('');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to attest assignment');
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await revokeAssignmentAttestation(token, clinician.id, {
        reasonCode: revokeReasonCode,
        reasonText: revokeReasonText.trim() || undefined,
      });
      setRevokeReasonText('');
      onChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke attestation');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">Assignment Attestation</p>
          <Badge
            variant={
              attestation?.state === 'attested'
                ? 'success'
                : attestation?.state === 'expired'
                  ? 'warning'
                  : 'neutral'
            }
          >
            {attestation?.state ? attestation.state.replace(/_/g, ' ').toUpperCase() : 'NOT ATTESTED'}
          </Badge>
        </div>

        {isAttested ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Attested {attestation?.attestedAt ? new Date(attestation.attestedAt).toLocaleString() : ''}.
              {attestation?.expiresAt ? ` Expires ${new Date(attestation.expiresAt).toLocaleString()}.` : ''}
            </p>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Revoke Reason</label>
              <select
                value={revokeReasonCode}
                onChange={(e) => setRevokeReasonCode(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {REVOKE_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                value={revokeReasonText}
                onChange={(e) => setRevokeReasonText(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional revocation details"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleRevoke} loading={loading}>
              Revoke Attestation
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {!isSystemReady && (
              <p className="text-xs text-amber-700">
                System Ready is required before attestation can be recorded.
              </p>
            )}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Attestation Reason</label>
              <select
                value={attestReasonCode}
                onChange={(e) => setAttestReasonCode(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {ATTEST_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <textarea
                value={attestReasonText}
                onChange={(e) => setAttestReasonText(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Optional attestation details"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Optional Expiration (hours)
              </label>
              <input
                type="number"
                min={1}
                max={720}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Leave empty for no expiration"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAttest}
              loading={loading}
              disabled={!isSystemReady}
            >
              Attest for Assignment
            </Button>
          </div>
        )}

        {error && <p className="text-xs text-danger-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
