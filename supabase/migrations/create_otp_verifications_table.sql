-- Create OTP verifications table for storing OTP codes
CREATE TABLE IF NOT EXISTS otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- normalized phone or email
  code TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('email', 'phone')),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for faster lookups
  CONSTRAINT unique_identifier UNIQUE (identifier)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON otp_verifications(identifier);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can access (server-side only)
-- This table should only be accessed via server-side code with service role key
CREATE POLICY "Service role only" ON otp_verifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to automatically clean up expired OTPs (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otp_verifications
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

