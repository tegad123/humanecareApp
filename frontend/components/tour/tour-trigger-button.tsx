'use client';

import { CircleHelp } from 'lucide-react';
import { useTour } from './tour-provider';

export function TourTriggerButton() {
  const { startFullTour, hasCompletedTour, isActive } = useTour();

  if (isActive) return null;

  return (
    <button
      onClick={() => startFullTour()}
      data-tour="restart-tour"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition w-full"
    >
      <CircleHelp className="h-4 w-4 shrink-0" />
      {hasCompletedTour ? 'Replay Tour' : 'Take Tour'}
    </button>
  );
}
