"use client";

import DashboardIcon, { type DashboardIconName } from "./DashboardIcon";
import ScreenGate from "../ScreenGate";
export type StatTrend = { direction: "up" | "down"; percent: number };

type DashboardStatCardsProps = {
  loading: boolean;
  bookings_label: string;
  bookings_count: number;
  bookings_trend?: StatTrend;
  upcoming_count: number;
  upcoming_hint?: string;
  available_slots_display: string;
  available_slots_hint?: string;
  no_shows_count: number;
  no_shows_hint?: string;
};

type StatCardConfig = {
  label: string;
  icon: DashboardIconName;
  hint: string;
  icon_bg: string;
  icon_color: string;
};

const STAT_CARDS: readonly StatCardConfig[] = [
  {
    label: "Today's Bookings",
    icon: "calendar",
    hint: "Scheduled for today",
    icon_bg: "bg-indigo-50",
    icon_color: "text-indigo-600",
  },
  {
    label: "Upcoming Bookings",
    icon: "calendarDays",
    hint: "Across all future dates",
    icon_bg: "bg-sky-50",
    icon_color: "text-sky-600",
  },
  {
    label: "Available Slots",
    icon: "clock",
    hint: "Coming soon",
    icon_bg: "bg-emerald-50",
    icon_color: "text-emerald-600",
  },
  {
    label: "No-shows",
    icon: "user",
    hint: "All-time workspace total",
    icon_bg: "bg-red-50",
    icon_color: "text-red-600",
  },
];

function TrendLine({ trend, hint }: { trend?: StatTrend; hint: string }) {
  if (!trend) {
    return <p className="text-sm text-slate-500">{hint}</p>;
  }
  const is_up = trend.direction === "up";
  return (
    <p className="flex flex-wrap items-center gap-1 text-sm">
      <span className={`inline-flex items-center font-medium gap-0.5 ${ is_up ? "text-emerald-700" : "text-red-600" }`}>
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
      <span className="text-slate-500">vs yesterday</span>
    </p>
  );
}

export default function DashboardStatCards({
  loading,
  bookings_label,
  bookings_count,
  bookings_trend,
  upcoming_count,
  upcoming_hint,
  available_slots_display,
  available_slots_hint,
  no_shows_count,
  no_shows_hint,
}: DashboardStatCardsProps) {
  const labels = [
    bookings_label,
    STAT_CARDS[1].label,
    STAT_CARDS[2].label,
    STAT_CARDS[3].label,
  ];
  const hints = [
    STAT_CARDS[0].hint,
    upcoming_hint ?? STAT_CARDS[1].hint,
    available_slots_hint ?? STAT_CARDS[2].hint,
    no_shows_hint ?? STAT_CARDS[3].hint,
  ];
  const values = [
    loading ? "…" : String(bookings_count),
    loading ? "…" : String(upcoming_count),
    loading ? "…" : available_slots_display,
    loading ? "…" : String(no_shows_count),
  ];
  const trends: (StatTrend | undefined)[] = [
    loading ? undefined : bookings_trend,
    undefined,
    undefined,
    undefined,
  ];

  return (
    <section aria-label="dashboard-metrics" className="grid max-[450px]:gap-2 gap-4 grid-cols-2 md:grid-cols-4">
      {STAT_CARDS.map((stat, index) => (
        <article key={stat.label} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm transition duration-300 hover:shadow-md">
          <div className="flex items-start xl:items-center flex-col sm:flex-row sm:gap-2 gap-2">
            <div className="flex items-center gap-2">
              <div className={`flex h-10 w-10 xl:h-20 xl:w-20 shrink-0 items-center justify-center max-[450px]:rounded-xl rounded-2xl ${stat.icon_bg} ${stat.icon_color}`}>
                <DashboardIcon name={stat.icon} className="h-5 w-5 xl:h-10 xl:w-10" />
              </div>
              <ScreenGate maxWidth={639}>
              <h3 className="text-xl xl:text-3xl font-bold leading-tight tracking-tight text-slate-900">{values[index]}</h3>
              </ScreenGate>
            </div>
            <div className="min-w-0 flex flex-col">
              <p className="truncate text-sm font-semibold text-slate-500">{labels[index]}</p>
              <ScreenGate minWidth={640}>
              <h3 className="text-xl xl:text-3xl font-bold leading-tight tracking-tight text-slate-900">{values[index]}</h3>
              </ScreenGate>
              <TrendLine trend={trends[index]} hint={hints[index]} />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
