-- Track superadmin "seen" state for integration request notifications (existing DBs).
alter table public.integration_requests
  add column if not exists seen_at timestamptz null;

create index if not exists idx_integration_requests_unseen
  on public.integration_requests (workspace_id)
  where seen_at is null;
