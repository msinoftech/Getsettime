export type booking_rules_preset = "standard" | "strict" | "flexible";

export type booking_rules_customer_period = "day" | "week" | "month";

export type booking_rules = {
  default_duration_minutes: number;
  slot_interval_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  booking_window_days: number;
  prevent_same_day_bookings: boolean;
  max_bookings_per_day: number;
  max_bookings_per_customer: number;
  max_bookings_per_customer_period: booking_rules_customer_period;
  allow_back_to_back: boolean;
  allow_cancellation: boolean;
  cancellation_deadline_minutes: number;
  allow_reschedule: boolean;
  reschedule_deadline_minutes: number;
  require_manual_approval: boolean;
  preset: booking_rules_preset | null;
};

export type booking_rules_edit_target =
  | { kind: "global" }
  | { kind: "slot_defaults" }
  | { kind: "advance_booking" }
  | { kind: "limits" }
  | { kind: "customer_actions" }
  | {
      kind: "event_type";
      event_type_id: number;
      title: string;
      duration_minutes: number | null;
      buffer_before: number | null;
      buffer_after: number | null;
      min_booking_notice_minutes: number;
    };

export type booking_rules_event_type_row = {
  id: number;
  title: string;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  min_booking_notice_minutes: number;
};
