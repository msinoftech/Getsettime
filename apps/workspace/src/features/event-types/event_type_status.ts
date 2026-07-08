import type { event_type_status } from '@/src/types/event_types';

export const EVENT_TYPE_STATUS_OPTIONS: ReadonlyArray<{
  value: event_type_status;
  label: string;
  description: string;
}> = [
  {
    value: 'active',
    label: 'Active',
    description: 'Published and available for bookings',
  },
  {
    value: 'draft',
    label: 'Draft',
    description: 'Hidden from booking flows until published',
  },
];

export function parse_event_type_status(value: unknown): event_type_status {
  return value === 'draft' ? 'draft' : 'active';
}

export function is_bookable_event_type_status(status: unknown): boolean {
  return parse_event_type_status(status) === 'active';
}

export function event_type_status_label(status: unknown): string {
  return parse_event_type_status(status) === 'draft' ? 'Draft' : 'Active';
}

export function filter_bookable_event_types<T extends { status?: unknown }>(
  items: T[]
): T[] {
  return items.filter((item) => is_bookable_event_type_status(item.status));
}
