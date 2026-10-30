import type {
  event_type_format,
  event_type_recurrence_audience,
} from '@/src/types/event_types';

export const EVENT_TYPE_FORMAT_OPTIONS: ReadonlyArray<{
  value: event_type_format;
  label: string;
  description: string;
}> = [
  // {
  //   value: 'recurring',
  //   label: 'Recurring',
  //   description: 'Book a series of sessions over time.',
  // },
  {
    value: 'recurring',
    label: 'One Time',
    description: 'Book a series of sessions over time.',
  },
  {
    value: 'one_on_one',
    label: 'One-to-one',
    description: 'Single booking that occurs once.',
  },
  {
    value: 'group_class',
    label: 'Group / Class',
    description: 'Book for multiple attendees in thesame session.',
  },
];

export function parse_event_type_format(value: unknown): event_type_format {
  if (value === 'recurring' || value === 'group_class') return value;
  return 'one_on_one';
}

export function is_fixed_capacity_event_type_format(
  format: event_type_format,
  audience: event_type_recurrence_audience = 'single'
): boolean {
  if (format === 'one_on_one') return true;
  if (format === 'recurring') return audience !== 'group';
  return false;
}

export function default_capacity_for_event_type_format(
  format: event_type_format,
  audience: event_type_recurrence_audience = 'single'
): number {
  return is_fixed_capacity_event_type_format(format, audience) ? 1 : 10;
}

/**
 * Server-side capacity resolution. one_on_one and One Time + Single always
 * persist as 1. group_class and One Time + Group use the provided value.
 */
export function resolve_capacity_per_slot(
  format: event_type_format,
  capacity: unknown,
  audience: event_type_recurrence_audience = 'single'
): { ok: true; value: number } | { ok: false; message: string } {
  if (is_fixed_capacity_event_type_format(format, audience)) {
    return { ok: true, value: 1 };
  }

  if (capacity === null || capacity === undefined) {
    return { ok: true, value: 10 };
  }

  const raw =
    typeof capacity === 'number' && Number.isFinite(capacity)
      ? String(Math.trunc(capacity))
      : String(capacity).trim();

  if (!raw) {
    return { ok: true, value: 10 };
  }

  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      message: 'Capacity per slot must be a whole number (1 or more).',
    };
  }

  const n = parseInt(raw, 10);
  if (n < 1) {
    return {
      ok: false,
      message: 'Capacity per slot must be at least 1.',
    };
  }

  return { ok: true, value: n };
}

export function parse_internal_label(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
