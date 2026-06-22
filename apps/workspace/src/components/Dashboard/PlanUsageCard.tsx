"use client";

import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { formatBookingLimitLabel, isUnlimitedBookingLimit } from "@app/db/subscription";

type PlanUsageCardProps = {
  loading: boolean;
  used: number;
  limit: number;
  onUpgrade: () => void;
};

export default function PlanUsageCard({
  loading,
  used,
  limit,
  onUpgrade,
}: PlanUsageCardProps) {
  const unlimited = isUnlimitedBookingLimit(limit);
  const remaining = unlimited ? null : Math.max(0, limit - used);
  const percent = unlimited
    ? 0
    : Math.max(0, Math.min(100, limit > 0 ? Math.round((used / limit) * 100) : 0));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <DashboardIcon name="zap" size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Plan Usage</h3>
        </div>
        {!loading && remaining !== null ? (
          <span className="text-xs font-semibold text-slate-400">
            {remaining} remaining this month
          </span>
        ) : null}
      </div>

      <p className="text-sm font-semibold text-slate-700">
        {loading ? (
          "Loading…"
        ) : unlimited ? (
          <>{used} bookings used (Unlimited)</>
        ) : (
          <>
            {used} of {formatBookingLimitLabel(limit)} bookings used
          </>
        )}
      </p>

      {!loading && !unlimited ? (
        <>
          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs font-medium text-slate-400">{percent}% used</p>
        </>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/billings"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200/70 hover:bg-slate-100"
        >
          <DashboardIcon name="activity" size={16} /> View Usage
        </Link>
        <button
          type="button"
          onClick={onUpgrade}
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          <DashboardIcon name="trend" size={16} /> Upgrade
        </button>
      </div>
    </div>
  );
}
