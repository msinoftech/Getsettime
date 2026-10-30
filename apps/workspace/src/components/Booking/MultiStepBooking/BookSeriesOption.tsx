'use client';

interface BookSeriesOptionProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function BookSeriesOption({ checked, onChange }: BookSeriesOptionProps) {
  return (
    <label className="mt-6 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 text-sm text-slate-700">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="font-semibold text-slate-900">Book the entire series</span>
        <span className="mt-0.5 block text-xs text-slate-500">
          Books one seat on every remaining session in this schedule. Leave unchecked to book
          only the selected date.
        </span>
      </span>
    </label>
  );
}
