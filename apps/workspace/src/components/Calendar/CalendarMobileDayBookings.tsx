"use client";

import { useMemo, useState } from "react";
import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import { StatusBadge } from "@/src/components/Booking/StatusBadge";

type CalendarMobileDayBookingsProps = {
  selectedDate: Date;
  bookings: Booking[];
  loading: boolean;
  onSelectBooking: (booking: Booking) => void;
  selectedBookingId?: string;
  onGoToToday?: () => void;
};

const MAX_VISIBLE_PER_HOUR = 2;

function getGuestName(booking: Booking): string {
  return (
    booking.invitee_name?.trim() ||
    booking.contacts?.name?.trim() ||
    "Guest"
  );
}

function getDurationLabel(booking: Booking): string {
  const start = booking.start_at ? new Date(booking.start_at).getTime() : 0;
  const end = booking.end_at ? new Date(booking.end_at).getTime() : 0;
  if (start > 0 && end > start) {
    return `${Math.round((end - start) / 60000)} min`;
  }
  const fallback = booking.event_types?.duration_minutes;
  return fallback ? `${fallback} min` : "—";
}

function getServiceLabel(booking: Booking): string {
  return booking.event_types?.title?.trim() || "Appointment";
}

function getProviderLabel(booking: Booking): string {
  return booking.service_provider_name?.trim() || "—";
}

function getCardClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "border-blue-100 bg-indigo-50";
    case "pending":
      return "border-amber-100 bg-amber-50";
    case "cancelled":
      return "border-rose-100 bg-rose-50";
    case "completed":
      return "border-emerald-100 bg-emerald-50";
    case "reschedule":
      return "border-indigo-100 bg-indigo-50";
    case "no_show":
    case "no-show":
    case "noshow":
      return "border-violet-100 bg-violet-50";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function formatHourParts(hour24: number): { time: string; period: string } {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { time: `${hour12}:00`, period };
}

function getBookingHour(booking: Booking): number | null {
  if (!booking.start_at) return null;
  return new Date(booking.start_at).getHours();
}

function getBookingMinute(booking: Booking): number {
  if (!booking.start_at) return 0;
  return new Date(booking.start_at).getMinutes();
}

function DayBookingCard({
  booking,
  selected,
  onSelect,
}: {
  booking: Booking;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex min-w-0 flex-1 items-start gap-2 rounded-xl border px-3 py-2.5 text-left transition hover:brightness-[0.98] ${getCardClass(
        booking.status,
      )} ${selected ? "ring-2 ring-indigo-300" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex gap-2 truncate text-xs">
          <span className="font-medium text-slate-600">
            {booking.start_at ? formatTime(booking.start_at) : "—"}
          </span>
          <span className="font-bold text-slate-900">{getGuestName(booking)}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {getServiceLabel(booking)} • {getDurationLabel(booking)} •{" "}
          {getProviderLabel(booking)}
        </p>
      </div>
      <StatusBadge
        status={booking.status || "pending"}
        className="shrink-0 !rounded-full !px-2.5 !py-0.5"
      />
    </button>
  );
}

export function CalendarMobileDayBookings({
  selectedDate,
  bookings,
  loading,
  onSelectBooking,
  selectedBookingId,
  onGoToToday,
}: CalendarMobileDayBookingsProps) {
  const [expandedHours, setExpandedHours] = useState<Set<number>>(new Set());

  const dayTitle = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const isToday =
    selectedDate.getFullYear() === new Date().getFullYear() &&
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getDate() === new Date().getDate();

  const bookingsByHour = useMemo(() => {
    const map = new Map<number, Booking[]>();
    for (const booking of bookings) {
      const hour = getBookingHour(booking);
      if (hour == null) continue;
      const list = map.get(hour) ?? [];
      list.push(booking);
      map.set(hour, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        const t1 = a.start_at ? new Date(a.start_at).getTime() : 0;
        const t2 = b.start_at ? new Date(b.start_at).getTime() : 0;
        return t1 - t2;
      });
    }
    return map;
  }, [bookings]);

  const hourSlots = useMemo(
    () => Array.from(bookingsByHour.keys()).sort((a, b) => a - b),
    [bookingsByHour],
  );

  const toggleHourExpanded = (hour: number) => {
    setExpandedHours((prev) => {
      const next = new Set(prev);
      if (next.has(hour)) next.delete(hour);
      else next.add(hour);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-800">{dayTitle}</h3>
        {onGoToToday && (
          <button
            type="button"
            onClick={onGoToToday}
            className={`shrink-0 text-sm font-semibold transition ${
              isToday
                ? "cursor-default text-indigo-600"
                : "text-indigo-600 hover:text-indigo-700"
            }`}
            disabled={isToday}
          >
            Today
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`day-loading-${index}`} className="flex gap-3">
              <div className="h-10 w-12 animate-pulse rounded bg-slate-100" />
              <div className="h-14 flex-1 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      ) : hourSlots.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          No bookings for this day
        </div>
      ) : (
        <div>
          {hourSlots.map((hour) => {
            const hourBookings = bookingsByHour.get(hour) ?? [];
            const expanded = expandedHours.has(hour);
            const visibleBookings = expanded
              ? hourBookings
              : hourBookings.slice(0, MAX_VISIBLE_PER_HOUR);
            const overflowCount = hourBookings.length - visibleBookings.length;
            const { time, period } = formatHourParts(hour);

            const halfBuckets = new Map<number, Booking[]>();
            for (const booking of visibleBookings) {
              const bucket = Math.floor(getBookingMinute(booking) / 30);
              const list = halfBuckets.get(bucket) ?? [];
              list.push(booking);
              halfBuckets.set(bucket, list);
            }
            const rows = Array.from(halfBuckets.entries())
              .sort(([a], [b]) => a - b)
              .map(([, items]) => items);

            return (
              <div
                key={hour}
                className="grid grid-cols-[3.25rem_minmax(0,1fr)] border-b border-slate-100 last:border-b-0"
              >
                <div className="flex h-full flex-col border-r border-slate-100 p-3 text-center leading-tight">
                  <p className="text-xs font-semibold text-slate-700">{time}</p>
                  <p className="text-[10px] font-medium text-slate-400">{period}</p>
                </div>

                <div className="min-w-0 space-y-2 p-3">
                  {rows.map((row, rowIndex) => (
                    <div
                      key={`${hour}-row-${rowIndex}`}
                      className={`grid gap-2 ${
                        row.length > 1 ? "grid-cols-1 min-[600px]:grid-cols-2" : "grid-cols-1"
                      }`}
                    >
                      {row.map((booking) => (
                        <DayBookingCard
                          key={booking.id}
                          booking={booking}
                          selected={selectedBookingId === booking.id}
                          onSelect={() => onSelectBooking(booking)}
                        />
                      ))}
                    </div>
                  ))}

                  {overflowCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleHourExpanded(hour)}
                      className="text-left text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      +{overflowCount} more
                    </button>
                  )}

                  {expanded && hourBookings.length > MAX_VISIBLE_PER_HOUR && (
                    <button
                      type="button"
                      onClick={() => toggleHourExpanded(hour)}
                      className="text-left text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
