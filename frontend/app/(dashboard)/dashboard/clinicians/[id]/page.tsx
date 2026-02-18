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
  FileText,
  Download,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardContent,
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
  type ClinicianWithProgress,
  type ChecklistItem,
  type ClinicianProgress,
  type InternalNote,
} from '@/lib/api/admin';
import { getDownloadUrl } from '@/lib/api/clinicians';

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

  const handleDownload = async (key: string) => {
    try {
      const token = await getToken();
      const { url } = await getDownloadUrl(token, key);
      window.open(url, '_blank');
    } catch {
      // silently fail
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
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {item.docStoragePath && (
                              <button
                                onClick={() => handleDownload(item.docStoragePath!)}
                                className="p-1.5 text-slate-400 hover:text-primary-600 transition"
                                title="Download document"
                              >
                                <Download className="h-4 w-4" />
                              </button>
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
        />
      )}
    </div>
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
