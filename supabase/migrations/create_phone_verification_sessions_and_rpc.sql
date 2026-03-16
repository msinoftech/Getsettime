-- Table: phone_verification_sessions
-- Stores short-lived session tokens after successful phone OTP verification.
-- Tokens grant read-only access to bookings for the verified phone number.
CREATE TABLE IF NOT EXISTS phone_verification_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + interval '10 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvs_token ON phone_verification_sessions(token);
CREATE INDEX IF NOT EXISTS idx_pvs_expires_at ON phone_verification_sessions(expires_at);

ALTER TABLE phone_verification_sessions ENABLE ROW LEVEL SECURITY;

-- Only server-side (service_role) can read/write this table
CREATE POLICY "Service role only" ON phone_verification_sessions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- SECURITY DEFINER: runs with owner privileges, safely bypasses RLS within its scope.
-- Validates the session token, resolves the verified phone, returns bookings.
CREATE OR REPLACE FUNCTION get_bookings_by_verified_phone(p_session_token UUID)
RETURNS TABLE (
  id UUID,
  invitee_name TEXT,
  invitee_email TEXT,
  invitee_phone TEXT,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  status TEXT,
  created_at TIMESTAMPTZ,
  event_type_title TEXT,
  workspace_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_phone_digits TEXT;
BEGIN
  -- Validate token and resolve phone
  SELECT s.phone_e164 INTO v_phone
  FROM phone_verification_sessions s
  WHERE s.token = p_session_token
    AND s.expires_at > NOW();

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired session token';
  END IF;

  -- Strip non-digits for flexible matching
  v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');

  RETURN QUERY
  SELECT
    b.id,
    b.invitee_name,
    b.invitee_email,
    b.invitee_phone,
    b.start_at,
    b.end_at,
    b.status,
    b.created_at,
    et.title AS event_type_title,
    w.name AS workspace_name
  FROM bookings b
  LEFT JOIN event_types et ON et.id = b.event_type_id
  LEFT JOIN workspaces w ON w.id = b.workspace_id
  WHERE b.invitee_phone IS NOT NULL
    AND (
      b.invitee_phone = v_phone
      OR regexp_replace(b.invitee_phone, '\D', '', 'g') = v_phone_digits
    )
  ORDER BY b.start_at DESC;
END;
$$;

-- Cleanup: delete expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_phone_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM phone_verification_sessions
  WHERE expires_at < NOW();
END;
$$;
