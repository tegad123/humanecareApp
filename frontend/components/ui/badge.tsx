type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700',
  success: 'bg-success-50 text-success-700',
  warning: 'bg-warning-50 text-warning-700',
  danger: 'bg-danger-50 text-danger-700',
  info: 'bg-primary-50 text-primary-700',
  neutral: 'bg-slate-100 text-slate-600',
};

const statusVariantMap: Record<string, BadgeVariant> = {
  not_started: 'neutral',
  submitted: 'info',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  expired: 'danger',
  onboarding: 'info',
  ready: 'success',
  not_ready: 'warning',
  inactive: 'neutral',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  status?: string;
  className?: string;
}

export function Badge({ children, variant, status, className = '' }: BadgeProps) {
  const resolvedVariant = variant ?? statusVariantMap[status ?? ''] ?? 'default';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[resolvedVariant]} ${className}`}
    >
      {children}
    </span>
  );
}
