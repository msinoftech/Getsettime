"use client";

import {
  LuCircleCheckBig as CheckCircle2,
  LuClock3 as Clock3,
  LuLayers3 as Layers3,
  LuCircleX as XCircle,
} from "react-icons/lu";

type CalendarStatsRowProps = {
  totalBookings: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
};

export function CalendarStatsRow({
  totalBookings,
  confirmedCount,
  pendingCount,
  cancelledCount,
}: CalendarStatsRowProps) {
  return (
    <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-2 md:p-6 xl:grid-cols-4">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Total Bookings
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              {totalBookings}
            </h3>
          </div>
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
            <Layers3 className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Confirmed
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              {confirmedCount}
            </h3>
          </div>
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Pending
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              {pendingCount}
            </h3>
          </div>
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <Clock3 className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Cancelled
            </p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">
              {cancelledCount}
            </h3>
          </div>
          <div className="rounded-2xl bg-rose-100 p-3 text-rose-700">
            <XCircle className="h-5 w-5" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
