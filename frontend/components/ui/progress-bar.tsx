interface ProgressBarProps {
  value: number; // 0–100
  className?: string;
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  let barColor = 'bg-danger-600';
  if (clamped >= 100) barColor = 'bg-success-600';
  else if (clamped >= 50) barColor = 'bg-warning-500';
  else if (clamped >= 25) barColor = 'bg-primary-500';

  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-200 ${className}`}>
      <div
        className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
