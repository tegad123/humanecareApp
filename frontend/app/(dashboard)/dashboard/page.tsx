'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Spinner, Badge, Card, CardHeader, CardContent } from '@/components/ui';
import { KPICards } from '@/components/dashboard/kpi-cards';
import { UpcomingExpirations } from '@/components/dashboard/upcoming-expirations';
import {
  fetchStats,
  fetchClinicians,
  type ClinicianStats,
  type ClinicianWithProgress,
} from '@/lib/api/admin';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DashboardOverview() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<ClinicianStats | null>(null);
  const [recent, setRecent] = useState<ClinicianWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const [statsData, recentData] = await Promise.all([
          fetchStats(token),
          fetchClinicians(token, { limit: 5 }),
        ]);
        setStats(statsData);
        setRecent(recentData.clinicians);
      } catch (err: any) {
        setError(err.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [getToken]);

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

      {stats && <KPICards stats={stats} />}

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
                      <Badge status={c.status}>{formatStatus(c.status)}</Badge>
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
