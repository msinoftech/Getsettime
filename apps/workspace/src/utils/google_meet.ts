import { parse_booking_location_meeting_option } from '@/src/types/event_type_location';
import type { meeting_option_key } from '@/src/utils/meeting_options';

const MEETING_OPTION_BODY_KEYS = new Set<meeting_option_key>([
  'google_meet',
  'in_person',
  'phone_call',
  'whatsapp',
]);

/** Parses `bookings.location` from POST body (`meeting_option` only). */
export function parse_location_meeting_option(location: unknown): meeting_option_key | null {
  if (!location || typeof location !== 'object') return null;
  const raw = (location as Record<string, unknown>).meeting_option;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const key = raw.trim() as meeting_option_key;
  if (!MEETING_OPTION_BODY_KEYS.has(key)) return null;
  return key;
}

/** Calendar `location` field: plain string only (not JSON meeting payload). */
export function calendar_event_location_string(location: unknown): string | undefined {
  if (typeof location === 'string' && location.trim()) return location.trim();
  return undefined;
}

/** True when the guest explicitly chose Google Meet for this booking. */
export function booking_wants_google_meet(location: unknown): boolean {
  if (!location || typeof location !== 'object') return false;
  return parse_booking_location_meeting_option(location as Record<string, unknown>) === 'google_meet';
}

/** Merge Meet URL into `bookings.location` (preserves meeting_option). */
export function merge_meet_into_booking_location(
  location: Record<string, unknown> | null | undefined,
  meetLink: string
): Record<string, unknown> {
  const trimmed = meetLink.trim();
  const base = location && typeof location === 'object' ? { ...location } : {};
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    base.meeting_url = trimmed;
  }
  return base;
}

const MEETING_JOIN_URL_KEYS = [
  'url',
  'link',
  'meeting_url',
  'join_url',
  'hangoutLink',
  'hangout_link',
  'meet_link',
  'conference_url',
] as const;

function read_https_url(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  return undefined;
}

/** Matches booking-preview URL resolution — used by reminders/cron/UI. */
export function resolve_meeting_join_url_from_booking(
  location: unknown,
  metadata: unknown
): string | undefined {
  const locObj = location && typeof location === 'object' ? (location as Record<string, unknown>) : null;
  const metaObj = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>) : null;
  if (locObj) {
    for (const key of MEETING_JOIN_URL_KEYS) {
      const u = read_https_url(locObj[key]);
      if (u) return u;
    }
  }
  if (metaObj) {
    for (const key of MEETING_JOIN_URL_KEYS) {
      const u = read_https_url(metaObj[key]);
      if (u) return u;
    }
  }
  return undefined;
}
