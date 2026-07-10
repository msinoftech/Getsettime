"use client";

import { useMemo } from "react";
import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import {
  createdByDisplayLabel,
  getStatusCalendarChipClass,
  getStatusDotClass,
} from "@/src/components/Calendar/calendar_utils";

type CalendarWeekGridProps = {
  viewMode: "week" | "provider";
  weekStart: Date;
  bookings: Booking[];
  providerColumns: Array<{ key: string; label: string }>;
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
const SLOT_HEIGHT = 64;
const PX_PER_MINUTE = SLOT_HEIGHT / 60;
const DAY_MINUTE_START = START_HOUR * 60;
const DAY_MINUTE_END = END_HOUR * 60;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * SLOT_HEIGHT;
const MAX_VISIBLE_PER_MINUTE = 3;
const STACK_GAP_PX = 6;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

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

function getDayLabel(date: Date): { day: string; full: string; date: string } {
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    full: date.toLocaleDateString("en-US", { weekday: "long" }),
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  };
}

function getProviderName(booking: Booking): string {
  return booking.service_provider_name?.trim() || createdByDisplayLabel(booking);
}

function getColumnKey(booking: Booking, viewMode: "week" | "provider"): string {
  if (viewMode === "provider") {
    return booking.service_provider_id?.trim() || getProviderName(booking);
  }
  if (!booking.start_at) return "";
  return toDateKey(new Date(booking.start_at));
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
      return {
        booking,
        startMinute,
        endMinute,
      };
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
    const contentHeight = 83;
    const height = Math.max(durationHeight, contentHeight);

    let top = baseTop;
    for (const prev of placed) {
      const overlapsBox = top < prev.top + prev.height + STACK_GAP_PX;
      if (overlapsBox) {
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

export function CalendarWeekGrid({
  viewMode,
  weekStart,
  bookings,
  providerColumns,
  loading,
  timezoneLabel,
  onSelectBooking,
  selectedBookingId,
}: CalendarWeekGridProps) {
  const resolvedWeekStart = useMemo(() => startOfWeek(weekStart), [weekStart]);
  const weekDays = useMemo(() => getWeekDays(resolvedWeekStart), [resolvedWeekStart]);
  const weekDateKeys = useMemo(() => weekDays.map((day) => toDateKey(day)), [weekDays]);

  const columns = useMemo(() => {
    if (viewMode === "provider") {
      return providerColumns.map((provider) => ({
        key: provider.key,
        label: provider.label,
        secondary: "Provider",
        full: provider.label,
        isToday: false,
      }));
    }
    return weekDays.map((day) => {
      const label = getDayLabel(day);
      const todayKey = toDateKey(new Date());
      const key = toDateKey(day);
      return {
        key,
        label: label.day,
        secondary: label.date,
        full: `${label.full} ${label.date}`,
        isToday: key === todayKey,
      };
    });
  }, [providerColumns, viewMode, weekDays]);

  const groupedByColumn = useMemo(() => {
    const grouped = new Map<string, Booking[]>();
    for (const column of columns) {
      grouped.set(column.key, []);
    }
    for (const booking of bookings) {
      const key = getColumnKey(booking, viewMode);
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
  }, [bookings, columns, viewMode]);

  const positionedByColumn = useMemo(() => {
    const positioned = new Map<string, PositionedBooking[]>();
    for (const column of columns) {
      const items = groupedByColumn.get(column.key) ?? [];
      positioned.set(column.key, positionBookings(items));
    }
    return positioned;
  }, [columns, groupedByColumn]);

  const nowLine = useMemo(() => {
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    const weekRangeStart = resolvedWeekStart.getTime();
    const weekRangeEnd = new Date(
      resolvedWeekStart.getFullYear(),
      resolvedWeekStart.getMonth(),
      resolvedWeekStart.getDate() + 7,
    ).getTime();
    const inCurrentWeek = now.getTime() >= weekRangeStart && now.getTime() < weekRangeEnd;
    const inTimeWindow = minute >= DAY_MINUTE_START && minute <= DAY_MINUTE_END;
    if (!inCurrentWeek || !inTimeWindow || viewMode === "provider") return null;
    return {
      top: (minute - DAY_MINUTE_START) * PX_PER_MINUTE,
      label: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }, [resolvedWeekStart, viewMode]);

  const timeLabels = useMemo(() => {
    return Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
      const hour24 = START_HOUR + index;
      const meridiem = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
      return `${hour12}:00 ${meridiem}`;
    });
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-3 text-xs font-semibold text-slate-500">Time</div>
            {columns.map((column) => (
              <div
                key={column.key}
                className={`border-l border-slate-200 px-2 py-3 text-center ${
                  column.isToday ? "bg-blue-50/60" : ""
                }`}
                title={column.full}
              >
                <p className="text-xs font-semibold text-slate-800">{column.label}</p>
                <p className="text-xs text-slate-500">{column.secondary}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="grid"
              style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              <div className="relative border-r border-slate-200 bg-white">
                {timeLabels.map((label, index) => (
                  <div
                    key={label}
                    className="flex h-16 items-center justify-end border-b border-slate-100 px-2 text-right text-xs text-slate-500"
                  >
                    <span>{index === timeLabels.length - 1 ? "" : label}</span>
                  </div>
                ))}
              </div>

              {columns.map((column) => {
                const positioned = positionedByColumn.get(column.key) ?? [];
                const stackedByMinute = new Map<number, PositionedBooking[]>();
                for (const item of positioned) {
                  const list = stackedByMinute.get(item.startMinute) ?? [];
                  list.push(item);
                  stackedByMinute.set(item.startMinute, list);
                }

                return (
                  <div
                    key={column.key}
                    className={`relative border-l border-slate-200 ${
                      column.isToday ? "bg-blue-50/30" : "bg-white"
                    }`}
                    style={{ height: `${GRID_HEIGHT}px` }}
                  >
                    {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                      <div
                        key={`${column.key}-grid-${index}`}
                        className="h-16 border-b border-slate-100"
                      />
                    ))}

                    {loading && (
                      <div className="absolute inset-3 rounded-lg bg-slate-100/70" />
                    )}

                    {!loading &&
                      positioned.map((item) => {
                        const customerName =
                          item.booking.invitee_name?.trim() ||
                          item.booking.contacts?.name?.trim() ||
                          "Guest";
                        const serviceName =
                          item.booking.event_types?.title?.trim() || "Appointment";
                        const providerName = getProviderName(item.booking);
                        const statusCardClass = getStatusCardClass(item.booking.status);
                        const statusTimeClass = getStatusCalendarChipClass(
                          item.booking.status,
                        ).time;

                        const sameMinuteItems = stackedByMinute.get(item.startMinute) ?? [];
                        const minuteIndex = sameMinuteItems.findIndex(
                          (entry) => entry.booking.id === item.booking.id,
                        );
                        const hiddenCount = Math.max(
                          0,
                          sameMinuteItems.length - MAX_VISIBLE_PER_MINUTE,
                        );
                        if (minuteIndex >= MAX_VISIBLE_PER_MINUTE) return null;

                        const compactCard = item.height < 72;
                        const ultraCompactCard = item.height < 56;

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
                              <p
                                className={`truncate text-[11px] text-slate-600 ${
                                  ultraCompactCard ? "hidden" : ""
                                }`}
                              >
                                {serviceName}
                              </p>
                              {!compactCard && (
                                <div className="-mt-0.5 flex items-center justify-between gap-2">
                                  <p className="truncate text-[11px] text-slate-500">
                                    {providerName}
                                  </p>
                                  <span
                                    className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(item.booking.status)}`}
                                    aria-hidden
                                  />
                                </div>
                              )}
                            </button>

                            {minuteIndex === MAX_VISIBLE_PER_MINUTE - 1 && hiddenCount > 0 && (
                              <div className="mt-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                                +{hiddenCount} more
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              })}
            </div>

            {nowLine && (
              <div
                className="pointer-events-none absolute inset-x-0 z-[15]"
                style={{ top: `${nowLine.top}px` }}
              >
                <div
                  className="grid items-center"
                  style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(0, 1fr))` }}
                >
                  <div className="flex items-center justify-end pr-2">
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                      {nowLine.label}
                    </span>
                  </div>
                  <div
                    className="flex items-center"
                    style={{ gridColumn: `2 / -1` }}
                  >
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
          Showing {viewMode === "provider" ? "provider schedule" : "week schedule"} •{" "}
          {weekDateKeys[0]} - {weekDateKeys[6]}
        </span>
        <span>Time Zone: {timezoneLabel}</span>
      </div>
    </div>
  );
}
