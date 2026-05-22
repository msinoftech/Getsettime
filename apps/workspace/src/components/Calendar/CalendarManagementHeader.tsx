"use client";

import Link from "next/link";
import {
  LuCalendarDays as CalendarDays,
  LuSparkles as Sparkles,
  LuPlus as Plus,
  LuRefreshCw as RefreshCw,
  LuSlidersHorizontal as SlidersHorizontal,
} from "react-icons/lu";

type CalendarManagementHeaderProps = {
  onToday: () => void;
  onSync: () => void;
  onCreateBooking: () => void;
};

export function CalendarManagementHeader({
  onToday,
  onSync,
  onCreateBooking,
}: CalendarManagementHeaderProps) {
  return (
    <div className="relative border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-violet-50 to-cyan-50 px-5 py-6 md:px-7 md:py-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.10),transparent_24%)]" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <CalendarDays className="h-7 w-7" aria-hidden />
          </div>

          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Monthly booking overview
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Calendar Management
            </h1>
            <p className="mt-1 text-sm text-slate-600 md:text-base">
              Track bookings, review appointment status, and manage calendar
              activity from one place.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToday}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Today
          </button>

          <button
            type="button"
            onClick={onSync}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Sync
          </button>

          <Link
            href="/availability"
            className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Availability
          </Link>

          <button
            type="button"
            onClick={onCreateBooking}
            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create Booking
          </button>
        </div>
      </div>
    </div>
  );
}
