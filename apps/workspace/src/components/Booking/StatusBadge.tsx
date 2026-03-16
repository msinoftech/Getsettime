'use client';

const STATUS_STYLES: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  cancelled: 'bg-slate-100 text-slate-700',
  completed: 'bg-blue-100 text-blue-700',
  emergency: 'bg-orange-100 text-orange-700',
  reschedule: 'bg-red-100 text-red-700',
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
      className={`inline-flex px-2 py-1 text-xs font-medium rounded-md ${styleClass} ${className}`}
    >
      {status || 'Pending'}
    </span>
  );
}
