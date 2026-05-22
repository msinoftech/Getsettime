"use client";

import Link from "next/link";
import DashboardIcon from "./DashboardIcon";

export default function DashboardSideCards({
  missed_or_cancelled_count,
}: {
  missed_or_cancelled_count: number;
}) {
  return (
    <>
      <div className="rounded-[32px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-xl shadow-slate-200/60">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black text-slate-900">WhatsApp Automation</h3>
            <p className="text-sm font-semibold text-slate-500">Reminder delivery health</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <DashboardIcon name="message" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Sent", value: "—" },
            { label: "Delivered", value: "—" },
            { label: "Failed", value: "—" },
          ].map((pill) => (
            <div
              key={pill.label}
              className="rounded-2xl bg-white/80 p-3 text-center text-sm font-black text-slate-800 shadow-sm"
            >
              <span className="block text-xs font-bold text-slate-500">{pill.label}</span>
              {pill.value}
            </div>
          ))}
        </div>
        <Link href="/integrations" className="mt-3 inline-block text-xs font-black text-emerald-700 underline">
          Open integrations
        </Link>
      </div>

      <div className="rounded-[32px] border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-5 shadow-xl shadow-slate-200/60">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
            <DashboardIcon name="alert" size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">Missed Booking Loss</h3>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
              Workspace has{" "}
              <span className="text-rose-600">{missed_or_cancelled_count}</span> cancelled /
              no-show booking(s) in aggregated stats (all time totals). Revenue impact can be tracked
              from booking values when available.
            </p>
            <Link
              href="/bookings"
              className="mt-4 inline-block rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white"
            >
              Review Missed
            </Link>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-xl shadow-slate-200/60">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <DashboardIcon name="shield" size={24} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-900">MVP Health Score</h3>
            <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
              Complete workspace settings: payments, cancellations, notifications, brand and
              integrations to go live confidently.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-block rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"
            >
              Complete Setup
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
