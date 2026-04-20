-- Add duration, status, flag, and meta_data columns to services to support the
-- Department Service Management layout (per-service duration, active/inactive
-- toggling, soft-delete, and doctor->service mapping via meta_data).
-- status: controls visibility in customer booking (Active/Inactive in workspace UI).
-- flag:   true = visible in workspace UI, false = soft-deleted (hidden from list
--         but preserves meta_data.service_providers for restore-on-readd).
-- meta_data: jsonb bag; `service_providers: [{id, name}]` holds doctors
--         explicitly assigned to this service inside its department.
alter table public.services
  add column if not exists duration integer not null default 30,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'inactive')),
  add column if not exists flag boolean not null default true,
  add column if not exists meta_data jsonb null;

create index if not exists idx_services_status on public.services(status);
create index if not exists idx_services_flag on public.services(flag);
