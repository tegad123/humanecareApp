'use client';

import { TourProvider } from './tour-provider';
import { TourOverlay } from './tour-overlay';
import { Sidebar } from '@/components/dashboard/sidebar';

export function DashboardClientWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TourProvider>
      <Sidebar />
      <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
      <TourOverlay />
    </TourProvider>
  );
}
