"use client";

import DashboardIcon, { type DashboardIconName } from "./DashboardIcon";

type DashboardStatCardsProps = {
  loading: boolean;
  total_bookings: number;
  team_members_display: string;
  reminders_display: string;
  reminders_secondary: string;
};

const STATS: readonly {
  label: string;
  icon: DashboardIconName;
  hint: string;
  bg: string;
  accent: string;
  pill: string;
}[] = [
  {
    label: "Total Bookings",
    icon: "calendar",
    hint: "All time workspace total",
    bg: "from-sky-50 to-blue-50",
    accent: "from-sky-500 to-blue-600",
    pill: "Total",
  },
  {
    label: "Today Revenue",
    icon: "credit",
    hint: "Coming soon",
    bg: "from-emerald-50 to-teal-50",
    accent: "from-emerald-500 to-teal-600",
    pill: "Soon",
  },
  {
    label: "Team Active",
    icon: "users",
    hint: "Team members in workspace",
    bg: "from-violet-50 to-indigo-50",
    accent: "from-violet-500 to-indigo-600",
    pill: "Roster",
  },
  {
    label: "Reminders Sent",
    icon: "message",
    hint: "Today bookings with reminder sent",
    bg: "from-orange-50 to-rose-50",
    accent: "from-orange-500 to-rose-500",
    pill: "Today",
  },
];

export default function DashboardStatCards({
  loading,
  total_bookings,
  team_members_display,
  reminders_display,
  reminders_secondary,
}: DashboardStatCardsProps) {
  const values = [
    loading ? "…" : String(total_bookings),
    "—",
    loading ? "…" : team_members_display,
    loading ? "…" : reminders_display,
  ];
  const secondaries = [
    STATS[0].hint,
    STATS[1].hint,
    STATS[2].hint,
    reminders_secondary || STATS[3].hint,
  ];

  return (
    <section
      aria-label="dashboard-metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {STATS.map((stat, index) => (
        <article
          key={stat.label}
          className={`group rounded-[28px] border border-white bg-gradient-to-br ${stat.bg} p-5 shadow-lg shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
        >
          <div className="mb-5 flex items-center justify-between">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${stat.accent} p-3 text-white shadow-lg`}
            >
              <DashboardIcon name={stat.icon} size={22} />
            </div>
            <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black text-emerald-600">
              {stat.pill}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500">{stat.label}</p>
          <h3 className="mt-1 text-3xl font-black tracking-tight text-slate-900">
            {values[index]}
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">{secondaries[index]}</p>
        </article>
      ))}
    </section>
  );
}
