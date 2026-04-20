-- Add `status` (active/inactive) and `flag` (soft-delete visibility) columns to departments.
-- status: controls visibility in booking flows (Activate/Inactivate in workspace UI).
-- flag:  true = visible in workspace UI, false = soft-deleted/hidden from the left list.
alter table public.departments
  add column if not exists status text not null default 'active'
  check (status in ('active', 'inactive'));

alter table public.departments
  add column if not exists flag boolean not null default true;

create index if not exists idx_departments_status on public.departments(status);
create index if not exists idx_departments_flag on public.departments(flag);
