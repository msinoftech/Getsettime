import type {
  booking_rules,
  booking_rules_customer_period,
  booking_rules_preset,
} from "@/src/types/booking_rules";

export const BOOKING_RULES_DURATION_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
  { value: 120, label: "120 min" },
];

export const BOOKING_RULES_INTERVAL_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 5, label: "Every 5 min" },
  { value: 10, label: "Every 10 min" },
  { value: 15, label: "Every 15 min" },
  { value: 30, label: "Every 30 min" },
  { value: 60, label: "Every 60 min" },
];

export const BOOKING_RULES_BUFFER_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: "0 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

export const BOOKING_RULES_NOTICE_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: "No notice" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 480, label: "8 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

export const BOOKING_RULES_WINDOW_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
  { value: 180, label: "180 days" },
  { value: 365, label: "365 days" },
];

export const BOOKING_RULES_DEADLINE_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: "Anytime" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 360, label: "6 hours before" },
  { value: 720, label: "12 hours before" },
  { value: 1440, label: "24 hours before" },
  { value: 2880, label: "48 hours before" },
  { value: 10080, label: "1 week before" },
];

export const BOOKING_RULES_MAX_PER_DAY_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 4, label: "4" },
  { value: 8, label: "8" },
  { value: 12, label: "12" },
  { value: 16, label: "16" },
  { value: 24, label: "24" },
  { value: 48, label: "48" },
];

export const BOOKING_RULES_MAX_PER_CUSTOMER_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
];

export const BOOKING_RULES_CUSTOMER_PERIOD_OPTIONS: ReadonlyArray<{
  value: booking_rules_customer_period;
  label: string;
}> = [
  { value: "day", label: "per day" },
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
];

export const DEFAULT_BOOKING_RULES: booking_rules = {
  default_duration_minutes: 30,
  slot_interval_minutes: 15,
  buffer_before_minutes: 10,
  buffer_after_minutes: 10,
  min_notice_minutes: 240,
  booking_window_days: 60,
  prevent_same_day_bookings: false,
  max_bookings_per_day: 12,
  max_bookings_per_customer: 3,
  max_bookings_per_customer_period: "week",
  allow_back_to_back: true,
  allow_cancellation: true,
  cancellation_deadline_minutes: 1440,
  allow_reschedule: true,
  reschedule_deadline_minutes: 720,
  require_manual_approval: false,
  preset: "standard",
};

export const BOOKING_RULES_PRESETS: Record<
  booking_rules_preset,
  Partial<booking_rules> & { label: string; description: string }
> = {
  standard: {
    label: "Standard",
    description: "Balanced settings",
    ...DEFAULT_BOOKING_RULES,
    preset: "standard",
  },
  strict: {
    label: "Strict",
    description: "Tight restrictions",
    default_duration_minutes: 30,
    slot_interval_minutes: 30,
    buffer_before_minutes: 15,
    buffer_after_minutes: 15,
    min_notice_minutes: 1440,
    booking_window_days: 30,
    prevent_same_day_bookings: true,
    max_bookings_per_day: 8,
    max_bookings_per_customer: 2,
    max_bookings_per_customer_period: "week",
    allow_back_to_back: false,
    allow_cancellation: true,
    cancellation_deadline_minutes: 2880,
    allow_reschedule: true,
    reschedule_deadline_minutes: 1440,
    require_manual_approval: true,
    preset: "strict",
  },
  flexible: {
    label: "Flexible",
    description: "More lenient rules",
    default_duration_minutes: 30,
    slot_interval_minutes: 15,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    min_notice_minutes: 60,
    booking_window_days: 90,
    prevent_same_day_bookings: false,
    max_bookings_per_day: 24,
    max_bookings_per_customer: 5,
    max_bookings_per_customer_period: "week",
    allow_back_to_back: true,
    allow_cancellation: true,
    cancellation_deadline_minutes: 60,
    allow_reschedule: true,
    reschedule_deadline_minutes: 60,
    require_manual_approval: false,
    preset: "flexible",
  },
};

function as_finite_number(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return fallback;
}

function as_boolean(value: unknown, fallback: boolean): boolean {
  if (value === true) return true;
  if (value === false) return false;
  return fallback;
}

function as_period(
  value: unknown,
  fallback: booking_rules_customer_period
): booking_rules_customer_period {
  if (value === "day" || value === "week" || value === "month") return value;
  return fallback;
}

function as_preset(value: unknown): booking_rules_preset | null {
  if (value === "standard" || value === "strict" || value === "flexible") return value;
  return null;
}

