import type { meeting_options_settings } from '@/src/types/workspace';

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
