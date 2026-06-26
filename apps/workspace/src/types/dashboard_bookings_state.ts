import type { Booking } from '@/src/types/booking';

/** Client state returned by useDashboardBookings */
export type dashboard_bookings_state = {
  today_bookings: Booking[];
  today_loading: boolean;
  next_appointment: Booking | null;
  next_loading: boolean;
  /** Next future appointments across all dates (range-independent), start_at ASC. */
  upcoming_appointments: Booking[];
  upcoming_loading: boolean;
  week_bookings: Booking[];
  week_loading: boolean;
  month_bookings: Booking[];
  month_loading: boolean;
};
