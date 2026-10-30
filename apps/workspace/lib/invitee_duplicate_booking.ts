import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getCalendarDateInTimezone,
  localDateTimeToUtcIso,
} from '@/lib/date-timezone';

export const INVITEE_DUPLICATE_DATE_MESSAGE =
  'You already have a booking on the selected date.';

const INACTIVE_BOOKING_STATUSES = new Set([
  'cancelled',
  'deleted',
  'emergency',
]);

export type invitee_identity = {
  invitee_email?: string | null;
  invitee_phone?: string | null;
  contact_id?: string | number | null;
};

export type invitee_booking_row = invitee_identity & {
  id?: string | number | null;
  start_at: string;
  status?: string | null;
  event_type_id?: string | number | null;
  public_code?: string | null;
};

export type duplicate_invitee_booking_payload = {
  public_code?: string | null;
  preview_path?: string | null;
};

export function booking_preview_path(
  public_code: string | null | undefined
): string | null {
  const code = public_code?.trim();
  return code ? `/booking-preview/${code}` : null;
}

export function duplicate_invitee_info_from_row(
  row: invitee_booking_row | null
): {
  message: string;
  duplicate_booking: duplicate_invitee_booking_payload;
} | null {
  if (!row) return null;
  const preview_path = booking_preview_path(row.public_code);
  return {
    message: INVITEE_DUPLICATE_DATE_MESSAGE,
    duplicate_booking: {
      public_code: row.public_code ?? null,
      preview_path,
    },
  };
}

function normalize_invitee_email(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

function normalize_invitee_phone(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  return digits || trimmed;
}

export function invitee_identities_match(
  a: invitee_identity,
  b: invitee_identity
): boolean {
  const contact_a =
    a.contact_id != null && a.contact_id !== '' ? String(a.contact_id) : null;
  const contact_b =
    b.contact_id != null && b.contact_id !== '' ? String(b.contact_id) : null;
  if (contact_a && contact_b && contact_a === contact_b) return true;

  const email_a = normalize_invitee_email(a.invitee_email);
  const email_b = normalize_invitee_email(b.invitee_email);
  if (email_a && email_b && email_a === email_b) return true;

  const phone_a = normalize_invitee_phone(a.invitee_phone);
  const phone_b = normalize_invitee_phone(b.invitee_phone);
  if (phone_a && phone_b && phone_a === phone_b) return true;

  return false;
}

function is_active_booking_status(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').trim().toLowerCase();
  return Boolean(normalized) && !INACTIVE_BOOKING_STATUSES.has(normalized);
}

function day_utc_range(
  date_str: string,
  timezone: string
): { from: string; to: string } {
  const [year, month, day] = date_str.split('-').map((part) => parseInt(part, 10));
  const next = new Date(year, month - 1, day);
  next.setDate(next.getDate() + 1);
  const next_str = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
  return {
    from: localDateTimeToUtcIso(date_str, 0, 0, timezone),
    to: localDateTimeToUtcIso(next_str, 0, 0, timezone),
  };
}

export function find_duplicate_invitee_booking_on_date(
  bookings: invitee_booking_row[],
  params: {
    start_at: string;
    timezone: string;
    event_type_id?: string | number | null;
    invitee: invitee_identity;
    exclude_booking_id?: string | number | null;
  }
): invitee_booking_row | null {
  if (!params.event_type_id) return null;

  const target_event_type = String(params.event_type_id);
  const target_date = getCalendarDateInTimezone(params.start_at, params.timezone);
  const exclude_id =
    params.exclude_booking_id != null && params.exclude_booking_id !== ''
      ? String(params.exclude_booking_id)
      : null;

  for (const row of bookings) {
    if (!row.start_at) continue;
    if (exclude_id && row.id != null && String(row.id) === exclude_id) continue;
    if (!is_active_booking_status(row.status)) continue;
    if (row.event_type_id == null || String(row.event_type_id) !== target_event_type) {
      continue;
    }
    if (getCalendarDateInTimezone(row.start_at, params.timezone) !== target_date) {
      continue;
    }
    if (invitee_identities_match(params.invitee, row)) {
      return row;
    }
  }

  return null;
}

export async function find_duplicate_invitee_booking_on_date_db(
  supabase: SupabaseClient,
  params: {
    workspace_id: string | number;
    start_at: string;
    timezone: string;
    event_type_id?: string | number | null;
    invitee: invitee_identity;
    exclude_booking_id?: string | number | null;
  }
): Promise<invitee_booking_row | null> {
  if (!params.event_type_id) return null;

  const target_date = getCalendarDateInTimezone(params.start_at, params.timezone);
  const { from, to } = day_utc_range(target_date, params.timezone);

  let query = supabase
    .from('bookings')
    .select('id, start_at, status, event_type_id, invitee_email, invitee_phone, contact_id, public_code')
    .eq('workspace_id', params.workspace_id)
    .eq('event_type_id', params.event_type_id)
    .gte('start_at', from)
    .lt('start_at', to);

  if (params.exclude_booking_id != null && params.exclude_booking_id !== '') {
    query = query.neq('id', params.exclude_booking_id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('find_duplicate_invitee_booking_on_date_db:', error);
    return null;
  }

  return find_duplicate_invitee_booking_on_date((data ?? []) as invitee_booking_row[], {
    start_at: params.start_at,
    timezone: params.timezone,
    event_type_id: params.event_type_id,
    invitee: params.invitee,
    exclude_booking_id: params.exclude_booking_id,
  });
}

export async function assert_no_duplicate_invitee_booking_on_date(
  supabase: SupabaseClient,
  params: {
    workspace_id: string | number;
    start_at: string;
    timezone: string;
    event_type_id?: string | number | null;
    invitee: invitee_identity;
    exclude_booking_id?: string | number | null;
  }
): Promise<
  | { ok: true }
  | {
      ok: false;
      message: string;
      duplicate_booking?: duplicate_invitee_booking_payload;
    }
> {
  const duplicate = await find_duplicate_invitee_booking_on_date_db(supabase, params);
  if (duplicate) {
    const info = duplicate_invitee_info_from_row(duplicate);
    return {
      ok: false,
      message: info?.message ?? INVITEE_DUPLICATE_DATE_MESSAGE,
      duplicate_booking: info?.duplicate_booking,
    };
  }
  return { ok: true };
}
