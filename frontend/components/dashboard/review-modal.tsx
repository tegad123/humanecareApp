'use client';

import { useState } from 'react';
import { Modal, Button } from '@/components/ui';

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
}

export function ReviewModal({
  open,
  onClose,
  itemLabel,
  onApprove,
  onReject,
}: ReviewModalProps) {
  const [mode, setMode] = useState<'choose' | 'reject'>('choose');
  const [reason, setReason] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

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
    </Modal>
  );
}
