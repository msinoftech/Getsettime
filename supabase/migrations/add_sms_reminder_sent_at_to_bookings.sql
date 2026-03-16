ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS sms_reminder_sent_at timestamptz;

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS sms_reminder_skipped_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_reminder_pending
ON public.bookings(start_at)
WHERE sms_reminder_sent_at IS NULL AND sms_reminder_skipped_at IS NULL AND status != 'cancelled';
