-- Plan booking limits can be monthly (resets each UTC month) or lifetime (total cap).
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS booking_limit_period TEXT NOT NULL DEFAULT 'monthly';

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_booking_limit_period_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_booking_limit_period_check
  CHECK (booking_limit_period IN ('monthly', 'lifetime'));

COMMENT ON COLUMN public.plans.booking_limit_period IS
  'monthly = booking_limit applies per UTC month; lifetime = booking_limit is a total cap for the workspace.';

-- Free plan: 250 bookings total (includes cancelled/deleted rows).
UPDATE public.plans
SET booking_limit = 250,
    booking_limit_period = 'lifetime'
WHERE slug = 'free';
