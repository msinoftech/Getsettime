-- Widen services.status to support booking visibility options:
-- Public (active), Private (private), Draft (draft).
-- Keep legacy 'inactive' for existing rows; UI maps it to Private.
alter table public.services
  drop constraint if exists services_status_check;

alter table public.services
  add constraint services_status_check
  check (status in ('active', 'inactive', 'private', 'draft'));
