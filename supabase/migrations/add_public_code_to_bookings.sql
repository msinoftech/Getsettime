ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS public_code text UNIQUE;
