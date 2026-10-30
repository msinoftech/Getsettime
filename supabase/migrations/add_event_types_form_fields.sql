-- Consolidated event_types columns/indexes for the event type form wizard:
-- internal label, format, capacity, availability mode, recurrence,
-- booking options, and workspace-scoped slug uniqueness.

-- Internal label, format, capacity
alter table public.event_types
  add column if not exists internal_label text null;

alter table public.event_types
  add column if not exists event_type_format text not null default 'one_on_one';

alter table public.event_types
  drop constraint if exists event_types_event_type_format_check;

alter table public.event_types
  add constraint event_types_event_type_format_check
  check (event_type_format in ('one_on_one', 'recurring', 'group_class'));

alter table public.event_types
  add column if not exists capacity_per_slot integer not null default 1;

alter table public.event_types
  drop constraint if exists event_types_capacity_per_slot_check;

alter table public.event_types
  add constraint event_types_capacity_per_slot_check
  check (capacity_per_slot >= 1);

update public.event_types
set event_type_format = 'one_on_one'
where event_type_format is null;

update public.event_types
set capacity_per_slot = 1
where capacity_per_slot is null;

create index if not exists idx_event_types_event_type_format
  on public.event_types(event_type_format);

-- Availability mode
alter table public.event_types
  add column if not exists availability_mode text not null default 'provider';

alter table public.event_types
  drop constraint if exists event_types_availability_mode_check;

alter table public.event_types
  add constraint event_types_availability_mode_check
  check (availability_mode in ('provider', 'custom'));

update public.event_types
set availability_mode = 'provider'
where availability_mode is null;

-- Recurrence
alter table public.event_types
  add column if not exists recurrence jsonb null;

-- Booking options
alter table public.event_types
  add column if not exists allow_waitlist boolean not null default true;

alter table public.event_types
  add column if not exists min_booking_notice_minutes integer not null default 120;

alter table public.event_types
  add column if not exists max_booking_window_days integer not null default 30;

alter table public.event_types
  add column if not exists allow_reschedule boolean not null default true;

alter table public.event_types
  add column if not exists allow_cancellation boolean not null default true;

alter table public.event_types
  drop constraint if exists event_types_min_booking_notice_minutes_check;

alter table public.event_types
  add constraint event_types_min_booking_notice_minutes_check
  check (min_booking_notice_minutes >= 0);

alter table public.event_types
  drop constraint if exists event_types_max_booking_window_days_check;

alter table public.event_types
  add constraint event_types_max_booking_window_days_check
  check (max_booking_window_days >= 1);

update public.event_types
set
  allow_waitlist = coalesce(allow_waitlist, true),
  min_booking_notice_minutes = coalesce(min_booking_notice_minutes, 120),
  max_booking_window_days = coalesce(max_booking_window_days, 30),
  allow_reschedule = coalesce(allow_reschedule, true),
  allow_cancellation = coalesce(allow_cancellation, true);

-- Slug unique within workspace
create unique index if not exists event_types_workspace_id_slug_uidx
  on public.event_types (workspace_id, slug)
  where slug is not null and btrim(slug) <> '';
