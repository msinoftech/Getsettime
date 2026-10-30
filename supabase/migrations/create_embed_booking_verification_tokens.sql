-- Context for embed booking OTP (e.g. email used at send time)
ALTER TABLE otp_verifications
  ADD COLUMN IF NOT EXISTS context JSONB;

-- One-time tokens after OTP verify for embed booking create
CREATE TABLE IF NOT EXISTS embed_booking_verification_tokens (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id BIGINT NOT NULL,
  invitee_phone_e164 TEXT NOT NULL,
  invitee_email_normalized TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_embed_booking_verification_tokens_workspace
  ON embed_booking_verification_tokens (workspace_id);

CREATE INDEX IF NOT EXISTS idx_embed_booking_verification_tokens_expires
  ON embed_booking_verification_tokens (expires_at);

ALTER TABLE embed_booking_verification_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only embed booking verification tokens"
  ON embed_booking_verification_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
