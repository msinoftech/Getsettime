-- Plans catalog and workspace subscription assignments

CREATE TABLE IF NOT EXISTS public.plans (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  booking_limit INTEGER NOT NULL,
  workspace_limit INTEGER NOT NULL DEFAULT 1,
  admin_limit INTEGER NOT NULL DEFAULT 1,
  service_provider_limit INTEGER NOT NULL DEFAULT 2,
  google_calendar_sync BOOLEAN NOT NULL DEFAULT true,
  email_notifications BOOLEAN NOT NULL DEFAULT true,
  public_booking_page BOOLEAN NOT NULL DEFAULT true,
  whatsapp_automation BOOLEAN NOT NULL DEFAULT false,
  online_payments BOOLEAN NOT NULL DEFAULT false,
  additional_locations BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  billing_interval TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_subscriptions (
  id BIGSERIAL PRIMARY KEY,
  workspace_id BIGINT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES public.plans(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  stripe_subscription_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_subscriptions_one_active_per_workspace
  ON public.workspace_subscriptions (workspace_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_workspace_id
  ON public.workspace_subscriptions (workspace_id);

CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_plan_id
  ON public.workspace_subscriptions (plan_id);

CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans (slug);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Workspace members can read their subscription"
  ON public.workspace_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::BIGINT
  );
