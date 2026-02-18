'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent, Spinner, Badge, Button } from '@/components/ui';
import { fetchAuditLogs, type AuditLog } from '@/lib/api/admin';

const PAGE_SIZE = 25;

function formatAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

export default function AuditLogsPage() {
  const { getToken } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const data = await fetchAuditLogs(token, {
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(data);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Track all actions across your organization.
        </p>
      </div>

      {error ? (
        <Card className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
          <p className="text-sm text-slate-600">{error}</p>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">No audit logs found.</p>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-slate-100">
              {logs.map((log) => (
                <li key={log.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {formatAction(log.action)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="neutral">{log.entityType}</Badge>
                        {log.actorUser && (
                          <span className="text-xs text-slate-500">
                            by {log.actorUser.name || log.actorUser.email}
                          </span>
                        )}
                        {log.clinician && (
                          <span className="text-xs text-slate-500">
                            &middot; {log.clinician.firstName} {log.clinician.lastName}
                          </span>
                        )}
                      </div>
                      {log.detailsJson && (
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          {JSON.stringify(log.detailsJson).slice(0, 120)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {(page > 0 || hasMore) && (
        <div className="flex justify-between">
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
