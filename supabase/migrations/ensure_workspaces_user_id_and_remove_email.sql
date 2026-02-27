-- Ensure workspaces table has user_id column and remove email if exists
-- One user should have only one workspace (enforced via unique constraint)

-- Add user_id column if not exists
alter table if exists public.workspaces
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Create unique index on user_id to enforce one workspace per user
create unique index if not exists idx_workspaces_user_id_unique on public.workspaces(user_id);

-- Remove email column if it exists (we use user_id to link to auth.users)
alter table if exists public.workspaces
  drop column if exists email;

-- Add index for faster lookups
create index if not exists idx_workspaces_user_id on public.workspaces(user_id);
