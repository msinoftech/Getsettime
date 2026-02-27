import type { EventType } from '@/src/types/bookingForm';

export function sortEventTypesByDuration(eventTypes: EventType[]): EventType[] {
  return [...eventTypes].sort(
    (a, b) => (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity)
  );
}

export function filterEventTypesBySlug(eventTypes: EventType[], slug: string): EventType[] {
  if (!slug) return eventTypes;
  return eventTypes.filter((t) => t.slug === slug);
}

export function filterEventTypesByDuration(eventTypes: EventType[], duration: number): EventType[] {
  return eventTypes.filter((t) => t.duration_minutes === duration);
}

/**
 * Parse event type duration from URL param (e.g. "15mins" -> 15, "30min" -> 30).
 * Returns null if not a valid duration string.
 */
export function parseEventTypeDurationParam(eventType: string | undefined): number | null {
  if (!eventType) return null;
  const match = eventType.match(/^(\d+)(?:min|mins|minute|minutes)?$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Filter by slug or duration, then sort. For embed eventType/eventTypeSlug URL params.
 */
export function getSortedFilteredEventTypes(
  eventTypes: EventType[],
  opts: { slug?: string; duration?: number | null }
): EventType[] {
  let filtered = eventTypes;
  if (opts.slug) filtered = filterEventTypesBySlug(filtered, opts.slug);
  else if (opts.duration != null) filtered = filterEventTypesByDuration(filtered, opts.duration);
  return sortEventTypesByDuration(filtered);
}
