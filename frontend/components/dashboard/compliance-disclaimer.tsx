'use client';

import { AlertTriangle } from 'lucide-react';

export function ComplianceDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <p className="text-sm text-amber-800">
        Status labels reflect information configured and entered by your organization.
        They are operational aids and do not constitute legal certification or legal advice.
      </p>
    </div>
  );
}

