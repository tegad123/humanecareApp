'use client';

import { Clock, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui';

interface ExpirationIndicatorProps {
  expiresAt: string | null;
  /** Pre-computed days remaining (optional — will compute from expiresAt if not provided) */
  daysRemaining?: number | null;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

function getDaysRemaining(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type ExpirationLevel = 'expired' | 'critical' | 'warning' | 'upcoming' | 'safe';

function getLevel(days: number): ExpirationLevel {
  if (days <= 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'warning';
  return days <= 60 ? 'upcoming' : 'safe';
}

const levelConfig: Record<
  ExpirationLevel,
  {
    bgClass: string;
    textClass: string;
    dotClass: string;
    label: (days: number) => string;
    icon: typeof Clock;
  }
> = {
  expired: {
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    dotClass: 'bg-red-600',
    label: () => 'Expired',
    icon: XCircle,
  },
  critical: {
    bgClass: 'bg-red-50',
    textClass: 'text-red-700',
    dotClass: 'bg-red-500',
    label: (d) => `${d}d left`,
    icon: AlertTriangle,
  },
  warning: {
    bgClass: 'bg-amber-50',
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-500',
    label: (d) => `${d}d left`,
    icon: Clock,
  },
  upcoming: {
    bgClass: 'bg-blue-50',
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-400',
    label: (d) => `${d}d left`,
    icon: Clock,
  },
  safe: {
    bgClass: 'bg-green-50',
    textClass: 'text-green-700',
    dotClass: 'bg-green-500',
    label: (d) => `${d}d`,
    icon: Clock,
  },
};

/**
 * Color-coded expiration indicator.
 * - Green: >30 days
 * - Blue: 30–60 days
 * - Amber: 7–30 days
 * - Red: <7 days
 * - Dark red: expired
 */
export function ExpirationIndicator({
  expiresAt,
  daysRemaining: daysRemainingProp,
  showLabel = true,
  size = 'sm',
}: ExpirationIndicatorProps) {
  if (!expiresAt) return null;

  const days =
    daysRemainingProp !== undefined && daysRemainingProp !== null
      ? daysRemainingProp
      : getDaysRemaining(expiresAt);

  const level = getLevel(days);
  const config = levelConfig[level];
  const Icon = config.icon;

  if (!showLabel) {
    return (
      <span
        className={`inline-block rounded-full ${size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} ${config.dotClass}`}
        title={`${days <= 0 ? 'Expired' : `${days} days remaining`}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
        size === 'sm' ? 'text-xs' : 'text-sm'
      } font-medium ${config.bgClass} ${config.textClass}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {config.label(days)}
    </span>
  );
}

/**
 * Badge variant that maps to expiration level.
 * Use in table cells or compact layouts.
 */
export function ExpirationBadge({
  expiresAt,
  daysRemaining: daysRemainingProp,
}: {
  expiresAt: string | null;
  daysRemaining?: number | null;
}) {
  if (!expiresAt) return null;

  const days =
    daysRemainingProp !== undefined && daysRemainingProp !== null
      ? daysRemainingProp
      : getDaysRemaining(expiresAt);

  const level = getLevel(days);

  const variantMap: Record<ExpirationLevel, 'danger' | 'warning' | 'info' | 'success'> = {
    expired: 'danger',
    critical: 'danger',
    warning: 'warning',
    upcoming: 'info',
    safe: 'success',
  };

  return (
    <Badge variant={variantMap[level]}>
      {days <= 0 ? 'Expired' : `${days}d`}
    </Badge>
  );
}
