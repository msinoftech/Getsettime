export type event_type_status = 'active' | 'draft';

export type event_type_format = 'one_on_one' | 'recurring' | 'group_class';

export type event_type_availability_mode = 'provider' | 'custom';

export type event_type_recurrence_frequency = 'daily' | 'weekly' | 'monthly';
export type event_type_recurrence_end_type = 'never' | 'on_date' | 'after';
/** Cadences a customer may choose from when booking a series. */
export type event_type_recurrence_allowed_frequency = event_type_recurrence_frequency;
export type event_type_recurrence_weekday =
  | 'mon'
  | 'tue'
  | 'wed'
  | 'thu'
  | 'fri'
  | 'sat'
  | 'sun';

export type event_type_recurrence_audience = 'single' | 'group';

export type event_type_recurrence = {
  enabled: boolean;
  /** One Time format: single attendee vs group capacity. */
  audience: event_type_recurrence_audience;
  frequency: event_type_recurrence_frequency;
  days_of_week: event_type_recurrence_weekday[];
  start_date: string | null;
  /** 24-hour `HH:mm` session time for daily / weekly One Time schedules. */
  start_time: string | null;
  end_type: event_type_recurrence_end_type;
  end_date: string | null;
  end_after_sessions: number | null;
  allowed_frequency: event_type_recurrence_allowed_frequency;
  /** Null while a custom session count is in use. */
  session_preset: number | null;
  custom_session_count: number | null;
  /** datetime-local (`YYYY-MM-DDTHH:mm`) when availability_mode is custom. */
  custom_availability_start: string | null;
  custom_availability_end: string | null;
};

export type event_types = {
  id: number;
  workspace_id: number;
  owner_id: string | null;
  title: string;
  slug: string | null;
  internal_label: string | null;
  event_type_format: event_type_format;
  capacity_per_slot: number;
  availability_mode: event_type_availability_mode;
  recurrence: event_type_recurrence | null;
  allow_waitlist: boolean;
  waitlist_capacity: number | null;
  show_seats_remaining: boolean;
  min_booking_notice_minutes: number;
  max_booking_window_days: number;
  allow_reschedule: boolean;
  allow_cancellation: boolean;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  location_type: string | null;
  location_value: string | null;
  department_id: number | null;
  service_id: string | null;
  service_provider_ids: string[];
  is_public: boolean | null;
  status: event_type_status;
  settings: Record<string, unknown> | null;
  created_at: string;
};
