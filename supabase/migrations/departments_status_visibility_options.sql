-- Widen departments.status to support booking visibility options:
-- Public (active), Private (private), Draft (draft).
-- Keep legacy 'inactive' for existing rows; UI maps it to Private.
alter table public.departments
  drop constraint if exists departments_status_check;

alter table public.departments
  add constraint departments_status_check
  check (status in ('active', 'inactive', 'private', 'draft'));
