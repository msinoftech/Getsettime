-- Structured activity/audit events for workspace notifications and navigation targets.
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id bigint not null references public.workspaces (id) on delete cascade,
  actor_user_id uuid null,
  entity_type text not null check (
    entity_type in (
      'booking',
      'contact',
      'event_type',
      'department',
      'service',
      'availability',
      'settings'
    )
  ),
  entity_id text null,
  action text not null check (action in ('created', 'updated', 'deleted')),
  title text not null,
  description text not null default '',
  before_data jsonb null,
  after_data jsonb null,
  changed_fields text[] not null default '{}',
  target_path text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_events_workspace_created
  on public.activity_events (workspace_id, created_at desc);

create index if not exists idx_activity_events_workspace_entity
  on public.activity_events (workspace_id, entity_type, entity_id);

alter table public.activity_events enable row level security;

drop policy if exists "Users can view activity_events from their workspace" on public.activity_events;
create policy "Users can view activity_events from their workspace"
  on public.activity_events for select
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can create activity_events for their workspace" on public.activity_events;
create policy "Users can create activity_events for their workspace"
  on public.activity_events for insert
  with check (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

