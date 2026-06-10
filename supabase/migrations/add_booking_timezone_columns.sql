-- Persist customer and provider IANA timezones on bookings for notifications and display.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS customer_timezone text,
  ADD COLUMN IF NOT EXISTS provider_timezone text;
