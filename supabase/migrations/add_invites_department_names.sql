-- Catalog department names to create in workspace when invite is accepted / onboarding step 2.
ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS department_names TEXT[] DEFAULT '{}';
