'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Mail,
  Phone,
  Stethoscope,
  Hash,
  MapPin,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileText,
  Download,
  FolderDown,
  Eye,
  PenTool,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardContent,
  Modal,
  ProgressBar,
  Spinner,
} from '@/components/ui';
import { ReviewModal } from '@/components/dashboard/review-modal';
import { InternalNotes } from '@/components/dashboard/internal-notes';
import { OverridePanel } from '@/components/dashboard/override-panel';
import { ExpirationIndicator } from '@/components/dashboard/expiration-indicator';
import {
  fetchClinician,
  fetchClinicianChecklist,
  fetchClinicianProgress,
  fetchNotes,
  reviewChecklistItem,
  resendClinicianInvite,
  fetchClinicianFiles,
  type ClinicianWithProgress,
  type ChecklistItem,
  type ClinicianProgress,
  type InternalNote,
} from '@/lib/api/admin';
import { getDownloadUrl } from '@/lib/api/clinicians';
import JSZip from 'jszip';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

export default function ClinicianDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();

  const [clinician, setClinician] = useState<ClinicianWithProgress | null>(null);
  const [sections, setSections] = useState<Record<string, ChecklistItem[]>>({});
  const [progress, setProgress] = useState<ClinicianProgress | null>(null);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review modal
  const [reviewItem, setReviewItem] = useState<ChecklistItem | null>(null);

  // Resend invite
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Download all files
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleResendInvite = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
      const token = await getToken();
      await resendClinicianInvite(token, id);
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to resend invite');
    } finally {
      setResending(false);
    }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    setError(null);
    try {
      const token = await getToken();
      const { clinicianName, files } = await fetchClinicianFiles(token, id);

      if (files.length === 0) {
        setError('No files to download for this clinician.');
        setDownloadingAll(false);
        return;
      }

      const zip = new JSZip();

      // Fetch all files in parallel and add to ZIP
      await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetch(file.downloadUrl);
            const blob = await res.blob();
            // Organize by section folder, use label + original filename
            const safeName = file.fileName.replace(/[/\\?%*:|"<>]/g, '_');
            const safeSection = file.section.replace(/[/\\?%*:|"<>]/g, '_');
            zip.file(`${safeSection}/${file.label} - ${safeName}`, blob);
          } catch {
            // Skip files that fail to download
          }
        }),
      );

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const safeName = clinicianName.replace(/\s+/g, '_');
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}_files.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to download files');
    } finally {
      setDownloadingAll(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const [cData, checklist, prog, notesData] = await Promise.all([
        fetchClinician(token, id),
        fetchClinicianChecklist(token, id),
        fetchClinicianProgress(token, id),
        fetchNotes(token, id),
      ]);
      setClinician(cData);
      setSections(checklist.sections);
      setProgress(prog);
      setNotes(notesData);
    } catch (err: any) {
      setError(err.message || 'Failed to load clinician');
    } finally {
      setLoading(false);
    }
  }, [id, getToken]);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async () => {
    if (!reviewItem) return;
    const token = await getToken();
    await reviewChecklistItem(token, reviewItem.id, { status: 'approved' });
    setReviewItem(null);
    load(); // Refresh
  };

  const handleReject = async (reason: string, comment: string) => {
    if (!reviewItem) return;
    const token = await getToken();
    await reviewChecklistItem(token, reviewItem.id, {
      status: 'rejected',
      rejectionReason: reason,
      rejectionComment: comment,
    });
    setReviewItem(null);
    load(); // Refresh
  };

  // Preview modal state
  const [previewItem, setPreviewItem] = useState<ChecklistItem | null>(null);

  const handleDownload = async (key: string) => {
    try {
      const token = await getToken();
      const { url } = await getDownloadUrl(token, key);
      window.open(url, '_blank');
    } catch {
      setError('Failed to download document. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !clinician) {
    return (
      <Card className="p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-danger-600 mb-2" />
        <p className="text-sm text-slate-600">{error || 'Clinician not found'}</p>
      </Card>
    );
  }

  const sectionEntries = Object.entries(sections);

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/dashboard/clinicians"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Clinicians
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600 text-lg font-semibold">
            {clinician.firstName[0]}
            {clinician.lastName[0]}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {clinician.firstName} {clinician.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge status={clinician.status}>
                {formatStatus(clinician.status)}
              </Badge>
              <span className="text-sm text-slate-500">{clinician.discipline}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Download All Files */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleDownloadAll}
            loading={downloadingAll}
          >
            <FolderDown className="h-4 w-4" />
            {downloadingAll ? 'Zipping...' : 'Download All Files'}
          </Button>

          {/* Resend Invite — show only if clinician hasn't accepted yet */}
          {!clinician.clerkUserId && (
            <>
              {resendSuccess && (
                <span className="text-xs text-success-600 font-medium">Invite sent!</span>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResendInvite}
                loading={resending}
              >
                <Mail className="h-4 w-4" />
                Resend Invite
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Override panel */}
      <OverridePanel clinician={clinician} onOverrideChanged={load} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — Profile + Notes */}
        <div className="space-y-6">
          {/* Profile card */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow icon={Mail} label="Email" value={clinician.email} />
              <InfoRow icon={Phone} label="Phone" value={clinician.phone} />
              <InfoRow icon={Stethoscope} label="Discipline" value={clinician.discipline} />
              <InfoRow icon={Hash} label="NPI" value={clinician.npi} />
              <InfoRow icon={MapPin} label="Coverage" value={clinician.coverageArea} />
              {clinician.assignedRecruiter && (
                <InfoRow
                  icon={Mail}
                  label="Recruiter"
                  value={clinician.assignedRecruiter.name || clinician.assignedRecruiter.email}
                />
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent>
              <InternalNotes
                clinicianId={id}
                notes={notes}
                onNoteAdded={(note) => setNotes((prev) => [note, ...prev])}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right column — Progress + Checklist */}
        <div className="lg:col-span-2 space-y-6">
          {/* Progress */}
          {progress && (
            <Card>
              <CardContent>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Checklist Progress
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {progress.completed} of {progress.total} items completed
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-primary-600">
                    {progress.percentage}%
                  </span>
                </div>
                <ProgressBar value={progress.percentage} />
                <div className="flex gap-4 mt-3 text-xs">
                  <span className="text-success-600">
                    {progress.completed} approved
                  </span>
                  <span className="text-warning-700">
                    {progress.submitted} pending
                  </span>
                  <span className="text-danger-600">
                    {progress.rejected} rejected
                  </span>
                  <span className="text-slate-400">
                    {progress.notStarted} not started
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Checklist sections */}
          {sectionEntries.map(([section, items]) => (
            <div key={section}>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {section}
              </h3>
              <Card>
                <CardContent className="p-0">
                  <ul className="divide-y divide-slate-100">
                    {items
                      .sort((a, b) => a.itemDefinition.sortOrder - b.itemDefinition.sortOrder)
                      .map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3"
                        >
                          {statusIcon(item.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {item.itemDefinition.label}
                              </p>
                              {item.itemDefinition.highRisk && (
                                <AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge status={item.status}>
                                {formatStatus(item.status)}
                              </Badge>
                              {item.itemDefinition.required && (
                                <span className="text-[10px] text-slate-400 font-medium">
                                  REQUIRED
                                </span>
                              )}
                              {item.expiresAt && (
                                <ExpirationIndicator
                                  expiresAt={item.expiresAt}
                                  size="sm"
                                />
                              )}
                              {item.docOriginalName && (
                                <span className="text-[10px] text-slate-400 truncate max-w-[120px]">
                                  {item.docOriginalName}
                                </span>
                              )}
                            </div>
                            {item.rejectionComment && (
                              <p className="text-xs text-danger-600 mt-1">
                                Rejected: {item.rejectionReason} — {item.rejectionComment}
                              </p>
                            )}
                            {item.signerName && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                                <PenTool className="h-3 w-3" />
                                <span>
                                  Signed by {item.signerName}
                                  {item.signatureTimestamp && (
                                    <> on {new Date(item.signatureTimestamp).toLocaleDateString()}</>
                                  )}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.docStoragePath && (
                              <>
                                <button
                                  onClick={() => setPreviewItem(item)}
                                  className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                                  title="Preview document"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDownload(item.docStoragePath!)}
                                  className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                                  title="Download document"
                                >
                                  <Download className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {(item.status === 'submitted' || item.status === 'pending_review') && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setReviewItem(item)}
                              >
                                Review
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Review modal */}
      {reviewItem && (
        <ReviewModal
          open={!!reviewItem}
          onClose={() => setReviewItem(null)}
          itemLabel={reviewItem.itemDefinition.label}
          onApprove={handleApprove}
          onReject={handleReject}
          docStoragePath={reviewItem.docStoragePath}
          docOriginalName={reviewItem.docOriginalName}
          docMimeType={reviewItem.docMimeType}
        />
      )}

      {/* Preview modal (for viewing documents without review actions) */}
      {previewItem && (
        <DocumentPreviewModal
          open={!!previewItem}
          onClose={() => setPreviewItem(null)}
          itemLabel={previewItem.itemDefinition.label}
          docStoragePath={previewItem.docStoragePath}
          docOriginalName={previewItem.docOriginalName}
          docMimeType={previewItem.docMimeType}
        />
      )}
    </div>
  );
}

/* ── Document Preview Modal ── */

function DocumentPreviewModal({
  open,
  onClose,
  itemLabel,
  docStoragePath,
  docOriginalName,
  docMimeType,
}: {
  open: boolean;
  onClose: () => void;
  itemLabel: string;
  docStoragePath?: string | null;
  docOriginalName?: string | null;
  docMimeType?: string | null;
}) {
  const { getToken } = useAuth();
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !docStoragePath) {
      setDocUrl(null);
      setDocError(null);
      return;
    }

    let cancelled = false;
    setDocLoading(true);
    setDocError(null);

    (async () => {
      try {
        const token = await getToken();
        const { url } = await getDownloadUrl(token, docStoragePath);
        if (!cancelled) setDocUrl(url);
      } catch {
        if (!cancelled) setDocError('Failed to load document');
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, docStoragePath, getToken]);

  const isPreviewable =
    docMimeType?.startsWith('image/') || docMimeType === 'application/pdf';

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title={itemLabel}>
      <div className="space-y-3">
        {docLoading && (
          <div className="flex items-center justify-center py-12">
            <Spinner size="sm" />
          </div>
        )}

        {docError && (
          <div className="flex flex-col items-center justify-center py-8 rounded-lg border border-slate-200 bg-slate-50">
            <FileText className="h-6 w-6 text-slate-400 mb-1" />
            <p className="text-xs text-danger-600">{docError}</p>
          </div>
        )}

        {docUrl && !docLoading && (
          <>
            {isPreviewable ? (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                {docMimeType === 'application/pdf' ? (
                  <object
                    data={docUrl}
                    type="application/pdf"
                    className="w-full h-[450px]"
                  >
                    <div className="flex flex-col items-center justify-center py-8 bg-slate-50">
                      <FileText className="h-6 w-6 text-slate-400 mb-2" />
                      <p className="text-xs text-slate-500 mb-2">Unable to display PDF inline</p>
                      <a
                        href={docUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </object>
                ) : (
                  <img
                    src={docUrl}
                    alt={docOriginalName || 'Document'}
                    className="w-full max-h-[450px] object-contain bg-slate-50"
                  />
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <FileText className="h-8 w-8 text-slate-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">
                    {docOriginalName || 'Document'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {docMimeType || 'Unknown type'} — Preview not available
                  </p>
                </div>
              </div>
            )}

            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Download className="h-4 w-4" />
              Download {docOriginalName || 'Document'}
            </a>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ── Helper component ── */

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm text-slate-900">{value || '—'}</p>
      </div>
    </div>
  );
}
