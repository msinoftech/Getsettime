"use client";
import React, { useEffect, useMemo, useState } from "react";

type BookingItem = {
  id: string;
  invitee_name: string | null;
  start_at: string | null;
  status: string | null;
  event_types?: {
    title: string;
  } | null;
};

type BookingApiResponse = {
  data?: BookingItem[];
};

type CalendarCell = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildCalendarCells(viewDate: Date): CalendarCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDayOfMonth.getDay();

  const cells: CalendarCell[] = [];

  for (let i = startWeekday - 1; i >= 0; i -= 1) {
    const dayNumber = daysInPrevMonth - i;
    cells.push({
      date: new Date(year, month - 1, dayNumber),
      dayNumber,
      isCurrentMonth: false,
    });
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push({
      date: new Date(year, month, dayNumber),
      dayNumber,
      isCurrentMonth: true,
    });
  }

  let nextMonthDay = 1;
  while (cells.length < 42) {
    cells.push({
      date: new Date(year, month + 1, nextMonthDay),
      dayNumber: nextMonthDay,
      isCurrentMonth: false,
    });
    nextMonthDay += 1;
  }

  return cells;
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusBadgeClass(status: string | null): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "bg-emerald-100 text-emerald-700";
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "cancelled":
      return "bg-rose-100 text-rose-700";
    case "reschedule":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function BookingCalendar() {
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [bookingsByDay, setBookingsByDay] = useState<Record<string, BookingItem[]>>(
    {},
  );
  const [loading, setLoading] = useState(false);

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const monthLabel = useMemo(
    () =>
      viewDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewDate],
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || !active) {
          if (active) setBookingsByDay({});
          return;
        }

        const startOfMonth = new Date(
          viewDate.getFullYear(),
          viewDate.getMonth(),
          1,
        );
        const endOfMonth = new Date(
          viewDate.getFullYear(),
          viewDate.getMonth() + 1,
          0,
        );
        const params = new URLSearchParams({
          start_date: toDateKey(startOfMonth),
          end_date: toDateKey(endOfMonth),
        });

        const res = await fetch(`/api/bookings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!active) return;
        if (!res.ok) {
          setBookingsByDay({});
          return;
        }

        const json = (await res.json()) as BookingApiResponse;
        const grouped: Record<string, BookingItem[]> = {};

        for (const booking of json.data ?? []) {
          if (!booking.start_at) continue;
          const date = new Date(booking.start_at);
          const key = toDateKey(date);
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(booking);
        }

        Object.values(grouped).forEach((items) =>
          items.sort((a, b) => {
            const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
            const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
            return aTime - bTime;
          }),
        );

        setBookingsByDay(grouped);
      } catch {
        if (active) setBookingsByDay({});
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [viewDate]);

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Calendar</h3>
          <p className="mt-1 text-sm text-slate-500">
            Full month bookings grouped by date
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
          }
          className="rounded-full bg-[#dfe3ef] px-4 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-[#d6dced]"
        >
          Today
        </button>
      </div>

      <div className="rounded-xl border border-[#dce1ec] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.15),_transparent_30%),linear-gradient(180deg,#f8faff_0%,#eef2ff_100%)] p-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] sm:p-5">
        <div className="mb-4 flex items-center justify-between text-neutral-900">
          <button
            type="button"
            onClick={() =>
              setViewDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white"
            aria-label="Show previous month"
          >
            <svg
              className="h-4 w-4 transition-all duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="px-2 text-center text-base font-semibold text-slate-700">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={() =>
              setViewDate(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white"
            aria-label="Show next month"
          >
            <svg
              className="h-4 w-4 transition-all duration-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-medium text-slate-500 sm:text-sm">
          {WEEK_DAYS.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="space-y-2">
          {weeks.map((row, rowIndex) => (
            <div key={`${monthLabel}-${rowIndex}`} className="grid grid-cols-7 gap-2">
              {row.map((cell) => {
                const key = toDateKey(cell.date);
                const dayBookings = bookingsByDay[key] ?? [];
                const isToday = toDateKey(today) === key;
                const isMuted = !cell.isCurrentMonth;

                return (
                  <div
                    key={cell.date.toISOString()}
                    className={`min-h-28 rounded-lg border p-2 sm:min-h-32 ${
                      isMuted
                        ? "border-slate-200 bg-slate-50/70"
                        : "border-[#dce1ec] bg-white/80"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? "bg-indigo-600 text-white"
                            : isMuted
                              ? "text-slate-400"
                              : "text-slate-700"
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {dayBookings.length > 0 && (
                        <span className="text-[10px] font-semibold text-indigo-700">
                          {dayBookings.length} booking
                          {dayBookings.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      {dayBookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                          title={booking.invitee_name ?? "Booking"}
                        >
                          <p className="truncate text-[10px] font-medium text-slate-700">
                            {booking.start_at
                              ? new Date(booking.start_at).toLocaleTimeString(
                                  "en-US",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )
                              : "--:--"}
                            {" · "}
                            {booking.invitee_name?.trim() || "Guest"}
                          </p>
                          <p className="truncate text-[10px] text-slate-500">
                            {booking.event_types?.title || "Appointment"}
                          </p>
                          <span
                            className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold ${getStatusBadgeClass(
                              booking.status,
                            )}`}
                          >
                            {booking.status || "unknown"}
                          </span>
                        </div>
                      ))}

                      {dayBookings.length > 3 && (
                        <p className="text-[10px] font-medium text-slate-500">
                          +{dayBookings.length - 3} more
                        </p>
                      )}

                      {!loading && dayBookings.length === 0 && cell.isCurrentMonth && (
                        <p className="pt-1 text-[10px] text-slate-400">No bookings</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
