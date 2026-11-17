-- Public pricing + superadmin: one-liner and annual discount percent

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS annual_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.plans
  DROP CONSTRAINT IF EXISTS plans_annual_discount_percent_check;

ALTER TABLE public.plans
  ADD CONSTRAINT plans_annual_discount_percent_check
  CHECK (annual_discount_percent >= 0 AND annual_discount_percent <= 100);

COMMENT ON COLUMN public.plans.description IS
  'Short marketing one-liner for pricing pages.';
COMMENT ON COLUMN public.plans.annual_discount_percent IS
  'Percent off when billed annually (0-100) vs 12 x monthly price.';