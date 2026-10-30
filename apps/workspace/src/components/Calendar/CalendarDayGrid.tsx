"use client";

import { useMemo } from "react";
import type { Booking } from "@/src/types/booking";
import {
  createdByDisplayLabel,
  toDateKey,
} from "@/src/components/Calendar/calendar_utils";
import { UserAvatar } from "@app/ui";
import {
  CALENDAR_TIMED_VISIBLE_COUNT,
  formatMinuteOfDayLabel,
  layoutTimedBookings,
  minuteToTimedTop,
  resolveTimedCalendarSchedule,
} from "@/src/components/Calendar/calendar_booking_layout";
import { CalendarTimedBookingLayer } from "@/src/components/Calendar/CalendarTimedBookingLayer";

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

const START_HOUR = 8;
const END_HOUR = 18;
const SLOT_HEIGHT = 32;
const SLOT_MINUTES = 30;
const DAY_MINUTE_START = START_HOUR * 60;
const DAY_MINUTE_END = END_HOUR * 60;
const DEFAULT_GRID_HEIGHT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES * SLOT_HEIGHT;
const LOADING_COLUMN_COUNT = 4;

const DAY_LAYOUT_OPTIONS = {
  dayMinuteStart: DAY_MINUTE_START,
  dayMinuteEnd: DAY_MINUTE_END,
  pxPerMinute: SLOT_HEIGHT / SLOT_MINUTES,
  maxVisibleInCluster: CALENDAR_TIMED_VISIBLE_COUNT,
  minSingleCardHeight: 72,
  minClusterCardHeight: 40,
  moreIndicatorHeight: 24,
  clusterGapPx: 2,
} as const;

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

  const { timedSlots, gridHeight, layoutByColumn } = useMemo(() => {
    const rawLayout = new Map<string, ReturnType<typeof layoutTimedBookings>>();
    for (const column of columns) {
      rawLayout.set(
        column.key,
        layoutTimedBookings(groupedByColumn.get(column.key) ?? [], DAY_LAYOUT_OPTIONS),
      );
    }

    const schedule = resolveTimedCalendarSchedule(
      rawLayout,
      DAY_LAYOUT_OPTIONS,
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
    if (loading) return null;
    const now = new Date();
    const isToday = toDateKey(viewDate) === toDateKey(now);
    const minute = now.getHours() * 60 + now.getMinutes();
    const inTimeWindow = minute >= DAY_MINUTE_START && minute <= DAY_MINUTE_END;
    if (!isToday || !inTimeWindow) return null;
    return {
      top: minuteToTimedTop(minute, timedSlots, DAY_MINUTE_START, SLOT_MINUTES),
      label: now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    };
  }, [loading, viewDate, timedSlots]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <div className="w-full">
          <div className="grid border-b border-slate-200 bg-slate-50" style={{ gridTemplateColumns: `88px repeat(${displayColumnCount}, minmax(0, 1fr))`, }}>
            <div className="px-3 py-4 text-sm font-semibold text-slate-900">Time</div>
            {loading
              ? Array.from({ length: displayColumnCount }, (_, index) => (
                  <div key={`loading-header-${index}`} className="border-l border-slate-200 px-3 py-3">
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
                      <UserAvatar
                        avatarUrl={column.avatarUrl}
                        name={column.label}
                        size="md"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {column.label}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {column.department}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            {!loading && columns.length === 0 && (
              <div className="border-l border-slate-200 px-6 py-4 text-center">
                <p className="text-sm font-semibold text-slate-900">No providers</p>
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
                {timedSlots.map((slot) => (
                  <div
                    key={slot.minute}
                    className="flex items-center border-b border-slate-100 px-3 font-medium text-sm text-slate-900"
                    style={{ height: `${slot.baseHeight + slot.extraHeight}px` }}
                  >
                    <span>{formatMinuteOfDayLabel(slot.minute)}</span>
                  </div>
                ))}
              </div>

              {loading
                ? Array.from({ length: displayColumnCount }, (_, index) => (
                    <div
                      key={`loading-column-${index}`}
                      className="relative border-l border-slate-200 bg-white"
                      style={{ height: `${DEFAULT_GRID_HEIGHT}px` }}
                    >
                      {Array.from(
                        { length: (DAY_MINUTE_END - DAY_MINUTE_START) / SLOT_MINUTES },
                        (_, slotIndex) => (
                        <div
                          key={`loading-${index}-${slotIndex}`}
                          className="border-b border-slate-100"
                          style={{ height: `${SLOT_HEIGHT}px` }}
                        />
                      ))}
                      <div className="absolute inset-3 space-y-3">
                        <div className="h-8 animate-pulse rounded-md bg-slate-100" />
                        <div className="h-8 animate-pulse rounded-md bg-slate-100" />
                        <div className="h-8 animate-pulse rounded-md bg-slate-100" />
                      </div>
                    </div>
                  ))
                : columns.map((column) => (
                    <div
                      key={column.key}
                      className="relative border-l border-slate-200 bg-white"
                      style={{ height: `${gridHeight}px` }}
                    >
                      {timedSlots.map((slot) => (
                        <div
                          key={`${column.key}-${slot.minute}`}
                          className="border-b border-slate-100"
                          style={{ height: `${slot.baseHeight + slot.extraHeight}px` }}
                        />
                      ))}

                      <CalendarTimedBookingLayer
                        items={layoutByColumn.get(column.key) ?? []}
                        selectedBookingId={selectedBookingId}
                        onSelectBooking={onSelectBooking}
                      />
                    </div>
                  ))}

              {!loading && columns.length === 0 && (
                <div
                  className="relative border-l border-slate-200 bg-white"
                  style={{ height: `${gridHeight}px` }}
                >
                  {timedSlots.map((slot) => (
                    <div
                      key={`empty-${slot.minute}`}
                      className="border-b border-slate-100"
                      style={{ height: `${slot.baseHeight + slot.extraHeight}px` }}
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
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                      {nowLine.label}
                    </span>
                  </div>
                  <div className="flex items-center" style={{ gridColumn: `2 / -1` }}>
                    <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                    <div className="h-px flex-1 bg-red-400" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-3 py-2 text-sm text-slate-500">
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
