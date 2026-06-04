-- Plan marketing content (presentation layer, separate from entitlements)

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.plan_content (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  context TEXT NOT NULL DEFAULT 'upgrade_modal',
  subtitle TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  cta_label TEXT,
  cta_variant TEXT NOT NULL DEFAULT 'primary' CHECK (cta_variant IN ('primary', 'dark')),
  badge_label TEXT,
  is_highlighted BOOLEAN NOT NULL DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, context)
);

CREATE INDEX IF NOT EXISTS idx_plan_content_plan_id ON public.plan_content (plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_content_context ON public.plan_content (context);

ALTER TABLE public.plan_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active plan content"
  ON public.plan_content
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      WHERE p.id = plan_content.plan_id AND p.is_active = true
    )
  );

-- Seed marketing content for common paid plan slugs (no-op if plans missing)
INSERT INTO public.plan_content (
  plan_id,
  context,
  subtitle,
  features,
  cta_label,
  cta_variant,
  badge_label,
  is_highlighted,
  display_order
)
SELECT
  p.id,
  'upgrade_modal',
  v.subtitle,
  v.features::jsonb,
  v.cta_label,
  v.cta_variant,
  v.badge_label,
  v.is_highlighted,
  v.display_order
FROM public.plans p
JOIN (
  VALUES
    (
      'professional',
      'For growing service teams.',
      '["Unlimited bookings","WhatsApp reminders","Online payments","Advanced analytics","Team scheduling","Custom branding"]',
      'Continue with Professional',
      'primary',
      'Most Popular',
      true,
      1
    ),
    (
      'enterprise',
      'For multi-location businesses.',
      '["Multi-location","API access","SSO integration","Advanced roles","Dedicated support","Custom integrations"]',
      'Continue with Enterprise',
      'dark',
      NULL,
      false,
      2
    )
) AS v(slug, subtitle, features, cta_label, cta_variant, badge_label, is_highlighted, display_order)
  ON p.slug = v.slug
ON CONFLICT (plan_id, context) DO NOTHING;
