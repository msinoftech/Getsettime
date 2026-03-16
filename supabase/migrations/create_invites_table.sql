-- Create invites table for storing team member invitations
CREATE TABLE IF NOT EXISTS public.invites (
  id BIGSERIAL PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  departments INTEGER[],
  workspace_id BIGINT NOT NULL,
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);
CREATE INDEX IF NOT EXISTS idx_invites_email ON public.invites(email);
CREATE INDEX IF NOT EXISTS idx_invites_workspace_id ON public.invites(workspace_id);

-- Add RLS policies
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Policy: Workspace admins and managers can view invites for their workspace
CREATE POLICY "Workspace admins and managers can view invites" ON public.invites
  FOR SELECT
  USING (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::BIGINT
    AND (auth.jwt() -> 'user_metadata' ->> 'role') IN ('workspace_admin', 'manager')
  );

-- Policy: Workspace admins and managers can create invites
CREATE POLICY "Workspace admins and managers can create invites" ON public.invites
  FOR INSERT
  WITH CHECK (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::BIGINT
    AND (auth.jwt() -> 'user_metadata' ->> 'role') IN ('workspace_admin', 'manager')
  );

-- Policy: Allow public read for invite validation (needed for invite acceptance page)
-- We'll validate expiration and usage in the application code
CREATE POLICY "Anyone can validate invites by token" ON public.invites
  FOR SELECT
  USING (true);

-- Policy: Service role can update invites (for marking as used)
-- This will be done via API routes with service role key

