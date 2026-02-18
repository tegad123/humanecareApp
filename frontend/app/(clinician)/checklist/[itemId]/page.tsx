'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Button, Badge, Card, CardContent, Input, Spinner } from '@/components/ui';
import {
  fetchMyChecklist,
  submitChecklistItem,
  getUploadUrl,
  type ChecklistItem,
} from '@/lib/api/clinicians';

function formatStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ChecklistItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { getToken } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<ChecklistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [textValue, setTextValue] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [expiresAt, setExpiresAt] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const data = await fetchMyChecklist(token);
        const found = data.items.find((i) => i.id === itemId);
        if (!found) throw new Error('Item not found');
        setItem(found);

        // Pre-fill existing values
        if (found.valueText) setTextValue(found.valueText);
        if (found.valueDate) setDateValue(found.valueDate.split('T')[0]);
        if (found.valueSelect) setSelectValue(found.valueSelect);
        if (found.expiresAt) setExpiresAt(found.expiresAt.split('T')[0]);
      } catch (err: any) {
        setError(err.message || 'Failed to load item');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [itemId, getToken]);

  const handleSubmit = useCallback(async () => {
    if (!item) return;
    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      const def = item.itemDefinition;
      const payload: Record<string, any> = {};

      if (def.hasExpiration && expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      }

      switch (def.type) {
        case 'file_upload': {
          if (!file) {
            setError('Please select a file to upload');
            setSubmitting(false);
            return;
          }
          // Get presigned URL
          const { url, key } = await getUploadUrl(token, {
            clinicianId: item.clinicianId,
            itemId: item.id,
            fileName: file.name,
            contentType: file.type,
          });
          // Upload directly to S3
          await fetch(url, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          payload.docStoragePath = key;
          payload.docOriginalName = file.name;
          payload.docMimeType = file.type;
          break;
        }
        case 'text':
          payload.valueText = textValue;
          break;
        case 'date':
          payload.valueDate = dateValue
            ? new Date(dateValue).toISOString()
            : undefined;
          break;
        case 'select':
          payload.valueSelect = selectValue;
          break;
        case 'e_signature':
          payload.valueText = 'signed';
          break;
      }

      await submitChecklistItem(token, item.id, payload);
      setSuccess(true);
      setTimeout(() => router.push('/checklist'), 1500);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }, [item, file, textValue, dateValue, selectValue, expiresAt, getToken, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!item) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-600">{error || 'Item not found'}</p>
      </Card>
    );
  }

  const def = item.itemDefinition;
  const isCompleted = item.status === 'approved';
  const isSubmitted = item.status === 'submitted' || item.status === 'pending_review';
  const isRejected = item.status === 'rejected';
  const canSubmit = !isCompleted && !isSubmitted;

  // Parse select options from configJson
  const selectOptions: string[] = def.configJson?.options || [];

  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/checklist"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Checklist
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{def.label}</h1>
        <div className="flex items-center gap-2 mt-1">
          <Badge status={item.status}>{formatStatus(item.status)}</Badge>
          {def.required && (
            <span className="text-[10px] text-danger-600 font-medium uppercase">
              Required
            </span>
          )}
          {def.blocking && (
            <span className="text-[10px] text-warning-700 font-medium uppercase">
              Blocking
            </span>
          )}
        </div>
      </div>

      {/* Rejection notice */}
      {isRejected && (
        <Card className="border-danger-600/20 bg-danger-50">
          <CardContent className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-danger-700">
                This item was rejected
              </p>
              {item.rejectionReason && (
                <p className="text-sm text-danger-600 mt-1">
                  Reason: {item.rejectionReason}
                </p>
              )}
              {item.rejectionComment && (
                <p className="text-sm text-slate-600 mt-1">
                  {item.rejectionComment}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {success && (
        <Card className="border-success-600/20 bg-success-50">
          <CardContent className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600" />
            <p className="text-sm font-medium text-success-700">
              Submitted successfully! Redirecting...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Approved state */}
      {isCompleted && (
        <Card className="border-success-600/20 bg-success-50">
          <CardContent className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success-600" />
            <p className="text-sm font-medium text-success-700">
              This item has been approved.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pending review state */}
      {isSubmitted && !success && (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="mx-auto h-8 w-8 text-warning-500 mb-2" />
            <p className="text-sm font-medium text-slate-700">
              Submitted &mdash; awaiting review
            </p>
            {item.docOriginalName && (
              <p className="text-xs text-slate-500 mt-1">
                File: {item.docOriginalName}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Input form */}
      {canSubmit && !success && (
        <Card>
          <CardContent className="space-y-4">
            {/* File upload */}
            {def.type === 'file_upload' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Upload Document
                </label>
                <label className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {file ? file.name : 'Tap to select a file'}
                  </span>
                  {file && (
                    <span className="text-xs text-slate-400">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            )}

            {/* Text input */}
            {def.type === 'text' && (
              <Input
                label={def.label}
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={`Enter ${def.label.toLowerCase()}`}
              />
            )}

            {/* Date input */}
            {def.type === 'date' && (
              <Input
                label={def.label}
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
            )}

            {/* Select input */}
            {def.type === 'select' && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">
                  {def.label}
                </label>
                <select
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select an option</option>
                  {selectOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* E-Signature */}
            {def.type === 'e_signature' && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm text-slate-700 mb-3">
                  By clicking the button below, you agree to and acknowledge the
                  terms of this item.
                </p>
                <p className="text-xs text-slate-500">
                  This constitutes your electronic signature.
                </p>
              </div>
            )}

            {/* Expiration date (for items that have expiration) */}
            {def.hasExpiration && (
              <Input
                label="Expiration Date"
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-danger-600">{error}</p>
            )}

            {/* Submit button */}
            <Button
              onClick={handleSubmit}
              loading={submitting}
              className="w-full"
              size="lg"
            >
              {def.type === 'e_signature' ? 'Sign & Submit' : 'Submit'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
