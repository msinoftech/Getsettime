export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'completed', label: 'Completed' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'reschedule', label: 'Reschedule' },
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number]['value'];

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
  created_at: string;
  updated_at: string;
  event_types?: {
    title: string;
  } | null;
  contacts?: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
};

