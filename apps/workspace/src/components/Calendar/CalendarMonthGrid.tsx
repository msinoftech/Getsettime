"use client";

import { useState } from "react";
import type { RefObject } from "react";
import { BookingPreviewPanel } from "@/src/components/Booking/BookingPreviewPanel";
import type { Booking } from "@/src/types/booking";
import type { CalendarCell } from "@/src/components/Calendar/calendar_utils";
import {
  CALENDAR_MONTH_CHIP_VISIBILITY_CLASS,
  CALENDAR_MONTH_VISIBLE_COUNT,
} from "@/src/components/Calendar/calendar_booking_layout";
import {
  toDateKey,
  WEEK_DAYS,
} from "@/src/components/Calendar/calendar_utils";
import { CalendarMonthBookingChip } from "@/src/components/Calendar/CalendarMonthBookingChip";
import { CalendarMonthDayBookingsPopover } from "@/src/components/Calendar/CalendarMonthDayBookingsPopover";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarMonthGridProps = {
  rows: CalendarCell[][];
  bookingsByDay: Record<string, Booking[]>;
  loading: boolean;
  today: Date;
  monthLabel: string;
  todayCellRef?: RefObject<HTMLDivElement | null>;
};

export function CalendarMonthGrid({
  rows,
  bookingsByDay,
  loading,
  today,
  monthLabel,
  todayCellRef,
}: CalendarMonthGridProps) {
  const todayKey = toDateKey(today);
  const [preview_booking, set_preview_booking] = useState<Booking | null>(null);
  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-sm font-semibold text-slate-900"
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
                    ref={isToday ? todayCellRef : undefined}
                    className={cn(
                      "min-h-[140px] border-r border-slate-200 p-2 last:border-r-0",
                      isToday
                        ? "bg-indigo-50/60 ring-2 ring-inset ring-indigo-500"
                        : isCurrentMonth
                          ? "bg-white"
                          : "bg-slate-50/80",
                    )}
                  >
                    <div className="mb-1.5">
                      <div
                        className={cn(
                          "inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-1.5 text-sm font-semibold",
                          isToday
                            ? "bg-indigo-600 text-white"
                            : isCurrentMonth
                              ? "text-slate-800"
                              : "text-slate-400",
                        )}
                      >
                        {cell.dayNumber}
                      </div>
                    </div>
                    
                    <div
                      className={cn(
                        "space-y-1",
                        loading && "pointer-events-none opacity-60",
                      )}
                    >
                      {loading && cell.isCurrentMonth && (
                        <div className="h-6 animate-pulse rounded-md bg-slate-100" />
                      )}

                      {!loading && dayBookings.length > 0 && (
                        <>
                          {dayBookings.slice(0, CALENDAR_MONTH_VISIBLE_COUNT).map((booking, index) => (
                            <div
                              key={booking.id}
                              className={CALENDAR_MONTH_CHIP_VISIBILITY_CLASS[index]}
                            >
                              <CalendarMonthBookingChip
                                booking={booking}
                                onClick={() => set_preview_booking(booking)}
                              />
                            </div>
                          ))}

                          <CalendarMonthDayBookingsPopover
                            date={cell.date}
                            bookings={dayBookings}
                            onBookingClick={set_preview_booking}
                          />
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
      <BookingPreviewPanel
        open={preview_booking != null}
        onClose={() => set_preview_booking(null)}
        booking={preview_booking}
      />
    </>
  );
}