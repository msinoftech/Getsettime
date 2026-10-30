"use client";

import { useMemo } from "react";
import type { Booking } from "@/src/types/booking";
import {
  createdByDisplayLabel,
  toDateKey,
} from "@/src/components/Calendar/calendar_utils";
import {
  CALENDAR_TIMED_VISIBLE_COUNT,
  formatMinuteOfDayLabel,
  layoutTimedBookings,
  minuteToTimedTop,
  resolveTimedCalendarSchedule,
} from "@/src/components/Calendar/calendar_booking_layout";
import { CalendarTimedBookingLayer } from "@/src/components/Calendar/CalendarTimedBookingLayer";

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

const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_HEIGHT = 64;
const SLOT_MINUTES = 60;
const DAY_MINUTE_START = START_HOUR * 60;
const DAY_MINUTE_END = END_HOUR * 60;
const DEFAULT_GRID_HEIGHT = (END_HOUR - START_HOUR) * SLOT_HEIGHT;

const WEEK_LAYOUT_OPTIONS = {
  dayMinuteStart: DAY_MINUTE_START,
  dayMinuteEnd: DAY_MINUTE_END,
  pxPerMinute: SLOT_HEIGHT / SLOT_MINUTES,
  maxVisibleInCluster: CALENDAR_TIMED_VISIBLE_COUNT,
  minSingleCardHeight: 83,
  minClusterCardHeight: 44,
  moreIndicatorHeight: 26,
  clusterGapPx: 2,
} as const;

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

  const { timedSlots, gridHeight, layoutByColumn } = useMemo(() => {
    const rawLayout = new Map<string, ReturnType<typeof layoutTimedBookings>>();
    for (const column of columns) {
      rawLayout.set(
        column.key,
        layoutTimedBookings(groupedByColumn.get(column.key) ?? [], WEEK_LAYOUT_OPTIONS),
      );
    }

    const schedule = resolveTimedCalendarSchedule(
      rawLayout,
      WEEK_LAYOUT_OPTIONS,
      SLOT_MINUTES,
      SLOT_HEIGHT,
    );

    return {
      timedSlots: schedule.slots,
      gridHeight: schedule.gridHeight,
      layoutByColumn: schedule.layoutByColumn,
    };
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
      top: minuteToTimedTop(minute, timedSlots, DAY_MINUTE_START, SLOT_MINUTES),
      label: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }, [resolvedWeekStart, viewMode, timedSlots]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className="grid border-b border-slate-200 bg-slate-50"
            style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            <div className="px-3 py-4  text-sm font-semibold text-slate-900">Time</div>
            {columns.map((column) => (
              <div
                key={column.key}
                className={`border-l border-slate-200 px-6 py-4 text-center ${
                  column.isToday ? "bg-indigo-100/50" : ""
                }`}
                title={column.full}
              >
                <p className="text-sm font-semibold text-slate-900">{column.label}</p>
                <p className="text-xs text-slate-500">{column.secondary}</p>
              </div>
            ))}
          </div>

          <div className="relative">
            <div
              className="grid"
              style={{ gridTemplateColumns: `88px repeat(${columns.length}, minmax(0, 1fr))` }}
            >
              <div className="relative">
                {timedSlots.map((slot) => (
                  <div
                    key={slot.minute}
                    className="flex items-center border-b border-slate-100 px-3 text-right text-sm font-medium text-slate-900"
                    style={{ height: `${slot.baseHeight + slot.extraHeight}px` }}
                  >
                    <span>{formatMinuteOfDayLabel(slot.minute)}</span>
                  </div>
                ))}
              </div>

              {columns.map((column) => (
                <div
                  key={column.key}
                  className={`relative border-l border-slate-200 ${
                    column.isToday ? "bg-indigo-100/50" : "bg-white"
                  }`}
                  style={{ height: `${loading ? DEFAULT_GRID_HEIGHT : gridHeight}px` }}
                >
                  {(loading
                    ? Array.from({ length: END_HOUR - START_HOUR }, (_, index) => ({
                        minute: DAY_MINUTE_START + index * SLOT_MINUTES,
                        baseHeight: SLOT_HEIGHT,
                        extraHeight: 0,
                      }))
                    : timedSlots
                  ).map((slot) => (
                    <div
                      key={`${column.key}-grid-${slot.minute}`}
                      className="border-b border-slate-100"
                      style={{ height: `${slot.baseHeight + slot.extraHeight}px` }}
                    />
                  ))}

                  {loading && (
                    <div className="absolute inset-3 rounded-lg bg-slate-100/70" />
                  )}

                  {!loading && (
                    <CalendarTimedBookingLayer
                      items={layoutByColumn.get(column.key) ?? []}
                      selectedBookingId={selectedBookingId}
                      onSelectBooking={onSelectBooking}
                      showProvider
                      getProviderName={getProviderName}
                    />
                  )}
                </div>
              ))}
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

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
        <span>
          Showing {viewMode === "provider" ? "provider schedule" : "week schedule"} •{" "}
          {weekDateKeys[0]} - {weekDateKeys[6]}
        </span>
        <span>Time Zone: {timezoneLabel}</span>
      </div>
    </div>
  );
}
