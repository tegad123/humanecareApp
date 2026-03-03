'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  AlertCircle,
  Clock3,
  Download,
  FileArchive,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, Input, Spinner } from '@/components/ui';
import { ComplianceDisclaimer } from '@/components/dashboard/compliance-disclaimer';
import { clientApiFetch } from '@/lib/api-client';
import { fetchSubscription, type SubscriptionInfo } from '@/lib/api/billing';
import {
  acceptPolicyDocument,
  createCorrectiveAction,
  createLegalHold,
  createOrgExport,
  fetchPolicyDocuments,
  fetchQapiSummary,
  fetchQapiTrends,
  fetchRetentionHealth,
  getOrgExport,
  listCorrectiveActions,
  listLegalHolds,
  listOrgExports,
  releaseLegalHold,
  updateCorrectiveAction,
  type CorrectiveAction,
  type LegalHold,
  type OrganizationExportJob,
  type PolicyDocument,
  type QapiSummary,
  type QapiTrends,
  type RetentionHealth,
} from '@/lib/api/exports';

function formatDateTime(value?: string | null) {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString();
}

function isComplianceManager(role: string) {
  return ['super_admin', 'admin', 'compliance'].includes(role);
}

function canReadBillingState(role: string) {
  return ['super_admin', 'admin'].includes(role);
}

