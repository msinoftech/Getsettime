import {
  INVITEE_DUPLICATE_DATE_MESSAGE,
  booking_preview_path,
  find_duplicate_invitee_booking_on_date,
  type invitee_booking_row,
  type invitee_identity,
} from '@/lib/invitee_duplicate_booking';

export type booking_form_error_state = {
  message: string;
  duplicatePreviewPath?: string | null;
};

export class BookingFormSubmitError extends Error {
  duplicatePreviewPath?: string | null;

  constructor(message: string, duplicatePreviewPath?: string | null) {
    super(message);
    this.name = 'BookingFormSubmitError';
    this.duplicatePreviewPath = duplicatePreviewPath;
  }
}

export function booking_form_error_from_duplicate_api(
  body: unknown
): booking_form_error_state | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const message =
    typeof record.error === 'string' ? record.error.trim() : '';
  const dup = record.duplicate_booking;
  const has_dup_payload = dup && typeof dup === 'object';
  if (message !== INVITEE_DUPLICATE_DATE_MESSAGE && !has_dup_payload) {
    return null;
  }
  const dup_record = has_dup_payload ? (dup as Record<string, unknown>) : null;
  const preview_path =
    typeof dup_record?.preview_path === 'string'
      ? dup_record.preview_path
      : booking_preview_path(
          typeof dup_record?.public_code === 'string'
            ? dup_record.public_code
            : null
        );
  return {
    message: message || INVITEE_DUPLICATE_DATE_MESSAGE,
    duplicatePreviewPath: preview_path,
  };
}

export function apply_booking_form_error_from_api(
  body: unknown,
  fallbackMessage: string
): booking_form_error_state {
  return (
    booking_form_error_from_duplicate_api(body) ?? { message: fallbackMessage }
  );
}

export function throw_if_booking_api_error(
  res: Response,
  body: unknown,
  fallbackMessage: string
): void {
  if (res.ok) return;
  const dup = booking_form_error_from_duplicate_api(body);
  if (dup) {
    throw new BookingFormSubmitError(dup.message, dup.duplicatePreviewPath);
  }
  const message =
    body &&
    typeof body === 'object' &&
    typeof (body as Record<string, unknown>).error === 'string'
      ? String((body as Record<string, unknown>).error)
      : fallbackMessage;
  throw new Error(message);
}

export function find_client_duplicate_invitee_error(
  bookings: invitee_booking_row[],
  params: {
    start_at: string;
    timezone: string;
    event_type_id?: string | number | null;
    invitee: invitee_identity;
    exclude_booking_id?: string | number | null;
  }
): booking_form_error_state | null {
  const row = find_duplicate_invitee_booking_on_date(bookings, params);
  if (!row) return null;
  const preview_path = booking_preview_path(row.public_code);
  return {
    message: INVITEE_DUPLICATE_DATE_MESSAGE,
    duplicatePreviewPath: preview_path,
  };
}

export function apply_booking_form_error(
  setMessage: (message: string | null) => void,
  setPreviewPath: (path: string | null) => void,
  error: booking_form_error_state
): void {
  setMessage(error.message);
  setPreviewPath(error.duplicatePreviewPath ?? null);
}

export function clear_booking_form_error(
  setMessage: (message: string | null) => void,
  setPreviewPath: (path: string | null) => void
): void {
  setMessage(null);
  setPreviewPath(null);
}
