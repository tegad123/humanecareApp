'use client';

import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, Spinner } from '@/components/ui';
import type { ReminderHealth } from '@/lib/api/admin';

function formatDateTime(value: string | null): string {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

export function ReminderHealthCard({
  health,
  loading,
}: {
  health: ReminderHealth | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900">Reminder Health</h2>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading ? (
          <div className="py-2">
            <Spinner size="sm" />
          </div>
        ) : !health ? (
          <p className="text-slate-500">Reminder health is currently unavailable.</p>
        ) : (
          <>
            <p className="text-xs text-slate-600">
              Timezone: <span className="font-medium">{health.timezone || 'Not configured'}</span>
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-700">
              {health.lastRun?.status === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              ) : health.lastRun?.status === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-amber-600" />
              )}
              Last run: {formatDateTime(health.lastRun?.finishedAt || health.lastRun?.startedAt || null)}
            </div>
            <p className="text-xs text-slate-600">
              7d runs: {health.recent7d.totalRuns} total, {health.recent7d.failedRuns} failed,{' '}
              {health.recent7d.emailFailureCount} delivery failures.
            </p>
            <p className="text-xs text-amber-700">
              Reminder delivery is supplemental only; admins remain responsible for final compliance verification.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