export function resolve_booking_rules(
  settings: Record<string, unknown> | null | undefined
): booking_rules {
  const raw =
    settings?.booking_rules && typeof settings.booking_rules === "object"
      ? (settings.booking_rules as Record<string, unknown>)
      : {};
  const general =
    settings?.general && typeof settings.general === "object"
      ? (settings.general as Record<string, unknown>)
      : {};

  return {
    default_duration_minutes: as_finite_number(
      raw.default_duration_minutes,
      DEFAULT_BOOKING_RULES.default_duration_minutes
    ),
    slot_interval_minutes: as_finite_number(
      raw.slot_interval_minutes,
      DEFAULT_BOOKING_RULES.slot_interval_minutes
    ),
    buffer_before_minutes: as_finite_number(
      raw.buffer_before_minutes,
      DEFAULT_BOOKING_RULES.buffer_before_minutes
    ),
    buffer_after_minutes: as_finite_number(
      raw.buffer_after_minutes,
      DEFAULT_BOOKING_RULES.buffer_after_minutes
    ),
    min_notice_minutes: as_finite_number(
      raw.min_notice_minutes,
      DEFAULT_BOOKING_RULES.min_notice_minutes
    ),
    booking_window_days: as_finite_number(
      raw.booking_window_days,
      DEFAULT_BOOKING_RULES.booking_window_days
    ),
    prevent_same_day_bookings: as_boolean(
      raw.prevent_same_day_bookings,
      DEFAULT_BOOKING_RULES.prevent_same_day_bookings
    ),
    max_bookings_per_day: as_finite_number(
      raw.max_bookings_per_day,
      DEFAULT_BOOKING_RULES.max_bookings_per_day
    ),
    max_bookings_per_customer: as_finite_number(
      raw.max_bookings_per_customer,
      DEFAULT_BOOKING_RULES.max_bookings_per_customer
    ),
    max_bookings_per_customer_period: as_period(
      raw.max_bookings_per_customer_period,
      DEFAULT_BOOKING_RULES.max_bookings_per_customer_period
    ),
    allow_back_to_back: as_boolean(
      raw.allow_back_to_back,
      DEFAULT_BOOKING_RULES.allow_back_to_back
    ),
    allow_cancellation: as_boolean(
      raw.allow_cancellation ?? general.allow_customer_cancellation,
      DEFAULT_BOOKING_RULES.allow_cancellation
    ),
    cancellation_deadline_minutes: as_finite_number(
      raw.cancellation_deadline_minutes,
      DEFAULT_BOOKING_RULES.cancellation_deadline_minutes
    ),
    allow_reschedule: as_boolean(
      raw.allow_reschedule ?? general.allow_customer_reschedule,
      DEFAULT_BOOKING_RULES.allow_reschedule
    ),
    reschedule_deadline_minutes: as_finite_number(
      raw.reschedule_deadline_minutes,
      DEFAULT_BOOKING_RULES.reschedule_deadline_minutes
    ),
    require_manual_approval: as_boolean(
      raw.require_manual_approval,
      DEFAULT_BOOKING_RULES.require_manual_approval
    ),
    preset: as_preset(raw.preset),
  };
}

export function format_duration_minutes(minutes: number): string {
  if (minutes <= 0) return "0 min";
  if (minutes < 60) return `${minutes} min`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

export function format_notice_short(minutes: number): string {
  if (minutes <= 0) return "No notice";
  if (minutes < 60) return `${minutes}m notice`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "1d notice" : `${days}d notice`;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}h notice`;
  }
  return `${format_duration_minutes(minutes)} notice`;
}

export function format_deadline_label(minutes: number): string {
  if (minutes <= 0) return "Anytime";
  if (minutes < 60) return `${minutes} min before`;
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? "24 hours before" : `${days} days before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 hour before" : `${hours} hours before`;
  }
  return `${format_duration_minutes(minutes)} before`;
}

export function format_on_off(value: boolean): string {
  return value ? "On" : "Off";
}

export function format_customer_limit(
  count: number,
  period: booking_rules_customer_period
): string {
  return `${count} / ${period}`;
}

export const EVENT_TYPE_OVERRIDE_BADGE_CLASSES = [
  "bg-indigo-50 text-indigo-700 ring-blue-200",
  "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "bg-amber-50 text-amber-700 ring-amber-200",
  "bg-violet-50 text-violet-700 ring-violet-200",
] as const;
