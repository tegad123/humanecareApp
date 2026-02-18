'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { Badge, Card, ProgressBar, Spinner } from '@/components/ui';
import {
  fetchMyChecklist,
  fetchMyProgress,
  type ChecklistItem,
  type ClinicianProgress,
} from '@/lib/api/clinicians';

type FilterType = 'all' | 'required' | 'needs_action';

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusIcon(status: string) {
  switch (status) {
    case 'approved':
      return <CheckCircle2 className="h-4 w-4 text-success-600" />;
    case 'rejected':
      return <AlertCircle className="h-4 w-4 text-danger-600" />;
    case 'submitted':
    case 'pending_review':
      return <Clock className="h-4 w-4 text-warning-500" />;
    default:
      return <FileText className="h-4 w-4 text-slate-400" />;
  }
}

export default function ChecklistPage() {
  const { getToken } = useAuth();
  const [sections, setSections] = useState<Record<string, ChecklistItem[]>>({});
  const [progress, setProgress] = useState<ClinicianProgress | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const [checklist, prog] = await Promise.all([
          fetchMyChecklist(token),
          fetchMyProgress(token),
        ]);
        setSections(checklist.sections);
        setProgress(prog);
      } catch (err: any) {
        setError(err.message || 'Failed to load checklist');
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

  const filterItems = (items: ChecklistItem[]): ChecklistItem[] => {
    if (filter === 'required') return items.filter((i) => i.itemDefinition.required);
    if (filter === 'needs_action')
      return items.filter(
        (i) => i.status === 'not_started' || i.status === 'rejected',
      );
    return items;
  };

  const sectionEntries = Object.entries(sections);

  return (
    <div className="space-y-6">
      {/* Progress header */}
      {progress && (
        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                My Checklist
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {progress.completed} of {progress.total} items complete
              </p>
            </div>
            <span className="text-2xl font-bold text-primary-600">
              {progress.percentage}%
            </span>
          </div>
          <ProgressBar value={progress.percentage} />

          {/* Quick stats */}
          <div className="flex gap-3 text-xs">
            {progress.submitted > 0 && (
              <span className="text-warning-700">
                {progress.submitted} pending review
              </span>
            )}
            {progress.rejected > 0 && (
              <span className="text-danger-600">
                {progress.rejected} needs fix
              </span>
            )}
            {progress.expired > 0 && (
              <span className="text-danger-700">
                {progress.expired} expired
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filter pills */}
      <div className="flex gap-2">
        {(['all', 'required', 'needs_action'] as FilterType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'all' ? 'All' : f === 'required' ? 'Required' : 'Needs Action'}
          </button>
        ))}
      </div>

      {/* Sections */}
      {sectionEntries.map(([section, items]) => {
        const filtered = filterItems(items);
        if (filtered.length === 0) return null;
        return (
          <div key={section}>
            <h2 className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">
              {section}
            </h2>
            <Card>
              <ul className="divide-y divide-slate-100">
                {filtered
                  .sort((a, b) => a.itemDefinition.sortOrder - b.itemDefinition.sortOrder)
                  .map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/checklist/${item.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition"
                      >
                        {statusIcon(item.status)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {item.itemDefinition.label}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge status={item.status}>
                              {formatStatus(item.status)}
                            </Badge>
                            {item.itemDefinition.required && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                REQUIRED
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
