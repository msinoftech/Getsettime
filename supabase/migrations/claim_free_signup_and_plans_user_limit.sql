-- Claim-free landing codes, plan user_limit, workspace signup provenance, waitlist, consume RPC.

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS user_limit INTEGER NOT NULL DEFAULT -1;

COMMENT ON COLUMN public.plans.user_limit IS
  'Max claim-free registrations (consumed codes) for this plan; -1 = unlimited. Used for slug free.';

ALTER TABLE public.workspace_subscriptions
  ADD COLUMN IF NOT EXISTS limit_notification_sent_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS public.claimed_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'forfeited')),
  origin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  forfeited_at TIMESTAMPTZ NULL,
  workspace_id BIGINT NULL REFERENCES public.workspaces (id) ON DELETE SET NULL,
  user_id UUID NULL,
  user_email TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_claimed_codes_code ON public.claimed_codes (code);
CREATE INDEX IF NOT EXISTS idx_claimed_codes_status ON public.claimed_codes (status);
CREATE INDEX IF NOT EXISTS idx_claimed_codes_expires_at ON public.claimed_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_claimed_codes_user_id ON public.claimed_codes (user_id);

CREATE TABLE IF NOT EXISTS public.claim_free_waitlist (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NULL,
  notified_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.claim_free_ineligible_emails (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL DEFAULT 'forfeit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS signup_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (signup_type IN ('normal', 'free_claimed'));

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS claimed_code_id UUID NULL REFERENCES public.claimed_codes (id) ON DELETE SET NULL;

COMMENT ON TABLE public.claimed_codes IS 'One-time codes minted from whitelisted external landing for free-claim signup.';
COMMENT ON TABLE public.claim_free_waitlist IS 'Emails when free-claim user_limit cap is full.';

ALTER TABLE public.claimed_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_free_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_free_ineligible_emails ENABLE ROW LEVEL SECURITY;

-- Service role only (API routes use supabaseAdmin).

CREATE OR REPLACE FUNCTION public.count_consumed_claim_codes()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM public.claimed_codes WHERE status = 'consumed';
$$;

CREATE OR REPLACE FUNCTION public.get_free_plan_user_limit()
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (SELECT user_limit FROM public.plans WHERE slug = 'free' LIMIT 1),
    -1
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_free_slots_remaining()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  v_limit := public.get_free_plan_user_limit();
  IF v_limit IS NULL OR v_limit < 0 THEN
    RETURN -1;
  END IF;
  v_used := public.count_consumed_claim_codes();
  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_claim_code(
  p_code TEXT,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.claimed_codes%ROWTYPE;
  v_limit INTEGER;
  v_used INTEGER;
  v_email_norm TEXT;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  v_email_norm := lower(btrim(COALESCE(p_user_email, '')));

  IF v_email_norm <> '' AND EXISTS (
    SELECT 1 FROM public.claim_free_ineligible_emails e WHERE lower(e.email) = v_email_norm
  ) THEN
    RAISE EXCEPTION 'CLAIM_BLOCKED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row
  FROM public.claimed_codes
  WHERE code = btrim(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status = 'consumed' THEN
    IF v_row.user_id = p_user_id THEN
      RETURN v_row.id;
    END IF;
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status IN ('forfeited', 'expired') THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status = 'pending' AND v_row.expires_at < now() THEN
    UPDATE public.claimed_codes SET status = 'expired' WHERE id = v_row.id;
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  v_limit := public.get_free_plan_user_limit();
  IF v_limit >= 0 THEN
    v_used := public.count_consumed_claim_codes();
    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'CLAIM_CAP_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.claimed_codes
  SET
    status = 'consumed',
    consumed_at = now(),
    user_id = p_user_id,
    user_email = NULLIF(v_email_norm, '')
  WHERE id = v_row.id;

  RETURN v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.forfeit_claim_code(
  p_code TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.claimed_codes%ROWTYPE;
  v_email_norm TEXT;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN;
  END IF;

  v_email_norm := lower(btrim(COALESCE(p_email, '')));

  SELECT * INTO v_row
  FROM public.claimed_codes
  WHERE code = btrim(p_code)
  FOR UPDATE;

  IF NOT FOUND OR v_row.status <> 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.claimed_codes
  SET status = 'forfeited', forfeited_at = now()
  WHERE id = v_row.id;

  IF v_email_norm <> '' THEN
    INSERT INTO public.claim_free_ineligible_emails (email, reason)
    VALUES (v_email_norm, 'forfeit')
    ON CONFLICT (email) DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_claim_code_to_workspace(
  p_code TEXT,
  p_user_id UUID,
  p_workspace_id BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.claimed_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.claimed_codes
  WHERE code = btrim(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.status <> 'consumed' OR v_row.user_id IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'INVALID_CLAIM' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.claimed_codes
  SET workspace_id = p_workspace_id
  WHERE id = v_row.id;

  RETURN v_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_claim_code(TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.forfeit_claim_code(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_claim_code_to_workspace(TEXT, UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_free_slots_remaining() TO service_role;
GRANT EXECUTE ON FUNCTION public.count_consumed_claim_codes() TO service_role;
