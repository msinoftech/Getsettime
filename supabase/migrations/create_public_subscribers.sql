-- Marketing / pricing-page email signups (public API, service-role writes).

CREATE TABLE IF NOT EXISTS public.public_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NULL
);

COMMENT ON TABLE public.public_subscribers IS
  'Email-only signups from allowlisted external sites (POST /api/public/subscribers).';

ALTER TABLE public.public_subscribers ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies; workspace API uses service role.