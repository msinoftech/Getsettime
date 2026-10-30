-- jsonb ->> returns text; bookings.event_type_id is bigint.
create or replace function public.insert_booking_if_capacity(p_row jsonb, p_capacity integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace_id bigint;
  v_provider_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_occupancy integer;
  v_capacity integer;
  v_inserted public.bookings;
begin
  v_capacity := greatest(coalesce(p_capacity, 1), 1);
  v_workspace_id := (p_row ->> 'workspace_id')::bigint;
  v_provider_id := nullif(p_row ->> 'service_provider_id', '')::uuid;
  v_start := (p_row ->> 'start_at')::timestamptz;
  v_end := coalesce(nullif(p_row ->> 'end_at', '')::timestamptz, v_start);

  if v_workspace_id is null or v_start is null then
    raise exception 'workspace_id and start_at are required';
  end if;

  perform pg_advisory_xact_lock(
    hashtext(
      v_workspace_id::text
      || ':'
      || coalesce(v_provider_id::text, '')
      || ':'
      || v_start::text
    )
  );

  select count(*)::integer
    into v_occupancy
  from public.bookings b
  where b.workspace_id = v_workspace_id
    and (v_provider_id is null or b.service_provider_id = v_provider_id)
    and b.status is distinct from 'cancelled'
    and b.status is distinct from 'deleted'
    and b.start_at < v_end
    and coalesce(b.end_at, b.start_at) > v_start;

  if v_occupancy >= v_capacity then
    raise exception 'BOOKING_SLOT_AT_CAPACITY';
  end if;

  insert into public.bookings (
    workspace_id,
    event_type_id,
    service_provider_id,
    service_provider_name,
    department_id,
    host_user_id,
    invitee_name,
    invitee_email,
    invitee_phone,
    contact_id,
    start_at,
    end_at,
    customer_timezone,
    provider_timezone,
    status,
    location,
    payment_id,
    metadata,
    public_code,
    series_id
  )
  values (
    v_workspace_id,
    nullif(p_row ->> 'event_type_id', '')::bigint,
    v_provider_id,
    nullif(p_row ->> 'service_provider_name', ''),
    nullif(p_row ->> 'department_id', '')::integer,
    nullif(p_row ->> 'host_user_id', '')::uuid,
    p_row ->> 'invitee_name',
    nullif(p_row ->> 'invitee_email', ''),
    nullif(p_row ->> 'invitee_phone', ''),
    nullif(p_row ->> 'contact_id', '')::bigint,
    v_start,
    nullif(p_row ->> 'end_at', '')::timestamptz,
    nullif(p_row ->> 'customer_timezone', ''),
    nullif(p_row ->> 'provider_timezone', ''),
    coalesce(nullif(p_row ->> 'status', ''), 'pending'),
    case when p_row ? 'location' then p_row -> 'location' else null end,
    nullif(p_row ->> 'payment_id', '')::bigint,
    case when p_row ? 'metadata' then p_row -> 'metadata' else null end,
    nullif(p_row ->> 'public_code', ''),
    nullif(p_row ->> 'series_id', '')::uuid
  )
  returning * into v_inserted;

  return to_jsonb(v_inserted);
end;
$$;
