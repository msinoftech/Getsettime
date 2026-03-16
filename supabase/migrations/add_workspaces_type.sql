-- Add profession type to workspaces (Doctor / Salon / Artist)
alter table if exists public.workspaces
  add column if not exists type text;
