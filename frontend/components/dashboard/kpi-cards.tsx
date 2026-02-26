'use client';

import { Users, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import type { ClinicianStats } from '@/lib/api/admin';

interface KPICardsProps {
  stats: ClinicianStats;
}

const cards = [
  { key: 'total' as const, label: 'Total Clinicians', icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
  { key: 'ready' as const, label: 'Ready to Staff', icon: CheckCircle2, color: 'text-success-600', bg: 'bg-success-50' },
  { key: 'onboarding' as const, label: 'Onboarding', icon: Clock, color: 'text-primary-600', bg: 'bg-primary-50' },
  { key: 'notReady' as const, label: 'Not Ready', icon: AlertTriangle, color: 'text-warning-700', bg: 'bg-warning-50' },
];

export function KPICards({ stats }: KPICardsProps) {
  return (
    <div data-tour="kpi-cards" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, color, bg }) => (
        <div
          key={key}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${bg}`}>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats[key]}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
