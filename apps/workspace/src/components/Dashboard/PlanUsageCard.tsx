"use client";

import DashboardIcon from "./DashboardIcon";
import { formatBookingLimitLabel, isUnlimitedBookingLimit } from "@app/db/subscription";
import type { plans, workspace_usage } from "@app/db/subscription";

type PlanUsageCardProps = {
  loading: boolean;
  used: number;
  limit: number;
  onUpgrade: () => void;
  plan?: plans | null;
  usage?: workspace_usage | null;
};

export default function PlanUsageCard({
  loading,
  used,
  limit,
  onUpgrade,
  plan,
  usage,
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

      {!loading && plan ? (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {plan.name}
              </p>
              <p className="text-xs font-medium text-slate-500">
                {formatBookingLimitLabel(plan.booking_limit)} bookings/month · up
                to {plan.service_provider_limit} providers
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-slate-900">
              ₹{plan.price.toLocaleString("en-IN")}
              <span className="text-xs font-medium text-slate-400">/mo</span>
            </p>
          </div>

          {usage ? (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">
                  Bookings this month
                </dt>
                <dd className="text-sm font-bold text-slate-900">
                  {usage.bookings_this_month}
                  {isUnlimitedBookingLimit(usage.booking_limit)
                    ? ""
                    : ` / ${usage.booking_limit}`}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 px-3 py-2">
                <dt className="text-xs font-medium text-slate-500">
                  Service providers
                </dt>
                <dd className="text-sm font-bold text-slate-900">
                  {usage.service_provider_count} / {usage.service_provider_limit}
                </dd>
              </div>
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
