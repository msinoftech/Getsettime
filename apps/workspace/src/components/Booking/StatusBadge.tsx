'use client';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  emergency: 'bg-orange-50 text-orange-700 border-orange-200',
  reschedule: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'no-show': 'bg-violet-50 text-violet-800 border-violet-200',
  deleted: 'bg-slate-50 text-slate-700 border-slate-200',
};

const DEFAULT_STYLE = 'bg-red-100 text-red-700';

export function StatusBadge({
  status,
  className = '',
}: {
  status: string;
  className?: string;
}) {
  const normalizedStatus = status?.toLowerCase() ?? '';
  const styleClass = STATUS_STYLES[normalizedStatus] ?? DEFAULT_STYLE;

  return (
    <span
      className={`inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border ${styleClass} ${className}`}
    >
      {status || 'Pending'}
    </span>
  );
}
