-- Short URL mappings for public booking links and future marketing URLs.
-- Server routes use service_role; no RLS policies (same pattern as auth_callback_tokens).
create table if not exists public.short_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id bigint not null references public.workspaces (id) on delete cascade,
  short_code text not null,
  original_url text not null,
  link_type text not null default 'public_booking',
  created_by uuid null,
  created_at timestamptz not null default now(),
  constraint short_links_short_code_unique unique (short_code),
  constraint short_links_workspace_original_unique unique (workspace_id, original_url)
);

create index if not exists idx_short_links_short_code on public.short_links (short_code);

alter table public.short_links enable row level security;
