"use client";

import { useMemo } from "react";

export default function WeeklyPerformanceChart({
  loading,
  week_day_labels,
  bookings_by_day,
}: {
  loading: boolean;
  week_day_labels: string[];
  bookings_by_day: number[];
}) {
  const { labels, normalized, peak_index, avg, avg_height_pct, chart_max } = useMemo(() => {
    const labels_resolved =
      week_day_labels.length === 7
        ? week_day_labels.slice()
        : [...week_day_labels, ...Array.from({ length: 7 }).map(() => "")].slice(0, 7);
    const data =
      bookings_by_day.length === 7
        ? bookings_by_day.slice()
        : [...bookings_by_day, ...Array(7 - bookings_by_day.length).fill(0)].slice(
            0,
            7,
          );
    const max_val = Math.max(1, ...data);
    const sum = data.reduce((a, b) => a + b, 0);
    const average = sum / data.length;
    const peakIdx = data.indexOf(Math.max(...data));
    const pct = `${(average / max_val) * 100}%`;

    return {
      labels: labels_resolved,
      normalized: data,
      peak_index: peakIdx,
      avg: average,
      avg_height_pct: pct,
      chart_max: max_val,
    };
  }, [week_day_labels, bookings_by_day]);

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Weekly Performance</h3>
          {!loading ? (
            <p className="text-sm font-semibold text-slate-500">
              Peak day: {labels[peak_index]} · {normalized[peak_index]} bookings
            </p>
          ) : (
            <p className="text-sm font-semibold text-slate-500">Loading booking trend…</p>
          )}
        </div>
        <span className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
          {loading ? "…" : `Avg ${avg.toFixed(1)}`}
        </span>
      </div>
      <div className="relative flex h-72 items-end gap-3 rounded-[26px] bg-gradient-to-br from-slate-50 to-indigo-50 p-5">
        {loading ? (
          <div className="flex flex-1 items-end justify-around gap-2">
            {Array.from({ length: 7 }).map((_, idx) => (
              <div
                key={`sk-${idx}`}
                className="h-[40%] w-full max-w-12 animate-pulse rounded-t-2xl bg-slate-200"
              />
            ))}
          </div>
        ) : (
          <>
            <div
              className="absolute left-5 right-5 border-t border-dashed border-indigo-300/70"
              style={{ bottom: `calc(${avg_height_pct} + 20px)` }}
            >
              <span className="absolute -top-3 right-0 rounded-full bg-white px-2 text-[10px] font-black text-indigo-500 shadow-sm">
                Average
              </span>
            </div>
            {normalized.map((value, index) => (
              <div
                key={`${labels[index]}-${index}`}
                className="group z-10 flex h-full flex-1 flex-col justify-end gap-3"
              >
                <div className="relative flex flex-1 items-end justify-center">
                  <div className="absolute -top-8 rounded-xl bg-slate-950 px-2 py-1 text-xs font-black text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    {value}
                  </div>
                  <div
                    className={`w-full max-w-12 rounded-t-2xl shadow-lg transition-all duration-300 ${
                      index === peak_index
                        ? "bg-gradient-to-t from-emerald-500 to-teal-300 shadow-emerald-500/20"
                        : "bg-gradient-to-t from-indigo-600 to-sky-400 shadow-indigo-500/20 hover:from-violet-600 hover:to-blue-400"
                    }`}
                    style={{ height: `${(value / chart_max) * 100}%` }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-500">{labels[index]}</p>
                  {index === peak_index ? (
                    <p className="text-[10px] font-black text-emerald-600">Peak</p>
                  ) : null}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
