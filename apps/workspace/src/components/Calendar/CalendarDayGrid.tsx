"use client";

import { useMemo } from "react";
import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import {
  createdByDisplayLabel,
  getStatusCalendarChipClass,
  getStatusDotClass,
  toDateKey,
} from "@/src/components/Calendar/calendar_utils";

type CalendarDayGridProps = {
  viewDate: Date;
  bookings: Booking[];
  providerColumns: Array<{
    key: string;
    label: string;
    department?: string;
    avatarUrl?: string | null;
  }>;
  loading: boolean;
  timezoneLabel: string;
  onSelectBooking: (booking: Booking) => void;
  selectedBookingId?: string;
};

type PositionedBooking = {
  booking: Booking;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
};

const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_HEIGHT = 32;
const PX_PER_MINUTE = SLOT_HEIGHT / 30;
const DAY_MINUTE_START = START_HOUR * 60;
const DAY_MINUTE_END = END_HOUR * 60;
const GRID_HEIGHT = ((END_HOUR - START_HOUR) * 60) / 30 * SLOT_HEIGHT;
const STACK_GAP_PX = 6;
const LOADING_COLUMN_COUNT = 4;

function toMinuteOfDay(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function getBookingDurationMinutes(booking: Booking): number {
  const start = booking.start_at ? new Date(booking.start_at).getTime() : 0;
  const end = booking.end_at ? new Date(booking.end_at).getTime() : 0;
  if (start > 0 && end > start) {
    return Math.max(15, Math.round((end - start) / 60000));
  }
  const fallback = booking.event_types?.duration_minutes ?? 30;
  return Math.max(15, fallback);
}

function clampRange(startMinute: number, endMinute: number): [number, number] {
  const clampedStart = Math.max(DAY_MINUTE_START, startMinute);
  const clampedEnd = Math.min(DAY_MINUTE_END, Math.max(endMinute, startMinute + 15));
  return [clampedStart, Math.max(clampedStart + 15, clampedEnd)];
}

function getProviderName(booking: Booking): string {
  return booking.service_provider_name?.trim() || createdByDisplayLabel(booking);
}

function getProviderKey(booking: Booking): string {
  return booking.service_provider_id?.trim() || getProviderName(booking);
}

function getProviderInitial(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "?";
  const cleaned = trimmed.replace(/^(dr\.|mr\.|mrs\.|ms\.)\s+/i, "");
  return (cleaned.charAt(0) || trimmed.charAt(0)).toUpperCase();
}

function positionBookings(bookings: Booking[]): PositionedBooking[] {
  const normalized = bookings
    .map((booking) => {
      const startMinuteRaw = toMinuteOfDay(booking.start_at);
      if (startMinuteRaw == null) return null;
      const durationMinutes = getBookingDurationMinutes(booking);
      const [startMinute, endMinute] = clampRange(
        startMinuteRaw,
        startMinuteRaw + durationMinutes,
      );
      return { booking, startMinute, endMinute };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.endMinute - b.endMinute;
    });

  const placed: PositionedBooking[] = [];
  for (const item of normalized) {
    const baseTop = (item.startMinute - DAY_MINUTE_START) * PX_PER_MINUTE;
    const durationHeight = (item.endMinute - item.startMinute) * PX_PER_MINUTE;
    const contentHeight = 72;
    const height = Math.max(durationHeight, contentHeight);

    let top = baseTop;
    for (const prev of placed) {
      if (top < prev.top + prev.height + STACK_GAP_PX) {
        top = prev.top + prev.height + STACK_GAP_PX;
      }
    }

    placed.push({
      booking: item.booking,
      startMinute: item.startMinute,
      endMinute: item.endMinute,
      top,
      height,
    });
  }

  return placed;
}

function getStatusCardClass(status: string | null | undefined): string {
  const card = getStatusCalendarChipClass(status).chip;
  if (card.includes("blue")) return "border-blue-200 bg-blue-50";
  if (card.includes("emerald")) return "border-emerald-200 bg-emerald-50";
  if (card.includes("amber")) return "border-amber-200 bg-amber-50";
  if (card.includes("rose")) return "border-rose-200 bg-rose-50";
  if (card.includes("violet")) return "border-violet-200 bg-violet-50";
  if (card.includes("indigo")) return "border-indigo-200 bg-indigo-50";
  return "border-slate-200 bg-white";
}

function formatSlotLabel(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${meridiem}`;
}

export function CalendarDayGrid({
  viewDate,
  bookings,
  providerColumns,
  loading,
  timezoneLabel,
  onSelectBooking,
  selectedBookingId,
}: CalendarDayGridProps) {
  const columns = useMemo(
    () =>
      providerColumns.map((provider) => ({
        key: provider.key,
        label: provider.label,
        department: provider.department?.trim() || "—",
        avatarUrl: provider.avatarUrl?.trim() || null,
        initial: getProviderInitial(provider.label),
      })),
    [providerColumns],
  );

  const displayColumnCount = loading
    ? Math.max(columns.length, LOADING_COLUMN_COUNT)
    : Math.max(columns.length, 1);

  const groupedByColumn = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const column of columns) {
      grouped.set(column.key, []);
    }
    for (const booking of bookings) {
      const key = getProviderKey(booking);
      if (!grouped.has(key)) continue;
      grouped.get(key)?.push(booking);
    }
    for (const [key, columnBookings] of grouped.entries()) {
      grouped.set(
        key,
        columnBookings.sort((a, b) => {
          const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
          const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
          return aTime - bTime;
        }),
      );
    }
    return grouped;
  }, [bookings, columns]);

  const positionedByColumn = useMemo(() => {
    const positioned = new Map<string, PositionedBooking[]>();
    for (const column of columns) {
      positioned.set(column.key, positionBookings(groupedByColumn.get(column.key) ?? []));
    }
    return positioned;
  }, [columns, groupedByColumn]);

  const timeSlots = useMemo(() => {
    const slots: Array<{ key: string; label: string; minute: number }> = [];
    for (let minute = DAY_MINUTE_START; minute < DAY_MINUTE_END; minute += 30) {
      slots.push({
        key: `${minute}`,
        label: formatSlotLabel(minute),
        minute,
      });
    }
    return slots;
  }, []);

  const nowLine = useMemo(() => {
    if (loading) return null;
    const now = new Date();
    const isToday = toDateKey(viewDate) === toDateKey(now);
    const minute = now.getHours() * 60 + now.getMinutes();
    const inTimeWindow = minute >= DAY_MINUTE_START && minute <= DAY_MINUTE_END;
    if (!isToday || !inTimeWindow) return null;
    return {
      top: (minute - DAY_MINUTE_START) * PX_PER_MINUTE,
      label: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }, [loading, viewDate]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{
              gridTemplateColumns: `88px repeat(${displayColumnCount}, minmax(0, 1fr))`,
            }}
          >
            <div className="px-3 py-3 text-xs font-semibold text-slate-500">Time</div>
            {loading
              ? Array.from({ length: displayColumnCount }, (_, index) => (
                  <div
                    key={`loading-header-${index}`}
                    className="border-l border-slate-200 px-3 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  </div>
                ))
              : columns.map((column) => (
                  <div
                    key={column.key}
                    className="border-l border-slate-200 px-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {column.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={column.avatarUrl}
                          alt={column.label}
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                          {column.initial}
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-semibold text-slate-900">
                          {column.label}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {column.department}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            {!loading && columns.length === 0 && (
              <div className="border-l border-slate-200 px-2 py-3 text-center">
                <p className="text-xs font-semibold text-slate-500">No providers</p>
              </div>
            )}
          </div>

          <div className="relative">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `88px repeat(${displayColumnCount}, minmax(0, 1fr))`,
              }}
            >
              <div className="relative border-r border-slate-200 bg-white">
                {timeSlots.map((slot) => (
                  <div
                    key={slot.key}
                    className="flex h-8 items-center justify-end border-b border-slate-100 px-2 text-right text-[11px] text-slate-500"
                  >
                    <span>{slot.label}</span>
                  </div>
                ))}
              </div>

              {loading
                ? Array.from({ length: displayColumnCount }, (_, index) => (
                    <div
                      key={`loading-column-${index}`}
                      className="relative border-l border-slate-200 bg-white"
                      style={{ height: `${GRID_HEIGHT}px` }}
                    >
                      {timeSlots.map((slot) => (
                        <div
                          key={`loading-${index}-${slot.key}`}
                          className="h-8 border-b border-slate-100"
                        />
                      ))}
                      <div className="absolute inset-3 space-y-3">
                        <div className="h-16 animate-pulse rounded-md bg-slate-100" />
                        <div className="h-14 animate-pulse rounded-md bg-slate-100" />
                        <div className="h-20 animate-pulse rounded-md bg-slate-100" />
                      </div>
                    </div>
                  ))
                : columns.map((column) => {
                    const positioned = positionedByColumn.get(column.key) ?? [];

                    return (
                      <div
                        key={column.key}
                        className="relative border-l border-slate-200 bg-white"
                        style={{ height: `${GRID_HEIGHT}px` }}
                      >
                        {timeSlots.map((slot) => (
                          <div
                            key={`${column.key}-${slot.key}`}
                            className="h-8 border-b border-slate-100"
                          />
                        ))}

                        {positioned.map((item) => {
                          const customerName =
                            item.booking.invitee_name?.trim() ||
                            item.booking.contacts?.name?.trim() ||
                            "Guest";
                          const serviceName =
                            item.booking.event_types?.title?.trim() || "Appointment";
                          const statusCardClass = getStatusCardClass(item.booking.status);
                          const statusTimeClass = getStatusCalendarChipClass(
                            item.booking.status,
                          ).time;

                          return (
                            <div
                              key={item.booking.id}
                              className="absolute z-10 px-1"
                              style={{
                                top: `${item.top}px`,
                                left: "0%",
                                width: "100%",
                                height: `${Math.max(40, item.height - 2)}px`,
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => onSelectBooking(item.booking)}
                                className={`flex h-full w-full flex-col overflow-hidden rounded-md border p-2 text-left shadow-sm transition hover:shadow ${
                                  selectedBookingId === item.booking.id
                                    ? "border-indigo-300 bg-indigo-50"
                                    : statusCardClass
                                }`}
                                title={`${formatTime(item.booking.start_at)} ${customerName}`}
                              >
                                <p className={`text-[11px] font-semibold ${statusTimeClass}`}>
                                  {formatTime(item.booking.start_at)}
                                </p>
                                <p className="truncate text-xs font-semibold text-slate-900">
                                  {customerName}
                                </p>
                                <p className="truncate text-[11px] text-slate-600">
                                  {serviceName}
                                </p>
                                <div className="mt-auto flex justify-end">
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(item.booking.status)}`}
                                    aria-hidden
                                  />
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

              {!loading && columns.length === 0 && (
                <div
                  className="relative border-l border-slate-200 bg-white"
                  style={{ height: `${GRID_HEIGHT}px` }}
                >
                  {timeSlots.map((slot) => (
                    <div
                      key={`empty-${slot.key}`}
                      className="h-8 border-b border-slate-100"
                    />
                  ))}
                  <div className="absolute inset-0 flex items-center justify-center px-4">
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-center text-xs text-slate-500">
                      No providers with bookings for this day
                    </p>
                  </div>
                </div>
              )}
            </div>

            {nowLine && (
              <div
                className="pointer-events-none absolute inset-x-0 z-[15]"
                style={{ top: `${nowLine.top}px` }}
              >
                <div
                  className="grid items-center"
                  style={{
                    gridTemplateColumns: `88px repeat(${displayColumnCount}, minmax(0, 1fr))`,
                  }}
                >
                  <div className="flex items-center justify-end pr-2">
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                      {nowLine.label}
                    </span>
                  </div>
                  <div className="flex items-center" style={{ gridColumn: `2 / -1` }}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                    <div className="h-px flex-1 bg-rose-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        <span>
          {loading
            ? "Loading day schedule…"
            : `Showing day schedule • ${toDateKey(viewDate)}`}
        </span>
        <span>Time Zone: {timezoneLabel}</span>
      </div>
    </div>
  );
}
