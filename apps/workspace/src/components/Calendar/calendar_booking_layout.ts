import type { Booking } from "@/src/types/booking";

/** Month-grid chips by viewport: 1 below md, 2 from md, 3 from lg. */
export const CALENDAR_MONTH_VISIBLE_COUNT_MOBILE = 1;
export const CALENDAR_MONTH_VISIBLE_COUNT_TABLET = 2;
export const CALENDAR_MONTH_VISIBLE_COUNT = 3;

/** Index matches chip order. Empty string keeps the first chip visible at every width. */
export const CALENDAR_MONTH_CHIP_VISIBILITY_CLASS = [
  "",
  "hidden md:block",
  "hidden lg:block",
] as const;

export const CALENDAR_TIMED_VISIBLE_COUNT = 2;

export type NormalizedTimedBooking = {
  booking: Booking;
  startMinute: number;
  endMinute: number;
};

export type OverlapBookingCluster = {
  bookings: Booking[];
  startMinute: number;
  endMinute: number;
};

export type TimedLayoutItem =
  | {
      kind: "single";
      booking: Booking;
      top: number;
      height: number;
      startMinute: number;
      endMinute: number;
    }
  | {
      kind: "cluster";
      bookings: Booking[];
      visibleBookings: Booking[];
      hiddenCount: number;
      top: number;
      height: number;
      startMinute: number;
      endMinute: number;
    };

export type TimedLayoutOptions = {
  dayMinuteStart: number;
  dayMinuteEnd: number;
  pxPerMinute: number;
  maxVisibleInCluster: number;
  minSingleCardHeight: number;
  minClusterCardHeight: number;
  moreIndicatorHeight: number;
  clusterGapPx: number;
};

