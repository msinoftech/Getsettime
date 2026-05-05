-- Superadmin replies to workspace integration requests (email log)
create table if not exists public.integration_request_replies (
  id uuid primary key default gen_random_uuid(),
  integration_request_id uuid not null references public.integration_requests (id) on delete cascade,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_request_replies_request_id
  on public.integration_request_replies (integration_request_id);

create index if not exists idx_integration_request_replies_created_at
  on public.integration_request_replies (created_at desc);

comment on table public.integration_request_replies is 'Superadmin email copy log for integration request threads';

alter table public.integration_request_replies enable row level security;
