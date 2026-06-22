"use client";

import Link from "next/link";
import DashboardIcon, { type DashboardIconName } from "./DashboardIcon";

type IntegrationStatus = {
  label: string;
  icon: DashboardIconName;
  icon_bg: string;
  icon_color: string;
  state_label: string;
  active: boolean;
  href: string;
};

export type MetricTrend = {
  direction: "up" | "down";
  percent: number;
  label: string;
};

type WorkspaceOverviewCardProps = {
  loading: boolean;
  confirmed_today: number;
  confirmed_today_secondary: string;
  completion_rate_display: string;
  completion_trend?: MetricTrend;
  total_bookings: number;
  total_bookings_trend?: MetricTrend;
  whatsapp_active: boolean;
  email_active: boolean;
};

function TrendCaption({ trend }: { trend: MetricTrend }) {
  const is_up = trend.direction === "up";
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium">
      <span
        className={`inline-flex items-center gap-0.5 font-bold ${
          is_up ? "text-emerald-600" : "text-rose-500"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {is_up ? (
            <>
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </>
          ) : (
            <>
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </>
          )}
        </svg>
        {trend.percent}%
      </span>
      <span className="text-slate-400">{trend.label}</span>
    </p>
  );
}

function MetricTile({
  label,
  value,
  secondary,
  trend,
  icon,
  icon_bg,
  icon_color,
}: {
  label: string;
  value: string;
  secondary: string;
  trend?: MetricTrend;
  icon: DashboardIconName;
  icon_bg: string;
  icon_color: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 md:p-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${icon_bg} ${icon_color}`}
      >
        <DashboardIcon name={icon} size={20} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        {trend ? (
          <TrendCaption trend={trend} />
        ) : (
          <p className="mt-0.5 truncate text-xs font-medium text-slate-400">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}

export default function WorkspaceOverviewCard({
  loading,
  confirmed_today,
  confirmed_today_secondary,
  completion_rate_display,
  completion_trend,
  total_bookings,
  total_bookings_trend,
  whatsapp_active,
  email_active,
}: WorkspaceOverviewCardProps) {
  const integrations: IntegrationStatus[] = [
    {
      label: "Google Calendar",
      icon: "calendar",
      icon_bg: "bg-blue-50",
      icon_color: "text-blue-600",
      state_label: "Connect",
      active: false,
      href: "/integrations",
    },
    {
      label: "WhatsApp Reminders",
      icon: "whatsapp",
      icon_bg: "bg-emerald-50",
      icon_color: "text-emerald-600",
      state_label: whatsapp_active ? "Active" : "Set up",
      active: whatsapp_active,
      href: "/integrations",
    },
    {
      label: "Email Reminders",
      icon: "mail",
      icon_bg: "bg-blue-50",
      icon_color: "text-blue-600",
      state_label: email_active ? "Active" : "Set up",
      active: email_active,
      href: "/settings",
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <DashboardIcon name="activity" size={20} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Workspace Overview</h3>
          <p className="text-sm font-medium text-slate-500">
            Key metrics and system status at a glance.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <MetricTile
            label="Confirmed Today"
            value={loading ? "…" : String(confirmed_today)}
            secondary={confirmed_today_secondary}
            icon="circleCheck"
            icon_bg="bg-indigo-50"
            icon_color="text-indigo-600"
          />
          <MetricTile
            label="Completion Rate"
            value={loading ? "…" : completion_rate_display}
            secondary="Completed vs all bookings"
            trend={loading ? undefined : completion_trend}
            icon="pieChart"
            icon_bg="bg-emerald-50"
            icon_color="text-emerald-600"
          />
          <MetricTile
            label="Total Bookings"
            value={loading ? "…" : total_bookings.toLocaleString()}
            secondary="All bookings in this workspace"
            trend={loading ? undefined : total_bookings_trend}
            icon="calendarDays"
            icon_bg="bg-amber-50"
            icon_color="text-amber-600"
          />
        </div>

        <div className="grid divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/40 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {integrations.map((integration) => (
            <Link
              key={integration.label}
              href={integration.href}
              className="flex items-center gap-2 p-4 transition hover:bg-slate-50 md:p-3"
            >
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${integration.icon_bg} ${integration.icon_color}`}
              >
                <DashboardIcon name={integration.icon} size={20} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-700">
                  {integration.label}
                </p>
                <p
                  className={`text-xs font-bold ${
                    integration.active ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {integration.state_label}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
