'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { ShieldAlert, ShieldOff, Clock } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '@/components/ui';
import {
  setOverride,
  clearOverride,
  type ClinicianWithProgress,
} from '@/lib/api/admin';

interface OverridePanelProps {
  clinician: ClinicianWithProgress;
  onOverrideChanged: () => void;
}

function timeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m remaining`;
  return `${mins}m remaining`;
}

export function OverridePanel({ clinician, onOverrideChanged }: OverridePanelProps) {
  const { getToken } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [reason, setReason] = useState('');
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOverrideActive = clinician.adminOverrideActive;

  const handleSetOverride = async () => {
    if (!reason.trim()) {
      setError('Reason is required.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await setOverride(token, clinician.id, {
        reason: reason.trim(),
        expiresInHours: hours,
        overrideValue: 'ready',
      });
      setShowForm(false);
      setReason('');
      onOverrideChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to set override');
    } finally {
      setLoading(false);
    }
  };

  const handleClearOverride = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      await clearOverride(token, clinician.id);
      onOverrideChanged();
    } catch (err: any) {
      setError(err.message || 'Failed to clear override');
    } finally {
      setLoading(false);
    }
  };

  if (isOverrideActive) {
    return (
      <Card className="border-warning-500/30 bg-warning-50">
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-warning-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-warning-800">
                  Admin Override Active
                </p>
                <Badge variant="warning">
                  {clinician.adminOverrideValue?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
              {clinician.adminOverrideReason && (
                <p className="text-xs text-warning-700 mt-1">
                  Reason: {clinician.adminOverrideReason}
                </p>
              )}
              {clinician.adminOverrideExpiresAt && (
                <p className="text-xs text-warning-600 mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeRemaining(clinician.adminOverrideExpiresAt)}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearOverride}
            loading={loading}
          >
            <ShieldOff className="h-3.5 w-3.5" />
            Remove Override
          </Button>
          {error && <p className="text-xs text-danger-600">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  // Only show override option when status is not_ready
  if (clinician.status === 'ready') return null;

  return (
    <Card>
      <CardContent className="space-y-3">
        {!showForm ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowForm(true)}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            Set Status Override
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Override to &quot;Ready to Staff&quot;
            </p>
            <p className="text-xs text-slate-500">
              Temporarily override this clinician&apos;s status. Max 72 hours.
              Cannot override if state license is expired.
            </p>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Reason *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                placeholder="Why is this override needed?"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Duration
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(parseInt(e.target.value))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={4}>4 hours</option>
                <option value={8}>8 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={72}>72 hours (max)</option>
              </select>
            </div>

            {error && <p className="text-xs text-danger-600">{error}</p>}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSetOverride}
                loading={loading}
              >
                Confirm Override
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
