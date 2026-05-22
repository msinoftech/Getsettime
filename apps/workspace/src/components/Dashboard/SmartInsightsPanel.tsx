"use client";

import DashboardIcon from "./DashboardIcon";

export default function SmartInsightsPanel({
  bookings_by_status,
  week_day_labels,
  bookings_by_day,
}: {
  bookings_by_status: Record<string, number>;
  week_day_labels: string[];
  bookings_by_day: number[];
}) {
  const peak_day = (): string => {
    if (week_day_labels.length !== 7 || bookings_by_day.length !== 7) return "—";
    let maxIdx = 0;
    for (let i = 1; i < bookings_by_day.length; i++) {
      if (bookings_by_day[i] > bookings_by_day[maxIdx]) maxIdx = i;
    }
    const label = week_day_labels[maxIdx] || "—";
    return `${label} (${bookings_by_day[maxIdx] ?? 0} bookings this window)`;
  };

  const cancelled =
    (bookings_by_status["cancelled"] ?? 0) + (bookings_by_status["no-show"] ?? 0);

  const insights = [
    `Peak weekday in this dashboard window: ${peak_day()}`,
    cancelled > 0
      ? `${cancelled} cancelled or no-show booking(s) in workspace totals`
      : "No cancelled bookings in aggregated stats",
    "Revenue insights and WhatsApp delivery rates coming soon.",
  ];

  return (
    <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-5 text-white shadow-xl shadow-slate-300/60">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-black">Smart Insights</h3>
        <DashboardIcon name="spark" className="text-yellow-300" />
      </div>
      <div className="space-y-3">
        {insights.map((item) => (
          <div key={item} className="flex gap-3 rounded-2xl bg-white/10 p-4">
            <DashboardIcon name="spark" size={17} className="mt-0.5 shrink-0 text-yellow-300" />
            <p className="text-sm font-bold leading-5 text-white/85">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
