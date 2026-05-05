-- Workspace admin requests for new integrations (superadmin visibility)
create table if not exists public.integration_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id bigint not null references public.workspaces (id) on delete cascade,
  workspace_name text not null,
  requested_by_user_id uuid not null,
  workspace_admin_email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  seen_at timestamptz null
);

create index if not exists idx_integration_requests_workspace_id on public.integration_requests (workspace_id);
create index if not exists idx_integration_requests_created_at on public.integration_requests (created_at desc);
create index if not exists idx_integration_requests_unseen on public.integration_requests (workspace_id) where seen_at is null;

comment on table public.integration_requests is 'Requests from workspace admins to add integrations; superadmin reviews';

-- Server-only access: workspace/superadmin APIs use the service role (RLS bypass).
-- No policies for anon/authenticated => direct PostgREST access from browsers is denied.
alter table public.integration_requests enable row level security;
