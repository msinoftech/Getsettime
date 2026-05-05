-- RLS policies referenced auth.users for workspace_id; the authenticated role
-- cannot SELECT auth.users, causing: permission denied for table users.
-- Use auth.jwt() user_metadata (same pattern as fix_contacts_rls_use_jwt.sql).

-- user_departments
drop policy if exists "Users can view user_departments from their workspace" on public.user_departments;
create policy "Users can view user_departments from their workspace"
  on public.user_departments for select
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can create user_departments for their workspace" on public.user_departments;
create policy "Users can create user_departments for their workspace"
  on public.user_departments for insert
  with check (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can update user_departments in their workspace" on public.user_departments;
create policy "Users can update user_departments in their workspace"
  on public.user_departments for update
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can delete user_departments from their workspace" on public.user_departments;
create policy "Users can delete user_departments from their workspace"
  on public.user_departments for delete
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

-- user_services
drop policy if exists "Users can view user_services from their workspace" on public.user_services;
create policy "Users can view user_services from their workspace"
  on public.user_services for select
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can create user_services for their workspace" on public.user_services;
create policy "Users can create user_services for their workspace"
  on public.user_services for insert
  with check (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can update user_services in their workspace" on public.user_services;
create policy "Users can update user_services in their workspace"
  on public.user_services for update
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );

drop policy if exists "Users can delete user_services from their workspace" on public.user_services;
create policy "Users can delete user_services from their workspace"
  on public.user_services for delete
  using (
    workspace_id = (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::bigint
  );
