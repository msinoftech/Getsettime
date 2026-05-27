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
    <div className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-slate-950 p-5 pb-28 text-white shadow-xl shadow-slate-300/60">
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

      {/* Decorative bottom chart graphic (purely visual) */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-60"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 700 220"
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <defs>
            <linearGradient id="insightLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.75" />
            </linearGradient>
            <linearGradient id="insightBars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#2563eb" stopOpacity="0.12" />
            </linearGradient>
          </defs>

          <path
            d="M0 120 C70 150 120 70 210 90 C240 100 290 60 350 50 C410 40 450 90 500 60 C570 1 620 50 700 88"
            stroke="url(#insightLine)"
            strokeWidth="5"
            fill="none"
          />

          <rect x="55" y="135" width="65" height="75" rx="16" fill="url(#insightBars)" opacity="0.55" />
          <rect x="160" y="112" width="65" height="98" rx="16" fill="url(#insightBars)" opacity="0.62" />
          <rect x="260" y="125" width="65" height="85" rx="16" fill="url(#insightBars)" opacity="0.52" />
          <rect x="360" y="80" width="65" height="130" rx="16" fill="url(#insightBars)" opacity="0.68" />
          <rect x="460" y="108" width="65" height="102" rx="16" fill="url(#insightBars)" opacity="0.6" />
          <rect x="560" y="70" width="65" height="140" rx="16" fill="url(#insightBars)" opacity="0.7" />
        </svg>
      </div>
    </div>
  );
}
