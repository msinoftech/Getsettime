"use client";

import type { Booking } from "@/src/types/booking";
import { formatTime } from "@/src/utils/date";
import {
  getStatusCalendarCardClass,
  getStatusCalendarChipClass,
  getStatusDotClass,
} from "@/src/components/Calendar/calendar_utils";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarTimedBookingCardProps = {
  booking: Booking;
  selected?: boolean;
  compact?: boolean;
  showProvider?: boolean;
  providerName?: string;
  onSelect: () => void;
  className?: string;
};

export function CalendarTimedBookingCard({
  booking,
  selected = false,
  compact = false,
  showProvider = false,
  providerName,
  onSelect,
  className,
}: CalendarTimedBookingCardProps) {
  const customerName =
    booking.invitee_name?.trim() ||
    booking.contacts?.name?.trim() ||
    "Guest";
  const serviceName = booking.event_types?.title?.trim() || "Appointment";
  const statusCardClass = getStatusCalendarCardClass(booking.status);
  const statusTimeClass = getStatusCalendarChipClass(booking.status).time;
  const ultraCompact = compact && !showProvider;

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={cn(
        "flex w-full flex-col rounded-md border p-2 text-left shadow-sm transition hover:shadow",
        selected ? "border-indigo-300 bg-indigo-50" : statusCardClass,
        className,
      )}
      title={`${formatTime(booking.start_at)} ${customerName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 font-semibold",
            compact ? "text-[11px]" : "text-xs",
            statusTimeClass,
          )}
        >
          {formatTime(booking.start_at)}
        </p>
        <span
          className={cn(
            "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full",
            getStatusDotClass(booking.status),
          )}
          aria-hidden
        />
      </div>
      <p
        className={cn(
          "font-semibold text-slate-900",
          compact ? "text-xs" : "text-sm",
        )}
      >
        {customerName}
      </p>
      <p
        className={cn(
          "text-slate-600",
          compact ? "text-[11px]" : "text-xs",
          ultraCompact && "hidden",
        )}
      >
        {serviceName}
      </p>
      {showProvider && providerName ? (
        <p className="-mt-0.5 text-[11px] text-slate-500">{providerName}</p>
      ) : null}
    </button>
  );
}
