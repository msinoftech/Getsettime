-- Event types: department/service assignment, booking-pattern fields,
-- and strip deferred recurring product flags from stored recurrence jsonb.

alter table public.event_types
  add column if not exists department_id bigint null references public.departments (id) on delete set null;

alter table public.event_types
  add column if not exists service_id uuid null references public.services (id) on delete set null;

alter table public.event_types
  add column if not exists service_provider_ids uuid[] not null default '{}'::uuid[];

alter table public.event_types
  add column if not exists show_seats_remaining boolean not null default true;

alter table public.event_types
  add column if not exists waitlist_capacity integer null;

alter table public.event_types
  drop constraint if exists event_types_waitlist_capacity_check;

alter table public.event_types
  add constraint event_types_waitlist_capacity_check
  check (waitlist_capacity is null or waitlist_capacity >= 0);

create index if not exists idx_event_types_department_id
  on public.event_types (department_id);

create index if not exists idx_event_types_service_id
  on public.event_types (service_id);

create index if not exists idx_event_types_service_provider_ids
  on public.event_types using gin (service_provider_ids);

comment on column public.event_types.department_id is
  'Workspace department this event type belongs to.';

comment on column public.event_types.service_id is
  'Service assigned to this event type (must belong to department_id).';

comment on column public.event_types.service_provider_ids is
  'Service providers who can be booked for this event type (assigned to service_id).';

update public.event_types
set show_seats_remaining = coalesce(show_seats_remaining, true);

-- Recurring settings stay in event_types.recurrence jsonb.
-- Custom session counts stay as session_preset + custom_session_count.
update public.event_types
set recurrence = (
  recurrence
  - 'allow_custom_count'
  - 'same_provider_for_series'
  - 'allow_minor_schedule_adjustment'
  - 'max_adjusted_sessions'
)
where recurrence is not null
  and (
    recurrence ? 'allow_custom_count'
    or recurrence ? 'same_provider_for_series'
    or recurrence ? 'allow_minor_schedule_adjustment'
    or recurrence ? 'max_adjusted_sessions'
  );
