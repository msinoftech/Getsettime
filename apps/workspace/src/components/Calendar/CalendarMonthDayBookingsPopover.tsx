"use client";

import type { Booking } from "@/src/types/booking";
import { CALENDAR_MONTH_VISIBLE_COUNT } from "@/src/components/Calendar/calendar_booking_layout";
import { formatCalendarDayHeading } from "@/src/components/Calendar/calendar_utils";
import { CalendarBookingsOverflowPopover } from "@/src/components/Calendar/CalendarBookingsOverflowPopover";

type CalendarMonthDayBookingsPopoverProps = {
  date: Date;
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
};

export function CalendarMonthDayBookingsPopover({
  date,
  bookings,
  onBookingClick,
}: CalendarMonthDayBookingsPopoverProps) {
  const hiddenCount = bookings.length - CALENDAR_MONTH_VISIBLE_COUNT;

  return (
    <CalendarBookingsOverflowPopover
      heading={formatCalendarDayHeading(date)}
      bookings={bookings}
      hiddenCount={hiddenCount}
      onBookingClick={onBookingClick}
    />
  );
}
