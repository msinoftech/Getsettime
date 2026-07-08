-- Publishing lifecycle for event types (active = bookable, draft = hidden from booking flows).
alter table public.event_types
  add column if not exists status text not null default 'active'
  check (status in ('active', 'draft'));

create index if not exists idx_event_types_status on public.event_types(status);

update public.event_types
set status = 'active'
where status is null;
