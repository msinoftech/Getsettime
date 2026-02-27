-- One-time tokens for Google signup → /auth/callback session handoff.
-- Only server-side (service_role) should access this table.
create table if not exists public.auth_callback_tokens (
  id uuid primary key,
  access_token text not null,
  refresh_token text not null,
  created_at timestamptz default now()
);

-- Expire after 2 minutes; cleanup can be done via cron or on read
create index if not exists idx_auth_callback_tokens_created_at
  on public.auth_callback_tokens(created_at);

alter table public.auth_callback_tokens enable row level security;

-- No policies: only service_role (used in API routes) can access.
