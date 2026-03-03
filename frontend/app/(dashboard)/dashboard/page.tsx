'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import {
  ArrowRight,
  AlertCircle,
  FolderOpen,
  ClipboardList,
  UserPlus,
  CheckCircle2,
  Circle,
  X,
} from 'lucide-react';
import { Spinner, Badge, Card, CardHeader, CardContent } from '@/components/ui';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { UpcomingExpirations } from '@/components/dashboard/upcoming-expirations';
import { ComplianceDisclaimer } from '@/components/dashboard/compliance-disclaimer';
import { ReminderHealthCard } from '@/components/dashboard/reminder-health-card';
import {
  fetchStats,
  fetchClinicians,
  fetchReminderHealth,
  type ClinicianStats,
  type ClinicianWithProgress,
  type ReminderHealth,
} from '@/lib/api/admin';
import { fetchOrgDocumentCount } from '@/lib/api/org-documents';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardOverview() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<ClinicianStats | null>(null);
  const [recent, setRecent] = useState<ClinicianWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgDocCount, setOrgDocCount] = useState(0);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [reminderHealth, setReminderHealth] = useState<ReminderHealth | null>(null);
  const [reminderHealthLoading, setReminderHealthLoading] = useState(true);

  useEffect(() => {
    // Check if guide was dismissed
    if (typeof window !== 'undefined' && localStorage.getItem('credentis-setup-guide-dismissed')) {
      setGuideDismissed(true);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const [statsData, recentData, docCount, reminderHealthData] = await Promise.all([
          fetchStats(token),
          fetchClinicians(token, { limit: 5 }),
          fetchOrgDocumentCount(token).catch(() => 0),
          fetchReminderHealth(token).catch(() => null),
        ]);
        setStats(statsData);
        setRecent(recentData.clinicians);
        setOrgDocCount(docCount);
        setReminderHealth(reminderHealthData);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
        setReminderHealthLoading(false);
      }
    }
    load();
  }, [getToken]);

  function dismissGuide() {
    localStorage.setItem('credentis-setup-guide-dismissed', 'true');
    setGuideDismissed(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
        <p className="text-sm text-slate-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Overview of clinician onboarding and compliance status.
        </p>
      </div>

      <ComplianceDisclaimer />
      {reminderHealth && (
        <p className="text-xs text-slate-500">
          All date/timestamp operations are configured for timezone:{' '}
          <span className="font-medium">{reminderHealth.timezone || 'Not configured'}</span>
        </p>
      )}

      {/* Setup Guide — show for new orgs */}
      {stats && !guideDismissed && stats.total === 0 && (
        <Card className="border-primary-200 bg-gradient-to-r from-primary-50 to-white">
          <CardContent className="py-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Welcome to Credentis — Let&apos;s get you set up!
                </h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  Follow these steps to start onboarding your clinicians.
                </p>
              </div>
              <button
                onClick={dismissGuide}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Dismiss guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              {/* Step 1 */}
              <Link
                href="/dashboard/documents"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/80 transition group"
              >
                {orgDocCount > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                )}
                <FolderOpen className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${orgDocCount > 0 ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    Upload your documents
                  </p>
                  <p className="text-xs text-slate-400">
                    Upload contracts, I-9 forms, W-9 forms, policies, and other onboarding documents
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition shrink-0" />
              </Link>

              {/* Step 2 */}
              <Link
                href="/dashboard/templates"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/80 transition group"
              >
                <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                <ClipboardList className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Configure your checklist template
                  </p>
                  <p className="text-xs text-slate-400">
                    Customize items and link documents your clinicians need to complete
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition shrink-0" />
              </Link>

              {/* Step 3 */}
              <Link
                href="/dashboard/clinicians/new"
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/80 transition group"
              >
                <Circle className="h-5 w-5 text-slate-300 shrink-0" />
                <UserPlus className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Invite your first clinician
                  </p>
                  <p className="text-xs text-slate-400">
                    Send an onboarding invite so they can complete their checklist
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary-500 transition shrink-0" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && <KPICards stats={stats} />}

      <ReminderHealthCard
        health={reminderHealth}
        loading={reminderHealthLoading}
      />

      {/* Upcoming Expirations */}
      <div data-tour="upcoming-expirations">
        <UpcomingExpirations limit={10} />
      </div>

      {/* Recent clinicians */}
      <div data-tour="recent-clinicians">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Clinicians
          </h2>
          <Link
            href="/dashboard/clinicians"
            className="text-xs text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">
              No clinicians yet.{' '}
              <Link
                href="/dashboard/clinicians/new"
                className="text-primary-600 hover:underline"
              >
                Add one
              </Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium hidden sm:table-cell">Discipline</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-right">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recent.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/clinicians/${c.id}`}
                        className="font-medium text-slate-900 hover:text-primary-600"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                      <p className="text-xs text-slate-400 sm:hidden">{c.discipline}</p>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell text-slate-600">
                      {c.discipline}
                    </td>
                    <td className="px-5 py-3">
                      <div className="space-y-1">
                        <Badge status={c.systemStatus || c.status}>
                          {formatStatus(c.systemStatus || c.status)}
                        </Badge>
                        <Badge
                          variant={
                            c.assignmentEligible
                              ? 'success'
                              : 'warning'
                          }
                        >
                          {c.assignmentEligible ? 'Assignment Eligible' : 'Not Assignment Eligible'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-slate-700">
                      {c.progress.percentage}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
