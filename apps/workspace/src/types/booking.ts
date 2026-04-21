export { BOOKING_STATUSES, type BookingStatus } from '@app/db';

export type Booking = {
  id: string;
  workspace_id: string;
  event_type_id: string | null;
  host_user_id: string | null;
  contact_id: number | null;
  invitee_name: string | null;
  invitee_email: string | null;
  invitee_phone: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
  location: Record<string, unknown> | null;
  payment_id: string | null;
  metadata: Record<string, unknown> | null;
  service_provider_id: string | null;
  department_id: string | null;
  sms_reminder_sent_at: string | null;
  sms_reminder_skipped_at: string | null;
  email_reminder_sent_at: string | null;
  email_reminder_skipped_at: string | null;
  whatsapp_reminder_sent_at: string | null;
  whatsapp_reminder_skipped_at: string | null;
  followup_email_sent_at: string | null;
  followup_email_skipped_at: string | null;
  public_code: string | null;
  is_viewed: boolean;
  /** False after a time change until acknowledged in the bookings UI. */
  is_reschedule_viewed?: boolean;
  created_at: string;
  updated_at: string;
  event_types?: {
    title: string;
    duration_minutes?: number | null;
  } | null;
  contacts?: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  /**
   * Server-enriched record creator resolved from `host_user_id`. Null for
   * bookings created through the public embed (no authenticated host).
   */
  creator?: {
    id: string;
    name: string;
    email: string | null;
  } | null;
};

