-- Idempotent login audit: one row per Supabase auth session (JWT session_id claim).
alter table public.user_auth_activity
  add column if not exists auth_session_id text null;

comment on column public.user_auth_activity.auth_session_id is 'GoTrue session_id from access JWT; used to dedupe duplicate SIGNED_IN';

create unique index if not exists uq_user_auth_activity_login_session
  on public.user_auth_activity (user_id, workspace_id, auth_session_id)
  where event_type = 'login' and auth_session_id is not null;
