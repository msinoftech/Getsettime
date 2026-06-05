/** Event-type `location_type` values (DB: single or comma-separated). */
export const EVENT_TYPE_LOCATION_OPTIONS = [
  { value: 'in_person', label: 'In person' },
  { value: 'phone', label: 'Phone' },
  { value: 'video', label: 'Google Meet' },
  { value: 'custom', label: 'Custom' },
] as const;

export type event_type_location_value =
  (typeof EVENT_TYPE_LOCATION_OPTIONS)[number]['value'];

export const EVENT_TYPE_LOCATION_VALUES: readonly event_type_location_value[] =
  EVENT_TYPE_LOCATION_OPTIONS.map((o) => o.value);

const LOCATION_TYPE_SET = new Set<string>(EVENT_TYPE_LOCATION_VALUES);

/** Stored on `bookings.location.meeting_option` when guest picks a type at booking. */
export const BOOKING_MEETING_OPTION_TO_LOCATION: Record<
  string,
  event_type_location_value
> = {
  in_person: 'in_person',
  phone_call: 'phone',
  google_meet: 'video',
};

/** Event-type locations that map to a `bookings.location.meeting_option` value (`custom` does not). */
export type event_type_location_with_meeting_option = Exclude<
  event_type_location_value,
  'custom'
>;

export const EVENT_TYPE_LOCATION_TO_MEETING_OPTION: Record<
  event_type_location_with_meeting_option,
  'in_person' | 'phone_call' | 'google_meet'
> = {
  in_person: 'in_person',
  phone: 'phone_call',
  video: 'google_meet',
};

export function parse_event_type_location_types(
  value: string | null | undefined
): event_type_location_value[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is event_type_location_value => LOCATION_TYPE_SET.has(s));
}

export function serialize_event_type_location_types(
  types: event_type_location_value[]
): string | null {
  const unique = [...new Set(types)].filter((t) => LOCATION_TYPE_SET.has(t));
  return unique.length > 0 ? unique.join(',') : null;
}

export function label_for_event_type_location(
  value: event_type_location_value
): string {
  return (
    EVENT_TYPE_LOCATION_OPTIONS.find((o) => o.value === value)?.label ?? value
  );
}

export function format_event_type_location_labels(
  types: event_type_location_value[]
): string {
  if (types.length === 0) return 'Not set';
  return types.map(label_for_event_type_location).join(', ');
}

export function meeting_option_key_to_event_type_location(
  meetingOption: string | null | undefined
): event_type_location_value | null {
  if (!meetingOption?.trim()) return null;
  return BOOKING_MEETING_OPTION_TO_LOCATION[meetingOption.trim()] ?? null;
}

export function parse_booking_location_meeting_option(
  location: Record<string, unknown> | null | undefined
): string | null {
  const raw = location?.meeting_option;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw.trim();
}

/**
 * Label for the meeting/location type chosen on the booking (`bookings.location`),
 * using event-type labels. Falls back to allowed types from `event_types.location_type`.
 */
export function format_booking_location_type_display(
  bookingLocation: Record<string, unknown> | null | undefined,
  eventTypeLocationType: string | null | undefined
): string {
  const meetingOption = parse_booking_location_meeting_option(bookingLocation);
  if (meetingOption) {
    const loc = meeting_option_key_to_event_type_location(meetingOption);
    if (loc) return label_for_event_type_location(loc);
    return meetingOption;
  }

  const allowed = parse_event_type_location_types(eventTypeLocationType);
  if (allowed.length > 0) {
    return `Not selected (available: ${format_event_type_location_labels(allowed)})`;
  }

  return 'N/A';
}
