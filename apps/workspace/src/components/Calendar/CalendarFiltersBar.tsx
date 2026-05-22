"use client";

import Link from "next/link";
import {
  LuClipboardList as ClipboardList,
  LuEye as Eye,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuSearch as Search,
  LuFilter as Filter,
  LuDownload as Download,
} from "react-icons/lu";

export type CalendarStatusFilterOption = "all" | "confirmed" | "pending" | "cancelled";

type CalendarFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: CalendarStatusFilterOption;
  onStatusFilterChange: (value: CalendarStatusFilterOption) => void;
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function CalendarFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  monthLabel,
  onPreviousMonth,
  onNextMonth,
}: CalendarFiltersBarProps) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search customer, event type, or created by"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-300"
                type="search"
              />
            </div>

            <div className="relative min-w-[180px]">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  onStatusFilterChange(
                    e.target.value as CalendarStatusFilterOption,
                  )
                }
                className="h-12 w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-700 outline-none focus:border-indigo-300"
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="pending">Pending</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPreviousMonth}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>

            <div className="min-w-[190px] rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-base font-semibold text-slate-900">
              {monthLabel}
            </div>

            <button
              type="button"
              onClick={onNextMonth}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            All Bookings
          </Link>

          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 opacity-70"
          >
            <Eye className="h-4 w-4" aria-hidden />
            Reports
          </button>

          <button
            type="button"
            disabled
            title="Coming soon"
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 opacity-70"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
