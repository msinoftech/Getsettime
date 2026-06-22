-- Add a denormalized snapshot of the assigned provider display name to bookings.
-- Preserves the provider name shown at booking time even if the provider is later renamed or removed.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS service_provider_name text;

COMMENT ON COLUMN public.bookings.service_provider_name IS
  'Snapshot of the assigned provider display name at booking creation (or last reassignment).';
