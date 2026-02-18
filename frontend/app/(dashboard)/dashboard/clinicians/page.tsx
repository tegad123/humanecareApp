'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import { Plus, Search, AlertCircle } from 'lucide-react';
import { Button, Badge, Card, CardContent, Spinner, ProgressBar } from '@/components/ui';
import {
  fetchClinicians,
  type ClinicianWithProgress,
} from '@/lib/api/admin';

const DISCIPLINES = ['PT', 'OT', 'SLP', 'MSW', 'PTA', 'COTA', 'RN', 'LVN'];
const STATUSES = ['onboarding', 'ready', 'not_ready', 'inactive'];
const PAGE_SIZE = 20;

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CliniciansListPage() {
  const { getToken } = useAuth();
  const [clinicians, setClinicians] = useState<ClinicianWithProgress[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await fetchClinicians(token, {
        search: search || undefined,
        status: statusFilter || undefined,
        discipline: disciplineFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setClinicians(data.clinicians);
      setTotal(data.total);
    } catch (err: any) {
      setError(err.message || 'Failed to load clinicians');
    } finally {
      setLoading(false);
    }
  }, [getToken, search, statusFilter, disciplineFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [search, statusFilter, disciplineFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clinicians</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} clinician{total !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link href="/dashboard/clinicians/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add Clinician
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>

        {/* Discipline filter */}
        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All Disciplines</option>
          {DISCIPLINES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {error ? (
        <Card className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : clinicians.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-slate-500">No clinicians found.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Discipline</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">Progress</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Recruiter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {clinicians.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/clinicians/${c.id}`}
                        className="font-medium text-slate-900 hover:text-primary-600"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                      <p className="text-xs text-slate-400">{c.email}</p>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell text-slate-600">
                      {c.discipline}
                    </td>
                    <td className="px-5 py-3">
                      <Badge status={c.status}>{formatStatus(c.status)}</Badge>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <ProgressBar value={c.progress.percentage} className="flex-1" />
                        <span className="text-xs font-medium text-slate-600 w-8 text-right">
                          {c.progress.percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell text-slate-500 text-xs">
                      {c.assignedRecruiter?.name || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
