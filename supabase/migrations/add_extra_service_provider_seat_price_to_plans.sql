-- Per-seat pricing for service providers beyond the plan's included limit

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS extra_service_provider_seat_price NUMERIC(10, 2) NOT NULL DEFAULT 0;
