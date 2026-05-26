export const BOOKING_METADATA_PREVIOUS_START_AT = 'previous_start_at';
export const BOOKING_METADATA_PREVIOUS_END_AT = 'previous_end_at';

export type previous_appointment_times = {
  previous_start_at: string;
  previous_end_at: string | null;
};

function is_record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function read_iso_string(meta: Record<string, unknown>, key: string): string | null {
  const raw = meta[key];
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : null;
}

export function get_previous_appointment_times(
  metadata: Record<string, unknown> | null | undefined
): previous_appointment_times | null {
  if (!is_record(metadata)) return null;
  const previous_start_at = read_iso_string(metadata, BOOKING_METADATA_PREVIOUS_START_AT);
  if (!previous_start_at) return null;
  const previous_end_at = read_iso_string(metadata, BOOKING_METADATA_PREVIOUS_END_AT);
  return { previous_start_at, previous_end_at };
}

export function merge_reschedule_metadata(
  existing_metadata: Record<string, unknown> | null | undefined,
  previous_start_at: string | null,
  previous_end_at: string | null
): Record<string, unknown> {
  const base = is_record(existing_metadata) ? { ...existing_metadata } : {};
  if (previous_start_at) {
    base[BOOKING_METADATA_PREVIOUS_START_AT] = previous_start_at;
  }
  base[BOOKING_METADATA_PREVIOUS_END_AT] = previous_end_at ?? null;
  return base;
}
