-- Add verified fields to otp_verifications table
-- Run this migration if the table already exists

ALTER TABLE otp_verifications 
ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE otp_verifications 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

