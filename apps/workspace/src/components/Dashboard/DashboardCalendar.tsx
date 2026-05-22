"use client";

import { useMemo } from "react";
import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";
import {
  WEEK_DAYS,
  buildCalendarCells,
  toDateKey,
  type CalendarCell,
} from "@/src/components/Calendar/calendar_utils";

function same_calendar_day(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function DashboardCalendar({
  view_date,
  selected_date,
  on_view_date_month_first,
  on_select_date,
  month_bookings,
  month_loading,
}: {
  view_date: Date;
  selected_date: Date;
  on_view_date_month_first: (month_start: Date) => void;
  on_select_date: (date: Date) => void;
  month_bookings: Booking[];
  month_loading: boolean;
}) {
  const today_ref = useMemo(() => new Date(), []);
  const busy_keys = useMemo(() => {
    const set = new Set<string>();
    for (const b of month_bookings) {
      if (!b.start_at) continue;
      set.add(toDateKey(new Date(b.start_at)));
    }
    return set;
  }, [month_bookings]);

  const selected_key = toDateKey(selected_date);
  const day_preview = useMemo(() => {
    return month_bookings
      .filter((b) => b.start_at && toDateKey(new Date(b.start_at)) === selected_key)
      .sort((a, b) => {
        const ta = a.start_at ? new Date(a.start_at).getTime() : 0;
        const tb = b.start_at ? new Date(b.start_at).getTime() : 0;
        return ta - tb;
      });
  }, [month_bookings, selected_key]);

  const cells = useMemo(() => buildCalendarCells(view_date), [view_date]);
  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const month_label = view_date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const bookings_today_count = month_bookings.filter((b) => {
    if (!b.start_at) return false;
    return same_calendar_day(new Date(b.start_at), today_ref);
  }).length;

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">Calendar</h3>
          <p className="text-sm font-semibold text-slate-500">
            Click date to preview bookings
          </p>
        </div>
        <button
          type="button"
          className="rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-600"
          onClick={() => {
            const t = new Date();
            on_select_date(t);
            on_view_date_month_first(new Date(t.getFullYear(), t.getMonth(), 1));
          }}
        >
          Today
        </button>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() =>
            on_view_date_month_first(
              new Date(view_date.getFullYear(), view_date.getMonth() - 1, 1),
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white"
          aria-label="Previous month"
        >
          <DashboardIcon name="chevronLeft" />
        </button>
        <div className="text-center">
          <h3 className="text-xl font-black text-slate-900">{month_label}</h3>
          <p className="text-xs font-bold text-slate-400">
            {month_loading ? "Loading…" : `${bookings_today_count} booking(s) today`}
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            on_view_date_month_first(
              new Date(view_date.getFullYear(), view_date.getMonth() + 1, 1),
            )
          }
          className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white"
          aria-label="Next month"
        >
          <DashboardIcon name="chevronRight" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 text-center">
        {WEEK_DAYS.map((day) => (
          <p key={day} className="py-2 text-xs font-black text-slate-500">
            {day}
          </p>
        ))}
        {weeks.map((row, row_index) =>
          row.map((cell) => {
            const is_selected = same_calendar_day(cell.date, selected_date);
            const is_muted = !cell.isCurrentMonth;
            const key = toDateKey(cell.date);
            const is_busy = busy_keys.has(key) && !is_muted;

            return (
              <button
                key={`${month_label}-${row_index}-${cell.date.toISOString()}`}
                type="button"
                onClick={() => {
                  on_select_date(cell.date);
                  if (!cell.isCurrentMonth) {
                    on_view_date_month_first(
                      new Date(cell.date.getFullYear(), cell.date.getMonth(), 1),
                    );
                  }
                }}
                className={`relative flex h-11 items-center justify-center rounded-2xl text-sm font-black transition ${
                  is_selected
                    ? "bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30"
                    : is_muted
                      ? "text-slate-300"
                      : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
                }`}
              >
                {cell.dayNumber}
                {is_busy && !is_selected ? (
                  <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                ) : null}
              </button>
            );
          }),
        )}
      </div>

      <div className="mt-5 rounded-[24px] bg-indigo-50 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-black text-slate-900">
            {selected_date.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </p>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-600">
            {day_preview.length} Booking{day_preview.length !== 1 ? "s" : ""}
          </span>
        </div>
        {month_loading ? (
          <p className="text-sm font-bold text-slate-400">Loading…</p>
        ) : day_preview.length === 0 ? (
          <p className="text-sm font-bold text-slate-400">No bookings on this date.</p>
        ) : (
          <div className="space-y-2 text-sm font-bold text-slate-600">
            {day_preview.map((pb) => {
              const tl = pb.start_at
                ? new Date(pb.start_at).toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                  })
                : "—";
              const guest =
                pb.invitee_name?.trim() || pb.contacts?.name?.trim() || "Guest";
              return (
                <p key={pb.id}>
                  {tl} · {guest}
                </p>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