export function toMinuteOfDay(value: string | null): number | null {
  if (!value) return null;
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

export function getBookingDurationMinutes(booking: Booking): number {
  const start = booking.start_at ? new Date(booking.start_at).getTime() : 0;
  const end = booking.end_at ? new Date(booking.end_at).getTime() : 0;
  if (start > 0 && end > start) {
    return Math.max(15, Math.round((end - start) / 60000));
  }
  const fallback = booking.event_types?.duration_minutes ?? 30;
  return Math.max(15, fallback);
}

export function clampBookingMinuteRange(
  startMinute: number,
  endMinute: number,
  dayMinuteStart: number,
  dayMinuteEnd: number,
): [number, number] {
  const clampedStart = Math.max(dayMinuteStart, startMinute);
  const clampedEnd = Math.min(dayMinuteEnd, Math.max(endMinute, startMinute + 15));
  return [clampedStart, Math.max(clampedStart + 15, clampedEnd)];
}

export function formatMinuteOfDayLabel(minuteOfDay: number): string {
  const hour24 = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const meridiem = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${meridiem}`;
}

export function formatCalendarTimeRangeHeading(
  startMinute: number,
  endMinute: number,
): string {
  return `${formatMinuteOfDayLabel(startMinute)} – ${formatMinuteOfDayLabel(endMinute)}`;
}

function rangesOverlap(
  a: Pick<NormalizedTimedBooking, "startMinute" | "endMinute">,
  b: Pick<NormalizedTimedBooking, "startMinute" | "endMinute">,
): boolean {
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

function sortBookingsByStart(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
    return aTime - bTime;
  });
}

export function normalizeTimedBookings(
  bookings: Booking[],
  dayMinuteStart: number,
  dayMinuteEnd: number,
): NormalizedTimedBooking[] {
  return bookings
    .map((booking) => {
      const startMinuteRaw = toMinuteOfDay(booking.start_at);
      if (startMinuteRaw == null) return null;
      const durationMinutes = getBookingDurationMinutes(booking);
      const [startMinute, endMinute] = clampBookingMinuteRange(
        startMinuteRaw,
        startMinuteRaw + durationMinutes,
        dayMinuteStart,
        dayMinuteEnd,
      );
      return { booking, startMinute, endMinute };
    })
    .filter((item): item is NormalizedTimedBooking => item !== null)
    .sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.endMinute - b.endMinute;
    });
}

export function clusterOverlappingBookings(
  items: NormalizedTimedBooking[],
): OverlapBookingCluster[] {
  if (items.length === 0) return [];

  const parent = items.map((_, index) => index);

  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) {
      parent[root] = parent[parent[root]];
      root = parent[root];
    }
    return root;
  };

  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) {
      parent[rootRight] = rootLeft;
    }
  };

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (rangesOverlap(items[i], items[j])) {
        union(i, j);
      }
    }
  }

  const grouped = new Map<number, NormalizedTimedBooking[]>();
  for (let i = 0; i < items.length; i += 1) {
    const root = find(i);
    const list = grouped.get(root) ?? [];
    list.push(items[i]);
    grouped.set(root, list);
  }

  return Array.from(grouped.values()).map((group) => ({
    bookings: sortBookingsByStart(group.map((item) => item.booking)),
    startMinute: Math.min(...group.map((item) => item.startMinute)),
    endMinute: Math.max(...group.map((item) => item.endMinute)),
  }));
}

export function layoutTimedBookings(
  bookings: Booking[],
  options: TimedLayoutOptions,
): TimedLayoutItem[] {
  const normalized = normalizeTimedBookings(
    bookings,
    options.dayMinuteStart,
    options.dayMinuteEnd,
  );
  const clusters = clusterOverlappingBookings(normalized);

  return clusters.map((cluster) => {
    const top = (cluster.startMinute - options.dayMinuteStart) * options.pxPerMinute;
    const durationHeight =
      (cluster.endMinute - cluster.startMinute) * options.pxPerMinute;

    if (cluster.bookings.length === 1) {
      const height = Math.max(durationHeight, options.minSingleCardHeight);
      return {
        kind: "single",
        booking: cluster.bookings[0],
        top,
        height,
        startMinute: cluster.startMinute,
        endMinute: cluster.endMinute,
      };
    }

    const visibleBookings = cluster.bookings.slice(0, options.maxVisibleInCluster);
    const hiddenCount = Math.max(0, cluster.bookings.length - visibleBookings.length);
    const compactHeight =
      visibleBookings.length * options.minClusterCardHeight +
      (visibleBookings.length > 1 ? options.clusterGapPx : 0) +
      (hiddenCount > 0 ? options.moreIndicatorHeight : 0);
    return {
      kind: "cluster",
      bookings: cluster.bookings,
      visibleBookings,
      hiddenCount,
      top,
      height: compactHeight,
      startMinute: cluster.startMinute,
      endMinute: cluster.endMinute,
    };
  });
}

export type TimedCalendarSlot = {
  minute: number;
  baseHeight: number;
  extraHeight: number;
};

export function buildTimedCalendarSlots(
  dayMinuteStart: number,
  dayMinuteEnd: number,
  slotMinutes: number,
  baseSlotHeight: number,
): TimedCalendarSlot[] {
  const slots: TimedCalendarSlot[] = [];
  for (let minute = dayMinuteStart; minute < dayMinuteEnd; minute += slotMinutes) {
    slots.push({ minute, baseHeight: baseSlotHeight, extraHeight: 0 });
  }
  return slots;
}

export function getTimedSlotHeight(slot: TimedCalendarSlot): number {
  return slot.baseHeight + slot.extraHeight;
}

export function getTimedGridHeight(slots: TimedCalendarSlot[]): number {
  return slots.reduce((sum, slot) => sum + getTimedSlotHeight(slot), 0);
}

export function applyClusterSlotExpansionsFromColumns(
  slots: TimedCalendarSlot[],
  columnsLayout: TimedLayoutItem[][],
  dayMinuteStart: number,
  slotMinutes: number,
): void {
  for (const items of columnsLayout) {
    for (const item of items) {
      if (item.kind !== "cluster") continue;

      const slotIndex = Math.floor((item.startMinute - dayMinuteStart) / slotMinutes);
      if (slotIndex < 0 || slotIndex >= slots.length) continue;

      const slot = slots[slotIndex];
      const slotStartMinute = dayMinuteStart + slotIndex * slotMinutes;
      const offsetInSlot = Math.max(0, item.startMinute - slotStartMinute);
      const offsetFraction = Math.min(1, offsetInSlot / slotMinutes);
      const contentHeight = item.height + 4;
      const requiredHeight =
        offsetFraction >= 1
          ? contentHeight
          : contentHeight / (1 - offsetFraction);

      if (requiredHeight > getTimedSlotHeight(slot)) {
        slot.extraHeight = requiredHeight - slot.baseHeight;
      }
    }
  }
}

export function minuteToTimedTop(
  minute: number,
  slots: TimedCalendarSlot[],
  dayMinuteStart: number,
  slotMinutes: number,
): number {
  if (slots.length === 0) return 0;

  const slotIndex = Math.floor((minute - dayMinuteStart) / slotMinutes);
  const cappedIndex = Math.min(Math.max(slotIndex, 0), slots.length - 1);

  let top = 0;
  for (let i = 0; i < cappedIndex; i += 1) {
    top += getTimedSlotHeight(slots[i]);
  }

  const slotStartMinute = dayMinuteStart + cappedIndex * slotMinutes;
  const offsetInSlot = Math.max(0, minute - slotStartMinute);
  top += (offsetInSlot / slotMinutes) * getTimedSlotHeight(slots[cappedIndex]);

  return top;
}

export function resolveTimedLayoutItems(
  items: TimedLayoutItem[],
  slots: TimedCalendarSlot[],
  options: TimedLayoutOptions,
  slotMinutes: number,
): TimedLayoutItem[] {
  return items.map((item) => {
    const top = minuteToTimedTop(
      item.startMinute,
      slots,
      options.dayMinuteStart,
      slotMinutes,
    );

    if (item.kind === "single") {
      const bottom = minuteToTimedTop(
        item.endMinute,
        slots,
        options.dayMinuteStart,
        slotMinutes,
      );
      const durationHeight = Math.max(0, bottom - top);
      return {
        ...item,
        top,
        height: Math.max(durationHeight, options.minSingleCardHeight),
      };
    }

    return {
      ...item,
      top,
      height: item.height,
    };
  });
}

export function resolveTimedCalendarSchedule(
  columnsLayout: Map<string, TimedLayoutItem[]>,
  options: TimedLayoutOptions,
  slotMinutes: number,
  baseSlotHeight: number,
): {
  slots: TimedCalendarSlot[];
  gridHeight: number;
  layoutByColumn: Map<string, TimedLayoutItem[]>;
} {
  const slots = buildTimedCalendarSlots(
    options.dayMinuteStart,
    options.dayMinuteEnd,
    slotMinutes,
    baseSlotHeight,
  );

  applyClusterSlotExpansionsFromColumns(
    slots,
    Array.from(columnsLayout.values()),
    options.dayMinuteStart,
    slotMinutes,
  );

  const layoutByColumn = new Map<string, TimedLayoutItem[]>();
  for (const [key, items] of columnsLayout.entries()) {
    layoutByColumn.set(
      key,
      resolveTimedLayoutItems(items, slots, options, slotMinutes),
    );
  }

  return {
    slots,
    gridHeight: getTimedGridHeight(slots),
    layoutByColumn,
  };
}
