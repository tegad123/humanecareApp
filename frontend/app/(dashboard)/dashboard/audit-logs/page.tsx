'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  FileText,
  AlertCircle,
  Search,
  ChevronDown,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Card, CardContent, Spinner, Badge, Button, Input } from '@/components/ui';
import { fetchAuditLogs, type AuditLog } from '@/lib/api/admin';

const PAGE_SIZE = 25;

const ACTION_FILTERS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'review', label: 'Review' },
  { value: 'invite', label: 'Invite' },
  { value: 'override', label: 'Override' },
  { value: 'submit', label: 'Submit' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
];

function formatAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatExactTimestamp(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDetailsJson(json: Record<string, any>): string {
  try {
    return JSON.stringify(json, null, 2);
  } catch {
    return String(json);
  }
}

function exportCsv(logs: AuditLog[]) {
  const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity ID', 'Actor', 'Actor Role', 'Clinician', 'Details'];
  const rows = logs.map((log) => [
    new Date(log.createdAt).toISOString(),
    log.action,
    log.entityType,
    log.entityId,
    log.actorUser?.name || log.actorUser?.email || '',
    log.actorUser?.role || '',
    log.clinician ? `${log.clinician.firstName} ${log.clinician.lastName}` : '',
    log.detailsJson ? JSON.stringify(log.detailsJson) : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const { getToken } = useAuth();
  const [allLogs, setAllLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await fetchAuditLogs(token, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setAllLogs(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [getToken, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Client-side filtering on the current page of results
  const filteredLogs = useMemo(() => {
    let result = allLogs;

    if (actionFilter) {
      result = result.filter((log) =>
        log.action.toLowerCase().includes(actionFilter.toLowerCase())
      );
    }

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(
        (log) =>
          log.action.toLowerCase().includes(q) ||
          log.entityType.toLowerCase().includes(q) ||
          (log.actorUser?.name || '').toLowerCase().includes(q) ||
          (log.actorUser?.email || '').toLowerCase().includes(q) ||
          (log.clinician
            ? `${log.clinician.firstName} ${log.clinician.lastName}`
                .toLowerCase()
                .includes(q)
            : false) ||
          (log.detailsJson
            ? JSON.stringify(log.detailsJson).toLowerCase().includes(q)
            : false)
      );
    }

    return result;
  }, [allLogs, actionFilter, debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track all actions across your organization.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => exportCsv(filteredLogs)}
          disabled={filteredLogs.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs by action, user, clinician..."
            className="block w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-primary-400 focus:ring-1 focus:ring-primary-400"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white min-w-[160px]"
        >
          {ACTION_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div data-tour="audit-log-list">
        {error ? (
          <Card className="p-6 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
            <p className="text-sm text-slate-600">{error}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={load}>
              Try Again
            </Button>
          </Card>
        ) : loading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm text-slate-500">
              {allLogs.length === 0
                ? 'No audit logs found.'
                : 'No logs match your current filters.'}
            </p>
            {(actionFilter || debouncedSearch) && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setSearchQuery('');
                  setActionFilter('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-slate-100">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLog === log.id;
                  return (
                    <li key={log.id} className="px-5 py-3">
                      <div
                        className="flex items-start justify-between gap-4 cursor-pointer"
                        onClick={() =>
                          setExpandedLog(isExpanded ? null : log.id)
                        }
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            )}
                            <p className="text-sm font-medium text-slate-900">
                              {formatAction(log.action)}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1 ml-5.5">
                            <Badge variant="neutral">{log.entityType}</Badge>
                            {log.actorUser && (
                              <span className="text-xs text-slate-500">
                                by {log.actorUser.name || log.actorUser.email}
                                {log.actorUser.role && (
                                  <span className="text-slate-400">
                                    {' '}({log.actorUser.role})
                                  </span>
                                )}
                              </span>
                            )}
                            {log.clinician && (
                              <span className="text-xs text-slate-500">
                                &middot; {log.clinician.firstName}{' '}
                                {log.clinician.lastName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-xs font-medium text-slate-600 block">
                            {formatExactTimestamp(log.createdAt)}
                          </span>
                          <span className="text-xs text-slate-400">
                            {timeAgo(log.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="mt-3 ml-5.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                            <div>
                              <span className="font-medium text-slate-500">
                                Entity ID
                              </span>
                              <p className="text-slate-700 font-mono mt-0.5">
                                {log.entityId}
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-slate-500">
                                Timestamp (ISO)
                              </span>
                              <p className="text-slate-700 font-mono mt-0.5">
                                {new Date(log.createdAt).toISOString()}
                              </p>
                            </div>
                          </div>
                          {log.detailsJson && (
                            <div>
                              <span className="text-xs font-medium text-slate-500">
                                Details
                              </span>
                              <pre className="mt-1 p-2 rounded bg-white border border-slate-200 text-xs text-slate-700 overflow-x-auto max-h-60 whitespace-pre-wrap break-words">
                                {formatDetailsJson(log.detailsJson)}
                              </pre>
                            </div>
                          )}
                          {!log.detailsJson && (
                            <p className="text-xs text-slate-400 italic">
                              No additional details recorded.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">Page {page + 1}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
