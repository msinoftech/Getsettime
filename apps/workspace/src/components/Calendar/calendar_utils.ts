import type { Booking } from "@/src/types/booking";

export const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

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

export function formatCalendarDayHeading(date: Date): string {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
  });
}

export function buildCalendarCells(viewDate: Date): CalendarCell[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const startWeekday = (firstDayOfMonth.getDay() + 6) % 7;

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
      return "bg-indigo-50 text-indigo-700 border-blue-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "cancelled":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "no_show":
    case "no-show":
    case "noshow":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "reschedule":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

/** Compact calendar event chip styles (background + time text color) */
export function getStatusCalendarChipClass(
  status: string | null | undefined,
): { chip: string; time: string } {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return {
        chip: "bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200",
        time: "text-indigo-700",
      };
    case "completed":
      return {
        chip: "bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200",
        time: "text-emerald-700",
      };
    case "pending":
      return {
        chip: "bg-amber-50 hover:bg-amber-100/80 border-amber-200",
        time: "text-amber-700",
      };
    case "cancelled":
      return {
        chip: "bg-red-50 hover:bg-red-100/80 border-red-200",
        time: "text-rose-700",
      };
    case "no_show":
    case "no-show":
    case "noshow":
      return {
        chip: "bg-violet-50 hover:bg-violet-100/80 border-violet-200",
        time: "text-violet-700",
      };
    case "reschedule":
      return {
        chip: "bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200",
        time: "text-indigo-700",
      };
    default:
      return {
        chip: "bg-slate-50 hover:bg-slate-100/80 border-slate-200",
        time: "text-slate-700",
      };
  }
}

/** Bordered card styles for day/week timed calendar events */
export function getStatusCalendarCardClass(
  status: string | null | undefined,
): string {
  const card = getStatusCalendarChipClass(status).chip;
  if (card.includes("blue")) return "border-blue-200 bg-indigo-50";
  if (card.includes("emerald")) return "border-emerald-200 bg-emerald-50";
  if (card.includes("amber")) return "border-amber-200 bg-amber-50";
  if (card.includes("red")) return "border-red-200 bg-red-50";
  if (card.includes("violet")) return "border-violet-200 bg-violet-50";
  if (card.includes("indigo")) return "border-indigo-200 bg-indigo-50";
  return "border-slate-200 bg-white";
}

export function getStatusDotClass(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
      return "bg-indigo-500";
    case "completed":
      return "bg-emerald-500";
    case "pending":
      return "bg-amber-500";
    case "cancelled":
      return "bg-rose-500";
    case "reschedule":
      return "bg-indigo-500";
    case "no_show":
    case "no-show":
    case "noshow":
      return "bg-violet-500";
    default:
      return "bg-slate-400";
  }
}

export const CALENDAR_STATUS_LEGEND = [
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
  { key: "reschedule", label: "Reschedule" },
  { key: "no_show", label: "No Show" },
] as const;

export function filterBookingsBySearch(
  bookings: Booking[],
  search: string,
): Booking[] {
  const q = search.trim().toLowerCase();
  if (!q) return bookings;

  const qDigits = q.replace(/\D/g, "");

  return bookings.filter((booking) => {
    const invitee =
      (booking.invitee_name?.trim() ||
        booking.contacts?.name?.trim() ||
        "");
    const eventType = booking.event_types?.title?.trim() || "";
    const creatorName = booking.creator?.name?.trim() || "";
    const inviteePhone = booking.invitee_phone?.replace(/\D/g, "") ?? "";
    const contactPhone = booking.contacts?.phone?.replace(/\D/g, "") ?? "";
    const phoneMatch =
      qDigits.length >= 3 &&
      ((inviteePhone.length > 0 && inviteePhone.includes(qDigits)) ||
        (contactPhone.length > 0 && contactPhone.includes(qDigits)));

    return (
      invitee.toLowerCase().includes(q) ||
      eventType.toLowerCase().includes(q) ||
      creatorName.toLowerCase().includes(q) ||
      phoneMatch
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
