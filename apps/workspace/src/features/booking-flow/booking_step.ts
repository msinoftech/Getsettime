export type booking_step_id =
  | 'department_provider'
  | 'event_type'
  | 'date_time'
  | 'intake'
  | 'success';

export const DEFAULT_BOOKING_STEP_ORDER: readonly booking_step_id[] = [
  'event_type',
  'department_provider',
  'date_time',
  'intake',
  'success',
] as const;

export const BOOKING_STEP_IDS: readonly booking_step_id[] = DEFAULT_BOOKING_STEP_ORDER;

const STEP_ID_SET = new Set<string>(BOOKING_STEP_IDS);

export function is_booking_step_id(value: unknown): value is booking_step_id {
  return typeof value === 'string' && STEP_ID_SET.has(value);
}

export function progress_booking_step_ids(
  order: readonly booking_step_id[]
): booking_step_id[] {
  return order.filter((id) => id !== 'success');
}

export function booking_step_index(
  order: readonly booking_step_id[],
  id: booking_step_id
): number {
  return order.indexOf(id);
}

export function booking_step_number(
  order: readonly booking_step_id[],
  id: booking_step_id
): number {
  const index = booking_step_index(order, id);
  return index >= 0 ? index + 1 : 1;
}

export function booking_step_id_at(
  order: readonly booking_step_id[],
  one_based_index: number
): booking_step_id | null {
  return order[one_based_index - 1] ?? null;
}

export function next_booking_step_id(
  order: readonly booking_step_id[],
  id: booking_step_id
): booking_step_id | null {
  const index = booking_step_index(order, id);
  if (index < 0 || index >= order.length - 1) return null;
  return order[index + 1];
}

/** Previous step in the configured order (manual back navigation). */
export function previous_booking_step_id(
  order: readonly booking_step_id[],
  id: booking_step_id
): booking_step_id | null {
  const index = booking_step_index(order, id);
  if (index <= 0) return null;
  return order[index - 1];
}

const REQUIRED_STEP_IDS: readonly booking_step_id[] = ['date_time', 'intake'];

export function parse_booking_step_order(
  value: unknown
): booking_step_id[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const parsed: booking_step_id[] = [];
  const seen = new Set<booking_step_id>();
  for (const item of value) {
    if (!is_booking_step_id(item) || seen.has(item)) return null;
    seen.add(item);
    parsed.push(item);
  }

  for (const required of REQUIRED_STEP_IDS) {
    if (!seen.has(required)) return null;
  }

  if (!seen.has('success')) {
    parsed.push('success');
  } else if (parsed[parsed.length - 1] !== 'success') {
    // Anything after the success screen is unreachable.
    return null;
  }

  return parsed;
}

export function resolve_static_booking_step_order(): booking_step_id[] {
  return [...DEFAULT_BOOKING_STEP_ORDER];
}
