"use client";

import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import { getStatusCalendarChipClass } from "@/src/components/Calendar/calendar_utils";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarMonthBookingChipProps = {
  booking: Booking;
  onClick: () => void;
  className?: string;
};

export function CalendarMonthBookingChip({
  booking,
  onClick,
  className,
}: CalendarMonthBookingChipProps) {
  const chipClass = getStatusCalendarChipClass(booking.status);
  const timeLabel = booking.start_at ? formatTime(booking.start_at) : "—";
  const serviceLabel = booking.event_types?.title?.trim() || "Appointment";

  return (
    <button
      type="button"
      title={`${timeLabel} ${serviceLabel}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex flex-wrap w-full cursor-pointer items-center gap-1 truncate rounded-lg border p-1 text-left text-[10px] sm:text-[11px] leading-tight transition",
        chipClass.chip,
        className,
      )}
    >
      <span className={cn("shrink-0 sm:font-bold", chipClass.time)}>{timeLabel}</span>
      <span className="truncate sm:font-medium text-slate-800">{serviceLabel}</span>
    </button>
  );
}
