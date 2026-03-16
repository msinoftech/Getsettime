ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS email_reminder_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS email_reminder_skipped_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS whatsapp_reminder_skipped_at timestamptz,
ADD COLUMN IF NOT EXISTS followup_email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS followup_email_skipped_at timestamptz;