export default function ComplianceCenterPage() {
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [role, setRole] = useState<string>('');
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [days, setDays] = useState(90);

  const [policyDocs, setPolicyDocs] = useState<PolicyDocument[]>([]);
  const [policyAccepting, setPolicyAccepting] = useState<string | null>(null);

  const [exportJobs, setExportJobs] = useState<OrganizationExportJob[]>([]);
  const [creatingExport, setCreatingExport] = useState(false);
  const [refreshingExportId, setRefreshingExportId] = useState<string | null>(null);

  const [legalHolds, setLegalHolds] = useState<LegalHold[]>([]);
  const [creatingHold, setCreatingHold] = useState(false);
  const [newHoldReason, setNewHoldReason] = useState('');
  const [newHoldCaseReference, setNewHoldCaseReference] = useState('');

  const [qapiSummary, setQapiSummary] = useState<QapiSummary | null>(null);
  const [qapiTrends, setQapiTrends] = useState<QapiTrends | null>(null);
  const [retentionHealth, setRetentionHealth] = useState<RetentionHealth | null>(null);

  const [correctiveActions, setCorrectiveActions] = useState<CorrectiveAction[]>([]);
  const [creatingAction, setCreatingAction] = useState(false);
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionDueDate, setNewActionDueDate] = useState('');
  const [updatingActionId, setUpdatingActionId] = useState<string | null>(null);

  const canManage = useMemo(() => isComplianceManager(role), [role]);

  const loadComplianceData = useCallback(
    async (token: string | null, roleValue: string, rangeDays: number) => {
      const promises: Promise<unknown>[] = [
        fetchPolicyDocuments(token).then((resp) => setPolicyDocs(resp.documents)),
      ];

      if (isComplianceManager(roleValue)) {
        promises.push(
          listOrgExports(token).then((jobs) => setExportJobs(jobs)),
          listLegalHolds(token).then((holds) => setLegalHolds(holds)),
          fetchQapiSummary(token, rangeDays).then((summary) => setQapiSummary(summary)),
          fetchQapiTrends(token, rangeDays).then((trends) => setQapiTrends(trends)),
          listCorrectiveActions(token).then((actions) => setCorrectiveActions(actions)),
          fetchRetentionHealth(token).then((health) => setRetentionHealth(health)),
        );
      } else {
        setExportJobs([]);
        setLegalHolds([]);
        setQapiSummary(null);
        setQapiTrends(null);
        setCorrectiveActions([]);
        setRetentionHealth(null);
      }

      if (canReadBillingState(roleValue)) {
        promises.push(
          fetchSubscription(token)
            .then((sub) => setSubscription(sub))
            .catch(() => setSubscription(null)),
        );
      } else {
        setSubscription(null);
      }

      await Promise.all(promises);
    },
    [],
  );

  const load = useCallback(
    async (rangeDays = days) => {
      setError(null);
      setLoading(true);
      try {
        const token = await getToken();
        const me = await clientApiFetch<{ role: string }>('/users/me', token);
        setRole(me.role);
        await loadComplianceData(token, me.role, rangeDays);
      } catch (err: any) {
        setError(err.message || 'Failed to load compliance center');
      } finally {
        setLoading(false);
      }
    },
    [days, getToken, loadComplianceData],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreateExport() {
    setCreatingExport(true);
    setError(null);
    try {
      const token = await getToken();
      await createOrgExport(token);
      setExportJobs(await listOrgExports(token));
    } catch (err: any) {
      setError(err.message || 'Failed to create organization export');
    } finally {
      setCreatingExport(false);
    }
  }

  async function handleRefreshExportJob(exportId: string) {
    setRefreshingExportId(exportId);
    setError(null);
    try {
      const token = await getToken();
      const updated = await getOrgExport(token, exportId);
      setExportJobs((previous) =>
        previous.map((job) => (job.id === exportId ? { ...job, ...updated } : job)),
      );
      if (updated.downloadUrl) {
        window.open(updated.downloadUrl, '_blank');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh export status');
    } finally {
      setRefreshingExportId(null);
    }
  }

  async function handleCreateLegalHold() {
    if (!newHoldReason.trim()) {
      setError('Legal hold reason is required.');
      return;
    }
    setCreatingHold(true);
    setError(null);
    try {
      const token = await getToken();
      await createLegalHold(token, {
        reason: newHoldReason.trim(),
        caseReference: newHoldCaseReference.trim() || undefined,
      });
      setNewHoldReason('');
      setNewHoldCaseReference('');
      setLegalHolds(await listLegalHolds(token));
    } catch (err: any) {
      setError(err.message || 'Failed to create legal hold');
    } finally {
      setCreatingHold(false);
    }
  }

  async function handleReleaseLegalHold(legalHoldId: string) {
    setError(null);
    try {
      const token = await getToken();
      await releaseLegalHold(token, legalHoldId);
      setLegalHolds(await listLegalHolds(token));
    } catch (err: any) {
      setError(err.message || 'Failed to release legal hold');
    }
  }

  async function handleDaysChange(nextDays: number) {
    setDays(nextDays);
    setError(null);
    try {
      const token = await getToken();
      const [summary, trends] = await Promise.all([
        fetchQapiSummary(token, nextDays),
        fetchQapiTrends(token, nextDays),
      ]);
      setQapiSummary(summary);
      setQapiTrends(trends);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh QAPI analytics');
    }
  }

  async function handleCreateCorrectiveAction() {
    if (!newActionTitle.trim()) {
      setError('Corrective action title is required.');
      return;
    }
    setCreatingAction(true);
    setError(null);
    try {
      const token = await getToken();
      await createCorrectiveAction(token, {
        title: newActionTitle.trim(),
        description: newActionDescription.trim() || undefined,
        dueDate: newActionDueDate
          ? new Date(`${newActionDueDate}T00:00:00`).toISOString()
          : undefined,
      });
      setNewActionTitle('');
      setNewActionDescription('');
      setNewActionDueDate('');
      setCorrectiveActions(await listCorrectiveActions(token));
    } catch (err: any) {
      setError(err.message || 'Failed to create corrective action');
    } finally {
      setCreatingAction(false);
    }
  }

  async function handleToggleCorrectiveAction(action: CorrectiveAction) {
    setUpdatingActionId(action.id);
    setError(null);
    try {
      const token = await getToken();
      const isClosing = action.status === 'open';
      await updateCorrectiveAction(token, action.id, {
        status: isClosing ? 'closed' : 'open',
        closureDate: isClosing ? new Date().toISOString() : null,
      });
      setCorrectiveActions(await listCorrectiveActions(token));
    } catch (err: any) {
      setError(err.message || 'Failed to update corrective action');
    } finally {
      setUpdatingActionId(null);
    }
  }

  async function handleAcceptPolicy(documentType: 'terms' | 'privacy' | 'baa', version: string) {
    setPolicyAccepting(documentType);
    setError(null);
    try {
      const token = await getToken();
      await acceptPolicyDocument(token, {
        documentType,
        documentVersion: version,
      });
      const latest = await fetchPolicyDocuments(token);
      setPolicyDocs(latest.documents);
    } catch (err: any) {
      setError(err.message || 'Failed to record policy acceptance');
    } finally {
      setPolicyAccepting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Compliance Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Legal hold controls, audit exports, and QAPI reporting for compliance operations.
        </p>
      </div>

      <ComplianceDisclaimer />

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {subscription && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Billing Access Continuity</h2>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={subscription.accessMode === 'active' ? 'success' : 'warning'}>
                Access Mode: {subscription.accessMode.replace('_', ' ').toUpperCase()}
              </Badge>
              <span className="text-sm text-slate-600">
                Grace Period Ends: {formatDateTime(subscription.gracePeriodEndsAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {retentionHealth && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Retention and Access Automation</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="info">
                Retention Days: {retentionHealth.retentionDays ?? 'N/A'}
              </Badge>
              <Badge variant={retentionHealth.activeLegalHolds > 0 ? 'warning' : 'success'}>
                Active Legal Holds: {retentionHealth.activeLegalHolds}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              Last retention cleanup:{' '}
              {retentionHealth.retentionCleanupLastRun
                ? formatDateTime(retentionHealth.retentionCleanupLastRun.finishedAt)
                : 'Never'}
              . Last access mode transition run:{' '}
              {retentionHealth.accessModeTransitionLastRun
                ? formatDateTime(retentionHealth.accessModeTransitionLastRun.finishedAt)
                : 'Never'}
              .
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900">Terms, Privacy, and BAA Acknowledgement</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {policyDocs.map((doc) => (
            <div
              key={doc.documentType}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{doc.title}</p>
                  <p className="text-xs text-slate-500 mt-1">{doc.summary}</p>
                </div>
                <Button
                  size="sm"
                  variant={doc.isCurrentVersionAcceptedByUser ? 'secondary' : 'primary'}
                  loading={policyAccepting === doc.documentType}
                  onClick={() => handleAcceptPolicy(doc.documentType, doc.currentVersion)}
                >
                  {doc.isCurrentVersionAcceptedByUser ? 'Re-acknowledge' : 'Accept'}
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Badge variant="info">Current: {doc.currentVersion}</Badge>
                <Badge variant={doc.isCurrentVersionAcceptedByUser ? 'success' : 'warning'}>
                  You: {doc.userAcceptedVersion || 'Not accepted'}
                </Badge>
                <Badge variant="neutral">Org Latest: {doc.orgAcceptedVersion || 'None'}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Your accepted at: {formatDateTime(doc.userAcceptedAt)}. Org latest acceptance:{' '}
                {formatDateTime(doc.orgAcceptedAt)}.
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {!canManage && (
        <Card>
          <CardContent className="py-5">
            <p className="text-sm text-slate-600">
              Your role can acknowledge policies, but only Admin, Super Admin, and Compliance roles
              can manage legal holds, exports, and QAPI controls.
            </p>
          </CardContent>
        </Card>
      )}

      {canManage && (
        <>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Organization Record Export</h2>
                <Button size="sm" onClick={handleCreateExport} loading={creatingExport}>
                  <FileArchive className="h-4 w-4" />
                  Generate Export
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {exportJobs.length === 0 && (
                  <p className="text-sm text-slate-500">No export jobs yet.</p>
                )}
                {exportJobs.map((job) => (
                  <div
                    key={job.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            job.status === 'completed'
                              ? 'success'
                              : job.status === 'failed'
                                ? 'danger'
                                : 'warning'
                          }
                        >
                          {job.status.toUpperCase()}
                        </Badge>
                        <span className="text-slate-600">
                          Requested {formatDateTime(job.requestedAt)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={refreshingExportId === job.id}
                        onClick={() => handleRefreshExportJob(job.id)}
                      >
                        <Download className="h-4 w-4" />
                        {job.status === 'completed' ? 'Download' : 'Refresh'}
                      </Button>
                    </div>
                    {job.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">{job.errorMessage}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-900">Legal Holds</h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  label="Reason"
                  value={newHoldReason}
                  onChange={(e) => setNewHoldReason(e.target.value)}
                  placeholder="Litigation, audit, payer dispute, etc."
                />
                <Input
                  label="Case Reference (Optional)"
                  value={newHoldCaseReference}
                  onChange={(e) => setNewHoldCaseReference(e.target.value)}
                  placeholder="Case or matter number"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={handleCreateLegalHold} loading={creatingHold}>
                    Create Legal Hold
                  </Button>
                </div>

                <div className="space-y-2">
                  {legalHolds.length === 0 && (
                    <p className="text-sm text-slate-500">No legal holds recorded.</p>
                  )}
                  {legalHolds.map((hold) => (
                    <div
                      key={hold.id}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{hold.reason}</p>
                          <p className="text-xs text-slate-500">
                            Created {formatDateTime(hold.createdAt)} | Case:{' '}
                            {hold.caseReference || 'N/A'}
                          </p>
                        </div>
                        {hold.active ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleReleaseLegalHold(hold.id)}
                          >
                            Release
                          </Button>
                        ) : (
                          <Badge variant="neutral">Released</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">QAPI Summary</h2>
                <select
                  value={days}
                  onChange={(e) => handleDaysChange(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                >
                  <option value={30}>Last 30 days</option>
                  <option value={60}>Last 60 days</option>
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                </select>
              </CardHeader>
              <CardContent>
                {!qapiSummary ? (
                  <p className="text-sm text-slate-500">No QAPI summary data available.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <MetricTile label="Overrides" value={qapiSummary.totals.overrides} />
                    <MetricTile label="Rejections" value={qapiSummary.totals.rejections} />
                    <MetricTile label="Late Renewals" value={qapiSummary.totals.lateRenewals} />
                    <MetricTile label="Discrepancies" value={qapiSummary.totals.discrepancies} />
                    <MetricTile
                      label="Corrective Open"
                      value={qapiSummary.totals.correctiveActionsOpen}
                    />
                    <MetricTile
                      label="Corrective Closed"
                      value={qapiSummary.totals.correctiveActionsClosed}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold text-slate-900">QAPI Trends</h2>
              </CardHeader>
              <CardContent className="space-y-2">
                {!qapiTrends || qapiTrends.points.length === 0 ? (
                  <p className="text-sm text-slate-500">No trend data available.</p>
                ) : (
                  qapiTrends.points.slice(-10).map((point) => (
                    <div
                      key={point.day}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-3 w-3 text-slate-400" />
                        <span className="text-slate-600">{point.day}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning">Overrides {point.overrides}</Badge>
                        <Badge variant="danger">Rejects {point.rejections}</Badge>
                        <Badge variant="info">Late {point.lateRenewals}</Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Corrective Actions</h2>
              <ShieldCheck className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  label="Title"
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  placeholder="Missing annual TB test trend"
                />
                <Input
                  label="Due Date (Optional)"
                  type="date"
                  value={newActionDueDate}
                  onChange={(e) => setNewActionDueDate(e.target.value)}
                />
                <div className="flex items-end justify-end">
                  <Button
                    size="sm"
                    onClick={handleCreateCorrectiveAction}
                    loading={creatingAction}
                  >
                    Add Corrective Action
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Description (Optional)</label>
                <textarea
                  value={newActionDescription}
                  onChange={(e) => setNewActionDescription(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Planned remediation and validation approach"
                />
              </div>

              <div className="space-y-2">
                {correctiveActions.length === 0 && (
                  <p className="text-sm text-slate-500">No corrective actions logged.</p>
                )}
                {correctiveActions.map((action) => (
                  <div
                    key={action.id}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">{action.title}</p>
                        {action.description && (
                          <p className="text-xs text-slate-600 mt-1">{action.description}</p>
                        )}
                        <p className="text-xs text-slate-500 mt-1">
                          Due: {formatDateTime(action.dueDate)} | Closed:{' '}
                          {formatDateTime(action.closureDate)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={action.status === 'open' ? 'secondary' : 'primary'}
                        loading={updatingActionId === action.id}
                        onClick={() => handleToggleCorrectiveAction(action)}
                      >
                        {action.status === 'open' ? 'Mark Closed' : 'Reopen'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900 mt-1">{value}</div>
    </div>
  );
}
