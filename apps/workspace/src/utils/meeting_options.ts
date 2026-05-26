import type { meeting_options_settings } from '@/src/types/workspace';
import {
  EVENT_TYPE_LOCATION_TO_MEETING_OPTION,
  parse_event_type_location_types,
  type event_type_location_with_meeting_option,
} from '@/src/types/event_type_location';

/** Keys stored under `settings.meeting_options` (RegisterForm / settings page). */
export type meeting_option_key = 'google_meet' | 'in_person' | 'phone_call' | 'whatsapp';

/** Maps to `event_types.location_type` (whatsapp has no event-type location). */
export type event_type_location_from_meeting = 'video' | 'phone' | 'in_person';

const MEETING_OPTION_ORDER: meeting_option_key[] = [
  'google_meet',
  'in_person',
  'phone_call',
  'whatsapp',
];

/**
 * Pick a default `event_types.location_type` from workspace `meeting_options`.
 * Order: in_person → phone_call → google_meet. WhatsApp does not map; only-whatsapp leaves null (caller skips DB update).
 */
export function workspace_meeting_options_to_location(
  meeting_options: meeting_options_settings | unknown
): event_type_location_from_meeting | null {
  if (!meeting_options || typeof meeting_options !== 'object') return null;
  const opts = meeting_options as Record<string, unknown>;
  if (opts.in_person === true) return 'in_person';
  if (opts.phone_call === true) return 'phone';
  if (opts.google_meet === true) return 'video';
  return null;
}

/** Enabled keys in stable display order. */
export function list_enabled_meeting_option_keys(
  meeting_options: meeting_options_settings | unknown
): meeting_option_key[] {
  if (!meeting_options || typeof meeting_options !== 'object') return [];
  const opts = meeting_options as Record<string, unknown>;
  return MEETING_OPTION_ORDER.filter((k) => opts[k] === true);
}

export function label_for_meeting_option_key(key: meeting_option_key): string {
  switch (key) {
    case 'google_meet':
      return 'Google Meet';
    case 'in_person':
      return 'In-person';
    case 'phone_call':
      return 'Phone call';
    case 'whatsapp':
      return 'WhatsApp notification';
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** Single implicit choice, or the user's selection when multiple are enabled. */
export function effective_meeting_option_key(
  enabledKeys: meeting_option_key[],
  selectedWhenMultiple: string
): meeting_option_key | null {
  if (enabledKeys.length === 0) return null;
  if (enabledKeys.length === 1) return enabledKeys[0];
  const t = selectedWhenMultiple.trim();
  if (!t || !enabledKeys.includes(t as meeting_option_key)) return null;
  return t as meeting_option_key;
}

export { parse_event_type_location_types } from '@/src/types/event_type_location';

/** Map event-type location to onboarding `meeting_options` key (`custom` has no key). */
export function event_type_location_to_meeting_option_key(
  location: string
): meeting_option_key | null {
  if (!location || !(location in EVENT_TYPE_LOCATION_TO_MEETING_OPTION)) {
    return null;
  }
  return EVENT_TYPE_LOCATION_TO_MEETING_OPTION[
    location as event_type_location_with_meeting_option
  ];
}

/**
 * Meeting options bookable for an event type.
 * When `location_type` is set (e.g. `in_person,phone`), each value is split and mapped to a booking key.
 * When empty, falls back to workspace/provider enabled `meeting_options` (legacy).
 */
export function list_bookable_meeting_option_keys(
  eventTypeLocationType: string | null | undefined,
  meeting_options: meeting_options_settings | unknown
): meeting_option_key[] {
  const eventLocations = parse_event_type_location_types(eventTypeLocationType);
  const fromEvent = eventLocations
    .map((loc) => event_type_location_to_meeting_option_key(loc))
    .filter((k): k is meeting_option_key => k != null);

  if (fromEvent.length > 0) {
    return MEETING_OPTION_ORDER.filter((k) => fromEvent.includes(k));
  }

  return list_enabled_meeting_option_keys(meeting_options);
}

/** Default booking choice: onboarding preference when it is bookable, else first event-type option. */
export function default_booking_meeting_option_key(
  bookableKeys: meeting_option_key[],
  meeting_options: meeting_options_settings | unknown
): meeting_option_key | null {
  if (bookableKeys.length === 0) return null;
  const workspaceEnabled = list_enabled_meeting_option_keys(meeting_options);
  for (const k of MEETING_OPTION_ORDER) {
    if (bookableKeys.includes(k) && workspaceEnabled.includes(k)) return k;
  }
  return MEETING_OPTION_ORDER.find((k) => bookableKeys.includes(k)) ?? bookableKeys[0] ?? null;
}
