export type booking_series_status = 'active' | 'cancelled';

export type booking_series = {
  id: string;
  workspace_id: number | string;
  event_type_id: number | string | null;
  service_provider_id: string | null;
  department_id: number | string | null;
  contact_id: number | null;
  timezone: string | null;
  recurrence: Record<string, unknown>;
  series_start_at: string;
  series_end_at: string | null;
  status: booking_series_status;
  location: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};
