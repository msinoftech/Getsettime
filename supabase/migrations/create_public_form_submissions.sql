-- Marketing form submissions (contact, solutions, claim_free landing forms).

CREATE TABLE IF NOT EXISTS public.public_form_submissions (
  id BIGSERIAL PRIMARY KEY,
  form_type TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata_text TEXT GENERATED ALWAYS AS (metadata::text) STORED,
  source TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT public_form_submissions_form_type_check
    CHECK (form_type IN ('contact', 'solutions', 'claim_free'))
);

CREATE INDEX IF NOT EXISTS idx_public_form_submissions_created_at
  ON public.public_form_submissions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_form_submissions_form_type
  ON public.public_form_submissions (form_type);

COMMENT ON TABLE public.public_form_submissions IS
  'Unified marketing form posts from POST /api/public/submit-forms.';

ALTER TABLE public.public_form_submissions ENABLE ROW LEVEL SECURITY;