-- Store invitee profile fields on pending invites (applied to user_metadata on accept).
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;
