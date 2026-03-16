-- Fix contacts RLS: use auth.jwt() instead of auth.users to avoid "permission denied for table users"
-- auth.jwt() reads user_metadata from the JWT token without querying auth.users

drop policy if exists "Users can view contacts from their workspace" on public.contacts;
create policy "Users can view contacts from their workspace"
  on public.contacts for select
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can create contacts for their workspace" on public.contacts;
create policy "Users can create contacts for their workspace"
  on public.contacts for insert
  with check (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can update contacts in their workspace" on public.contacts;
create policy "Users can update contacts in their workspace"
  on public.contacts for update
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can delete contacts from their workspace" on public.contacts;
create policy "Users can delete contacts from their workspace"
  on public.contacts for delete
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );
