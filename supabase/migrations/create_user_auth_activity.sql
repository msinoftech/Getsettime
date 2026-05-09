-- Login / logout audit trail for workspace users (insert from workspace API; read from superadmin API).
create table if not exists public.user_auth_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  workspace_id bigint not null references public.workspaces (id) on delete cascade,
  event_type text not null check (event_type in ('login', 'logout')),
  supabase_auth_event text null,
  reason text null,
  ip_address text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_auth_activity_workspace_created
  on public.user_auth_activity (workspace_id, created_at desc);

create index if not exists idx_user_auth_activity_user_created
  on public.user_auth_activity (user_id, created_at desc);

comment on table public.user_auth_activity is 'Workspace user login/logout events; server-only via service role';

alter table public.user_auth_activity enable row level security;
