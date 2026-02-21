'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Download, FileText, Eye } from 'lucide-react';
import { Modal, Button, Spinner } from '@/components/ui';
import { getDownloadUrl } from '@/lib/api/clinicians';

const REJECTION_REASONS = [
  'Expired document',
  'Illegible / poor quality',
  'Wrong document type',
  'Missing information',
  'Name mismatch',
  'Other',
];

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  itemLabel: string;
  onApprove: () => Promise<void>;
  onReject: (reason: string, comment: string) => Promise<void>;
  docStoragePath?: string | null;
  docOriginalName?: string | null;
  docMimeType?: string | null;
}

export function ReviewModal({
  open,
  onClose,
  itemLabel,
  onApprove,
  onReject,
  docStoragePath,
  docOriginalName,
  docMimeType,
}: ReviewModalProps) {
  const { getToken } = useAuth();
  const [mode, setMode] = useState<'choose' | 'reject'>('choose');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  // Document preview state
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Fetch presigned URL when modal opens with a document
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
        if (!cancelled) setDocError('Failed to load document preview');
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, docStoragePath, getToken]);

  const isPreviewable =
    docMimeType?.startsWith('image/') || docMimeType === 'application/pdf';

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      await onReject(reason, comment);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setMode('choose');
    setReason('');
    setComment('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={`Review: ${itemLabel}`}>
      <div className="space-y-4">
        {/* Document preview */}
        {docStoragePath && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                Submitted Document
              </p>
              {docUrl && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              )}
            </div>

            {docLoading && (
              <div className="flex items-center justify-center py-8 rounded-lg border border-slate-200 bg-slate-50">
                <Spinner size="sm" />
              </div>
            )}

            {docError && (
              <div className="flex flex-col items-center justify-center py-6 rounded-lg border border-slate-200 bg-slate-50">
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
                        className="w-full h-[350px]"
                      >
                        <div className="flex flex-col items-center justify-center py-8 bg-slate-50">
                          <FileText className="h-6 w-6 text-slate-400 mb-2" />
                          <p className="text-xs text-slate-500 mb-2">
                            Unable to display PDF inline
                          </p>
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
                        alt={docOriginalName || 'Uploaded document'}
                        className="w-full max-h-[350px] object-contain bg-slate-50"
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
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto shrink-0"
                    >
                      <Button variant="secondary" size="sm">
                        <Download className="h-3.5 w-3.5" />
                        Open
                      </Button>
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Review actions */}
        {mode === 'choose' ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Review this checklist item and choose an action.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleApprove} loading={loading} className="flex-1">
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => setMode('reject')}
                className="flex-1"
              >
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-700">Rejection Reason</p>
            <div className="flex flex-wrap gap-2">
              {REJECTION_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition border ${
                    reason === r
                      ? 'bg-danger-50 border-danger-600 text-danger-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Comment (optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Provide additional details..."
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setMode('choose')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                loading={loading}
                disabled={!reason}
                className="flex-1"
              >
                Reject
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
