import type { Booking } from "@/src/types/booking";

export const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type CalendarCell = {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
};

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildCalendarCells(viewDate: Date): CalendarCell[] {
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

/** Bordered pill styles aligned with calendar reference mock */
export function getStatusPillClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "reschedule":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export function filterBookingsBySearch(
  bookings: Booking[],
  search: string,
): Booking[] {
  const q = search.trim().toLowerCase();
  if (!q) return bookings;

  return bookings.filter((booking) => {
    const invitee =
      (booking.invitee_name?.trim() ||
        booking.contacts?.name?.trim() ||
        "");
    const eventType = booking.event_types?.title?.trim() || "";
    const creatorName = booking.creator?.name?.trim() || "";
    return (
      invitee.toLowerCase().includes(q) ||
      eventType.toLowerCase().includes(q) ||
      creatorName.toLowerCase().includes(q)
    );
  });
}

export function createdByDisplayLabel(booking: Booking): string {
  const creatorName =
    booking.creator?.name && booking.creator.name.trim()
      ? booking.creator.name.trim()
      : null;
  if (creatorName) return creatorName;
  const guest =
    (booking.invitee_name && booking.invitee_name.trim()) ||
    (booking.contacts?.name && booking.contacts.name.trim()) ||
    "Guest";
  return guest;
}
