"use client";

import DashboardTimezoneSelect from "./DashboardTimezoneSelect";

export type DashboardRange = "today" | "week" | "month";

const RANGE_OPTIONS: readonly { id: DashboardRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

export default function DashboardFilterBar({
  range,
  on_range_change,
}: {
  range: DashboardRange;
  on_range_change: (next: DashboardRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {RANGE_OPTIONS.map((option) => {
          const active = option.id === range;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => on_range_change(option.id)}
              className={`rounded-lg px-5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <DashboardTimezoneSelect />
    </div>
  );
}
