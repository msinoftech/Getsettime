-- Track whether workspace users have acknowledged a booking time change (customer or admin reschedule).
-- When false, show "Reschedule" badge and include in sidebar / "new" attention counts.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS is_reschedule_viewed BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.bookings.is_reschedule_viewed IS 'False after start/end time changes until an admin views/acknowledges the booking.';
