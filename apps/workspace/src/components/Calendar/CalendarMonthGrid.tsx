"use client";

import Link from "next/link";
import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import type { CalendarCell } from "@/src/components/Calendar/calendar_utils";
import {
  getStatusPillClass,
  toDateKey,
  WEEK_DAYS,
} from "@/src/components/Calendar/calendar_utils";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarMonthGridProps = {
  rows: CalendarCell[][];
  bookingsByDay: Record<string, Booking[]>;
  loading: boolean;
  today: Date;
  monthLabel: string;
};

export function CalendarMonthGrid({
  rows,
  bookingsByDay,
  loading,
  today,
  monthLabel,
}: CalendarMonthGridProps) {
  const todayKey = toDateKey(today);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="px-2 py-4 text-center text-sm font-semibold text-slate-600"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="space-y-0">
        {rows.map((row, rowIndex) => (
          <div
            key={`${monthLabel}-${rowIndex}`}
            className="grid grid-cols-7 border-b border-slate-200 last:border-b-0"
          >
            {row.map((cell) => {
              const dateKey = toDateKey(cell.date);
              const dayBookings = bookingsByDay[dateKey] ?? [];
              const isCurrentMonth = cell.isCurrentMonth;
              const isToday = dateKey === todayKey;

              return (
                <div
                  key={cell.date.toISOString()}
                  className={cn(
                    "min-h-[160px] border-r border-slate-200 p-2.5 last:border-r-0",
                    isCurrentMonth ? "bg-white" : "bg-slate-50/80",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between gap-1">
                    <div
                      className={cn(
                        "inline-flex h-8 min-w-[32px] items-center justify-center rounded-full px-2 text-sm font-semibold",
                        isToday
                          ? "bg-indigo-600 text-white"
                          : isCurrentMonth
                            ? "text-slate-800"
                            : "text-slate-400",
                      )}
                    >
                      {cell.dayNumber}
                    </div>

                    {!loading && dayBookings.length > 0 && (
                      <span className="shrink-0 text-[11px] font-semibold text-indigo-600">
                        {dayBookings.length} booking
                        {dayBookings.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div
                    className={cn(
                      "space-y-2",
                      loading && "pointer-events-none opacity-60",
                    )}
                  >
                    {!loading &&
                      dayBookings.length === 0 &&
                      cell.isCurrentMonth && (
                        <p className="text-xs text-slate-400">No bookings</p>
                      )}

                    {loading && cell.isCurrentMonth && (
                      <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                    )}

                    {!loading && dayBookings.length > 0 && (
                      <>
                        {dayBookings.slice(0, 2).map((booking) => (
                          <Link
                            key={booking.id}
                            href={`/bookings/${booking.id}`}
                            className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-2.5 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                          >
                            <div className="text-[11px] font-semibold text-slate-800">
                              {booking.start_at
                                ? formatTime(booking.start_at)
                                : "—"}
                            </div>
                            <div className="mt-1 truncate text-xs font-semibold text-slate-700">
                              {booking.invitee_name?.trim() ||
                                booking.contacts?.name?.trim() ||
                                "Guest"}
                            </div>
                            <div className="truncate text-[11px] text-slate-500">
                              {booking.event_types?.title || "Appointment"}
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold capitalize",
                                  getStatusPillClass(booking.status),
                                )}
                              >
                                {booking.status?.replace("-", " ") || "pending"}
                              </span>
                            </div>
                          </Link>
                        ))}

                        {dayBookings.length > 2 && (
                          <div className="w-full rounded-xl border border-dashed border-slate-300 px-2 py-2 text-center text-xs font-semibold text-slate-600">
                            +{dayBookings.length - 2} more
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
