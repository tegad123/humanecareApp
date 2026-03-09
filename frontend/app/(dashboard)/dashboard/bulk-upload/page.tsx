'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardContent,
} from '@/components/ui';
import {
  createBulkUpload,
  confirmUploads,
  getBulkUploadJob,
  updateDocumentMatch,
  commitBulkUpload,
} from '@/lib/api/document-scanner';
import type { BulkUploadJob, BulkUploadDocument } from '@/lib/api/document-scanner';
import { fetchClinicians } from '@/lib/api/admin';
import { fetchTemplates } from '@/lib/api/templates';
import type { ItemDefinition } from '@/lib/api/templates';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 50;

type Step = 'upload' | 'scanning' | 'review' | 'complete';

interface ClinicianOption {
  id: string;
  name: string;
  templateId: string | null;
}

interface ItemDefOption {
  id: string;
  label: string;
  templateId: string;
}

export default function BulkUploadPage() {
  const { getToken } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [job, setJob] = useState<BulkUploadJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  // Data for dropdowns
  const [clinicians, setClinicians] = useState<ClinicianOption[]>([]);
  const [itemDefs, setItemDefs] = useState<ItemDefOption[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load clinicians and templates on mount
  useEffect(() => {
    (async () => {
      const token = await getToken();
      try {
        const [clinRes, tmplRes] = await Promise.all([
          fetchClinicians(token, { limit: 500 }),
          fetchTemplates(token),
        ]);
        setClinicians(
          clinRes.clinicians.map((c: any) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`,
            templateId: c.templateId,
          })),
        );
        const defs: ItemDefOption[] = [];
        for (const tmpl of tmplRes) {
          if (tmpl.itemDefinitions) {
            for (const def of tmpl.itemDefinitions) {
              if (def.type === 'file_upload' && def.hasExpiration && def.enabled) {
                defs.push({ id: def.id, label: def.label, templateId: tmpl.id });
              }
            }
          }
        }
        setItemDefs(defs);
      } catch {
        // non-critical, dropdowns will be empty
      }
    })();
  }, [getToken]);

  // ── Upload step ────────────────────────────────────────

  const handleFiles = useCallback((newFiles: FileList | File[]) => {
    const valid: File[] = [];
    for (const f of Array.from(newFiles)) {
      if (!ALLOWED_TYPES.has(f.type)) continue;
      if (f.size > MAX_FILE_SIZE) continue;
      valid.push(f);
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_FILES));
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const startUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const token = await getToken();
      const { jobId, documents } = await createBulkUpload(
        token,
        files.map((f) => ({ fileName: f.name, contentType: f.type })),
      );

      // Upload files to S3 in parallel (max 5 concurrent)
      const concurrency = 5;
      let idx = 0;
      const upload = async () => {
        while (idx < documents.length) {
          const i = idx++;
          const { docId, uploadUrl } = documents[i];
          const file = files[i];
          try {
            setUploadProgress((prev) => ({ ...prev, [docId]: 0 }));
            await uploadToS3(uploadUrl, file, (pct) => {
              setUploadProgress((prev) => ({ ...prev, [docId]: pct }));
            });
            setUploadProgress((prev) => ({ ...prev, [docId]: 100 }));
          } catch {
            setUploadProgress((prev) => ({ ...prev, [docId]: -1 }));
          }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => upload()));

      // Confirm uploads and trigger scanning
      const updatedJob = await confirmUploads(token, jobId);
      setJob(updatedJob);
      setStep('scanning');
      startPolling(jobId);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Scanning step (polling) ────────────────────────────

  const startPolling = (jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const token = await getToken();
        const updated = await getBulkUploadJob(token, jobId);
        setJob(updated);
        if (updated.status === 'review' || updated.status === 'completed' || updated.status === 'failed') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (updated.status === 'review') setStep('review');
          if (updated.status === 'failed') setError(updated.errorMessage || 'Scanning failed');
        }
      } catch {
        // keep polling
      }
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Review step ────────────────────────────────────────

  const handleDocUpdate = async (
    docId: string,
    field: string,
    value: string,
  ) => {
    if (!job) return;
    const token = await getToken();
    const data: Record<string, any> = { [field]: value };

    // If setting clinician + item def, auto-set status to matched
    if (field === 'matchedClinicianId' || field === 'matchedItemDefinitionId') {
      const doc = job.documents.find((d) => d.id === docId);
      if (doc) {
        const clinicianId = field === 'matchedClinicianId' ? value : doc.matchedClinicianId;
        const itemDefId = field === 'matchedItemDefinitionId' ? value : doc.matchedItemDefinitionId;
        if (clinicianId && itemDefId) {
          data.status = 'matched';
        }
      }
    }

    try {
      const updated = await updateDocumentMatch(token, job.id, docId, data);
      setJob((prev) =>
        prev
          ? {
              ...prev,
              documents: prev.documents.map((d) => (d.id === docId ? { ...d, ...updated } : d)),
            }
          : prev,
      );
    } catch {
      // ignore
    }
  };

  const handleSkip = async (docId: string) => {
    if (!job) return;
    const token = await getToken();
    try {
      const updated = await updateDocumentMatch(token, job.id, docId, { status: 'skipped' });
      setJob((prev) =>
        prev
          ? { ...prev, documents: prev.documents.map((d) => (d.id === docId ? { ...d, ...updated } : d)) }
          : prev,
      );
    } catch {
      // ignore
    }
  };

  const handleCommit = async () => {
    if (!job) return;
    setCommitting(true);
    try {
      const token = await getToken();
      const result = await commitBulkUpload(token, job.id);
      setJob(result);
      setStep('complete');
    } catch (err: any) {
      setError(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  const matchedCount = job?.documents.filter((d) => d.status === 'matched').length ?? 0;

  // Get available item defs for a clinician
  const getItemDefsForClinician = (clinicianId: string) => {
    const clinician = clinicians.find((c) => c.id === clinicianId);
    if (!clinician?.templateId) return itemDefs;
    return itemDefs.filter((d) => d.templateId === clinician.templateId);
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Bulk Document Upload</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload existing clinician documents and scan them for expiration dates.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {(['upload', 'scanning', 'review', 'complete'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-slate-200" />}
            <div
              className={`px-3 py-1 rounded-full font-medium ${
                step === s
                  ? 'bg-blue-100 text-blue-700'
                  : ['upload', 'scanning', 'review', 'complete'].indexOf(step) > i
                    ? 'bg-green-100 text-green-700'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {s === 'upload' ? '1. Upload' : s === 'scanning' ? '2. Scan' : s === 'review' ? '3. Review' : '4. Done'}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-slate-900">Select Documents</h2>
            <p className="text-xs text-slate-500 mt-1">
              Drag and drop or browse to select files. Accepts PDF, JPEG, PNG, DOC, DOCX (max 10 MB each, up to {MAX_FILES} files).
            </p>
          </CardHeader>
          <CardContent>
            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 font-medium">Drop files here or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">PDF, JPEG, PNG, DOC, DOCX</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-slate-500">{files.length} file(s) selected</div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded px-3 py-2"
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-slate-400 shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={startUpload}
                  disabled={uploading || files.length === 0}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? 'Uploading & Scanning...' : 'Upload & Scan'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Scanning */}
      {step === 'scanning' && job && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto mb-4" />
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Scanning Documents...</h2>
            <p className="text-xs text-slate-500">
              AI is analyzing {job.totalFiles} document(s) for expiration dates and document types.
            </p>
            <div className="mt-4 max-w-xs mx-auto">
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${job.totalFiles > 0 ? (job.processedFiles / job.totalFiles) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">{job.processedFiles} of {job.totalFiles} processed</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: Review */}
      {step === 'review' && job && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Review Scan Results</h2>
                <p className="text-xs text-slate-500 mt-1">
                  {matchedCount} of {job.documents.length} documents matched. Review and adjust before committing.
                </p>
              </div>
              <button
                onClick={handleCommit}
                disabled={committing || matchedCount === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Commit {matchedCount} Document(s)
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3 font-medium">File</th>
                    <th className="pb-2 pr-3 font-medium">AI Doc Type</th>
                    <th className="pb-2 pr-3 font-medium">AI Expiration</th>
                    <th className="pb-2 pr-3 font-medium">Confidence</th>
                    <th className="pb-2 pr-3 font-medium">Clinician</th>
                    <th className="pb-2 pr-3 font-medium">Checklist Item</th>
                    <th className="pb-2 pr-3 font-medium">Confirmed Expiration</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {job.documents.map((doc) => (
                    <ReviewRow
                      key={doc.id}
                      doc={doc}
                      clinicians={clinicians}
                      getItemDefsForClinician={getItemDefsForClinician}
                      allItemDefs={itemDefs}
                      onUpdate={handleDocUpdate}
                      onSkip={handleSkip}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Complete */}
      {step === 'complete' && job && (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-4" />
            <h2 className="text-sm font-semibold text-slate-900 mb-1">Upload Complete</h2>
            <p className="text-xs text-slate-500 mb-4">
              {job.committedFiles} document(s) committed successfully.
              {job.failedFiles > 0 && ` ${job.failedFiles} failed.`}
            </p>

            {/* Summary */}
            <div className="inline-flex gap-6 text-xs">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{job.committedFiles}</div>
                <div className="text-slate-500">Committed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-400">
                  {job.documents.filter((d) => d.status === 'skipped').length}
                </div>
                <div className="text-slate-500">Skipped</div>
              </div>
              {job.failedFiles > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{job.failedFiles}</div>
                  <div className="text-slate-500">Failed</div>
                </div>
              )}
            </div>

            {/* Expiration flags */}
            {(() => {
              const committed = job.documents.filter((d) => d.status === 'committed');
              const now = new Date();
              const expired = committed.filter((d) => d.confirmedExpiration && new Date(d.confirmedExpiration) < now);
              const expiringSoon = committed.filter((d) => {
                if (!d.confirmedExpiration) return false;
                const exp = new Date(d.confirmedExpiration);
                const days = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
                return days >= 0 && days <= 30;
              });

              if (expired.length === 0 && expiringSoon.length === 0) return null;

              return (
                <div className="mt-6 text-left max-w-md mx-auto">
                  {expired.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                      <div className="text-xs font-medium text-red-700 mb-1">
                        {expired.length} document(s) already expired
                      </div>
                      {expired.map((d) => (
                        <div key={d.id} className="text-xs text-red-600">
                          {d.originalFileName} — expired {d.confirmedExpiration?.slice(0, 10)}
                        </div>
                      ))}
                    </div>
                  )}
                  {expiringSoon.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-xs font-medium text-amber-700 mb-1">
                        {expiringSoon.length} document(s) expiring within 30 days
                      </div>
                      {expiringSoon.map((d) => (
                        <div key={d.id} className="text-xs text-amber-600">
                          {d.originalFileName} — expires {d.confirmedExpiration?.slice(0, 10)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="mt-6">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </a>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Review Row Component ─────────────────────────────────

function ReviewRow({
  doc,
  clinicians,
  getItemDefsForClinician,
  allItemDefs,
  onUpdate,
  onSkip,
}: {
  doc: BulkUploadDocument;
  clinicians: ClinicianOption[];
  getItemDefsForClinician: (id: string) => ItemDefOption[];
  allItemDefs: ItemDefOption[];
  onUpdate: (docId: string, field: string, value: string) => void;
  onSkip: (docId: string) => void;
}) {
  const isSkipped = doc.status === 'skipped';
  const isFailed = doc.status === 'failed';
  const isMatched = doc.status === 'matched';

  const availableItemDefs = doc.matchedClinicianId
    ? getItemDefsForClinician(doc.matchedClinicianId)
    : allItemDefs;

  const confidenceColor =
    doc.aiConfidence === null
      ? 'text-slate-400'
      : doc.aiConfidence >= 0.85
        ? 'text-green-600'
        : doc.aiConfidence >= 0.6
          ? 'text-amber-600'
          : 'text-red-600';

  const expirationDate = doc.confirmedExpiration?.slice(0, 10) || doc.aiExtractedExpiration?.slice(0, 10) || '';
  const isExpired = expirationDate && new Date(expirationDate) < new Date();

  return (
    <tr className={`border-b border-slate-100 ${isSkipped ? 'opacity-40' : ''} ${isFailed ? 'bg-red-50/50' : ''}`}>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <span className="truncate max-w-[120px]" title={doc.originalFileName}>
            {doc.originalFileName}
          </span>
        </div>
      </td>
      <td className="py-2 pr-3 text-slate-600">{doc.aiExtractedDocType || '—'}</td>
      <td className={`py-2 pr-3 ${isExpired ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
        {doc.aiExtractedExpiration?.slice(0, 10) || '—'}
      </td>
      <td className={`py-2 pr-3 font-medium ${confidenceColor}`}>
        {doc.aiConfidence !== null ? `${Math.round(Number(doc.aiConfidence) * 100)}%` : '—'}
      </td>
      <td className="py-2 pr-3">
        <select
          value={doc.matchedClinicianId || ''}
          onChange={(e) => onUpdate(doc.id, 'matchedClinicianId', e.target.value)}
          disabled={isSkipped || isFailed}
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:opacity-50"
        >
          <option value="">Select clinician...</option>
          {clinicians.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <select
          value={doc.matchedItemDefinitionId || ''}
          onChange={(e) => onUpdate(doc.id, 'matchedItemDefinitionId', e.target.value)}
          disabled={isSkipped || isFailed}
          className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white disabled:opacity-50"
        >
          <option value="">Select item...</option>
          {availableItemDefs.map((d) => (
            <option key={d.id} value={d.id}>{d.label}</option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <input
          type="date"
          value={expirationDate}
          onChange={(e) => onUpdate(doc.id, 'confirmedExpiration', e.target.value)}
          disabled={isSkipped || isFailed}
          className={`w-full text-xs border rounded px-2 py-1 bg-white disabled:opacity-50 ${
            isExpired ? 'border-red-300 text-red-600' : 'border-slate-200'
          }`}
        />
      </td>
      <td className="py-2">
        {isFailed ? (
          <span className="inline-flex items-center gap-1 text-red-600" title={doc.errorMessage || ''}>
            <AlertCircle className="h-3 w-3" /> Failed
          </span>
        ) : isSkipped ? (
          <span className="text-slate-400">Skipped</span>
        ) : isMatched ? (
          <span className="inline-flex items-center gap-1 text-green-600">
            <CheckCircle className="h-3 w-3" /> Matched
          </span>
        ) : (
          <button
            onClick={() => onSkip(doc.id)}
            className="text-slate-400 hover:text-red-500 text-xs underline"
          >
            Skip
          </button>
        )}
      </td>
    </tr>
  );
}

// ── S3 upload helper ─────────────────────────────────────

async function uploadToS3(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
