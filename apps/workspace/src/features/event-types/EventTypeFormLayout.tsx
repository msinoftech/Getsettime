"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LuCheck, LuChevronDown, LuCopy, LuGem, LuInfo, LuPlus, LuRefreshCw, LuUsers, LuUser } from "react-icons/lu";
import {
  EVENT_TYPE_LOCATION_OPTIONS,
  format_event_type_location_labels,
  label_for_event_type_location,
  parse_event_type_location_types,
  serialize_event_type_location_types,
  type event_type_location_value,
} from "@/src/types/event_type_location";
import { normalize_event_type_slug_input } from "@/src/features/event-types/event_type_slug";
import {
  EVENT_TYPE_STATUS_OPTIONS,
} from "@/src/features/event-types/event_type_status";
import {
  default_capacity_for_event_type_format,
  EVENT_TYPE_FORMAT_OPTIONS,
  is_fixed_capacity_event_type_format,
} from "@/src/features/event-types/event_type_format";
import type {
  event_type_availability_mode,
  event_type_format,
  event_type_recurrence_allowed_frequency,
  event_type_recurrence_audience,
  event_type_recurrence_end_type,
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
  event_type_status,
} from "@/src/types/event_types";
import {
  EVENT_TYPE_AVAILABILITY_MODE_OPTIONS,
  date_part_from_datetime_local,
  datetime_local_to_ms,
  is_datetime_local_in_past,
  now_datetime_local,
  parse_datetime_local_input,
} from "@/src/features/event-types/event_type_availability";
import {
  default_event_type_recurrence,
  EVENT_TYPE_RECURRENCE_AUDIENCE_OPTIONS,
  EVENT_TYPE_SESSION_PRESET_OPTIONS,
  parse_event_type_recurrence,
} from "@/src/features/event-types/event_type_recurrence";
import {
  default_booking_options_form_fields,
  EVENT_TYPE_MAX_BOOKING_WINDOW_OPTIONS,
  EVENT_TYPE_MIN_BOOKING_NOTICE_OPTIONS,
} from "@/src/features/event-types/event_type_booking_options";
import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";
import {
  EventTypeAddServicePanel,
  type event_type_created_service,
} from "@/src/features/event-types/EventTypeAddServicePanel";
import { DateTimePicker } from "@/src/components/molecules/DateTimePicker";
import { EventTypeRecurrenceSeriesSchedule } from "@/src/features/event-types/EventTypeRecurrenceSeriesSchedule";
import { copy_text_to_clipboard } from "@/src/utils/public_booking_link";
import { supabase } from "@/lib/supabaseClient";
import { normalizeServiceProvidersMeta } from "@/src/utils/bookingServiceAssignments";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import type { date_exception } from "@/src/types/date_exceptions";
import {
  calculate_recurrence_series,
  recurrence_sessions_capacity_error,
} from "@/src/features/event-types/event_type_recurrence_occurrences";

export {
  EVENT_TYPE_LOCATION_OPTIONS,
  type event_type_location_value,
  parse_event_type_location_types as parse_location_types_from_storage,
  serialize_event_type_location_types as serialize_location_types,
  format_event_type_location_labels,
};

export type event_type_form_recurrence = {
  enabled: boolean;
  audience: event_type_recurrence_audience;
  frequency: event_type_recurrence_frequency;
  days_of_week: event_type_recurrence_weekday[];
  start_date: string;
  start_time: string;
  end_type: event_type_recurrence_end_type;
  end_date: string;
  end_after_sessions: string;
  allowed_frequency: event_type_recurrence_allowed_frequency;
  session_preset: number | null;
  /** Form-only: Custom chip selected. Persisted as session_preset null + custom_session_count. */
  allow_custom_count: boolean;
  custom_session_count: string;
  custom_availability_start: string;
  custom_availability_end: string;
};

export type event_type_form_state = {
  title: string;
  slug: string;
  internal_label: string;
  short_description: string;
  event_type_format: event_type_format;
  capacity_per_slot: string;
  availability_mode: event_type_availability_mode;
  recurrence: event_type_form_recurrence;
  duration_hours: string;
  duration_minutes_part: string;
  buffer_before: string;
  buffer_after: string;
  location_types: event_type_location_value[];
  is_public: boolean;
  allow_waitlist: boolean;
  waitlist_capacity: string;
  show_seats_remaining: boolean;
  min_booking_notice_minutes: string;
  max_booking_window_days: string;
  allow_reschedule: boolean;
  allow_cancellation: boolean;
  status: event_type_status;
  /** Empty = logged-in user owns the event type (admin/manager only). */
  service_provider_id: string;
  service_provider_ids: string[];
  department_id: string;
  service_id: string;
};

export function to_form_recurrence(value: unknown): event_type_form_recurrence {
  const parsed = parse_event_type_recurrence(value);
  return {
    enabled: parsed.enabled,
    audience: parsed.audience,
    frequency: parsed.frequency,
    days_of_week: parsed.days_of_week,
    start_date: parsed.start_date ?? "",
    start_time: parsed.start_time ?? "",
    end_type: parsed.end_type,
    end_date: parsed.end_date ?? "",
    end_after_sessions:
      parsed.end_after_sessions != null
        ? String(parsed.end_after_sessions)
        : String(default_event_type_recurrence().end_after_sessions ?? 8),
    allowed_frequency: parsed.allowed_frequency,
    session_preset: parsed.session_preset,
    allow_custom_count: parsed.session_preset == null,
    custom_session_count:
      parsed.custom_session_count != null
        ? String(parsed.custom_session_count)
        : "",
    custom_availability_start: parsed.custom_availability_start ?? "",
    custom_availability_end: parsed.custom_availability_end ?? "",
  };
}

export function from_form_recurrence(
  value: event_type_form_recurrence
): ReturnType<typeof parse_event_type_recurrence> {
  const sessions_raw = value.end_after_sessions.trim();
  const custom_count_raw = value.custom_session_count.trim();
  return {
    enabled: value.enabled,
    audience: value.audience,
    frequency: value.frequency,
    days_of_week: value.days_of_week,
    start_date: value.start_date.trim() || null,
    start_time: value.start_time.trim() || null,
    end_type: value.end_type,
    end_date: value.end_date.trim() || null,
    end_after_sessions:
      sessions_raw && /^\d+$/.test(sessions_raw)
        ? parseInt(sessions_raw, 10)
        : null,
    allowed_frequency: value.allowed_frequency,
    session_preset: value.allow_custom_count ? null : value.session_preset,
    custom_session_count:
      value.allow_custom_count && custom_count_raw && /^\d+$/.test(custom_count_raw)
        ? parseInt(custom_count_raw, 10)
        : null,
    custom_availability_start: parse_datetime_local_input(
      value.custom_availability_start
    ),
    custom_availability_end: parse_datetime_local_input(
      value.custom_availability_end
    ),
  };
}

export function empty_form_recurrence(): event_type_form_recurrence {
  const defaults = to_form_recurrence(default_event_type_recurrence());
  return {
    ...defaults,
    // Recurrence turns on when the Recurring format is picked, not by default.
    enabled: false,
    start_date: new Date().toISOString().slice(0, 10),
  };
}

export type event_type_service_provider_option = {
  id: string;
  label: string;
  avatar_url?: string | null;
  role_label?: string | null;
};

type event_type_department_option = {
  id: number;
  name: string;
};

type event_type_service_option = {
  id: string;
  name: string;
  department_id: number | null;
  service_providers: { id: string; name: string }[];
};

const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90] as const;
function parse_non_negative_int(s: string, fallback = 0): number {
  if (s.trim() === "") return fallback;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function total_duration_minutes(hours: string, minutes_part: string): number {
  return parse_non_negative_int(hours) * 60 + parse_non_negative_int(minutes_part);
}

function split_duration_minutes(total: number | null | undefined): {
  duration_hours: string;
  duration_minutes_part: string;
} {
  if (total == null || !Number.isFinite(total) || total < 1) {
    return { duration_hours: "", duration_minutes_part: "" };
  }
  const t = Math.trunc(total);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return {
    duration_hours: h > 0 ? String(h) : "",
    duration_minutes_part: m > 0 || h === 0 ? String(m) : "0",
  };
}

function format_duration_label(totalMinutes: number): string {
  if (totalMinutes < 1) return "—";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} hr${h === 1 ? "" : "s"}`);
  if (m > 0) parts.push(`${m} min`);
  if (parts.length === 0) return "0 min";
  return parts.join(" ");
}

function format_review_duration_label(totalMinutes: number): string {
  if (totalMinutes < 1) return "—";
  if (totalMinutes === 1) return "1 minute";
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  return format_duration_label(totalMinutes);
}

function display_booking_url(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

function duration_preset_selected(
  hours: string,
  minutes_part: string,
  preset: number
): boolean {
  return total_duration_minutes(hours, minutes_part) === preset;
}

export function LocationTypesMultiSelect({
  value,
  onChange,
  invalid = false,
  error_id,
  focus_key,
}: {
  value: event_type_location_value[];
  onChange: (next: event_type_location_value[]) => void;
  invalid?: boolean;
  error_id?: string;
  focus_key?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = (type: event_type_location_value) => {
    const selected = new Set(value);
    if (selected.has(type)) selected.delete(type);
    else selected.add(type);
    const order = EVENT_TYPE_LOCATION_OPTIONS.map((o) => o.value);
    onChange(order.filter((v) => selected.has(v)));
  };

  const triggerLabel =
    value.length === 0 ? "Select location types" : format_event_type_location_labels(value);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid}
        aria-describedby={invalid && error_id ? error_id : undefined}
        data-event-type-field={focus_key}
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-slate-50 px-4 py-3 text-left text-sm outline-none transition focus:bg-white ${
          invalid
            ? "border-red-400 focus:border-red-400"
            : "border-slate-200 focus:border-indigo-400"
        }`}
      >
        <span className={`truncate ${value.length === 0 ? "text-slate-400" : "text-slate-900"}`}>
          {triggerLabel}
        </span>
        <LuChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {EVENT_TYPE_LOCATION_OPTIONS.map((option) => {
            const selected = value.includes(option.value);
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => toggle(option.value)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      selected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white"
                    }`}
                    aria-hidden
                  >
                    {selected ? <LuCheck className="h-3 w-3" /> : null}
                  </span>
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const EVENT_TYPE_PANEL_STEPS = [
  { id: "basic", label: "Basic Details" },
  { id: "schedule", label: "Schedule & Availability" },
  { id: "recurrence", label: "Booking Pattern" },
  { id: "booking", label: "Booking Options" },
  { id: "review", label: "Review & Publish" },
] as const;

type event_type_field_error_key =
  | "title"
  | "slug"
  | "duration"
  | "capacity_per_slot"
  | "location_types"
  | "department_id"
  | "service_id"
  | "service_provider_id"
  | "service_provider_ids"
  | "custom_availability_start"
  | "custom_availability_end"
  | "recurrence_custom_session_count"
  | "recurrence_days"
  | "recurrence_start_date"
  | "recurrence_start_time"
  | "recurrence_end_date"
  | "recurrence_end_after_sessions";

type event_type_field_errors = Partial<Record<event_type_field_error_key, string>>;

const EVENT_TYPE_FIELD_FOCUS_ORDER: event_type_field_error_key[] = [
  "title",
  "slug",
  "duration",
  "capacity_per_slot",
  "location_types",
  "department_id",
  "service_id",
  "service_provider_id",
  "service_provider_ids",
  "custom_availability_start",
  "custom_availability_end",
  "recurrence_custom_session_count",
  "recurrence_days",
  "recurrence_start_date",
  "recurrence_start_time",
  "recurrence_end_date",
  "recurrence_end_after_sessions",
];

const STEP_REQUIRED_FIELDS_BANNER =
  "Please enter values in required fields.";

function focus_event_type_field(key: event_type_field_error_key) {
  const el = document.querySelector<HTMLElement>(
    `[data-event-type-field="${key}"]`
  );
  if (!el) return;
  el.focus();
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

function first_invalid_field_key(
  errors: event_type_field_errors
): event_type_field_error_key | null {
  for (const key of EVENT_TYPE_FIELD_FOCUS_ORDER) {
    if (errors[key]) return key;
  }
  return null;
}

function apply_recurrence_schedule_step_errors(
  recurrence: event_type_form_recurrence,
  frequency: event_type_recurrence_frequency,
  errors: event_type_field_errors,
  custom_availability: boolean,
  custom_availability_end_date: string | null | undefined,
  series: { ends_on: string | null; max_sessions: number | null } | null
) {
  if (!recurrence.start_date.trim()) {
    errors.recurrence_start_date = "Start date is required.";
  }
  if (!recurrence.start_time.trim()) {
    errors.recurrence_start_time = "Time is required.";
  }
  if (frequency === "weekly" && recurrence.days_of_week.length === 0) {
    errors.recurrence_days = "Select at least one day.";
  }
  if (recurrence.end_type === "on_date" && !recurrence.end_date.trim()) {
    errors.recurrence_end_date = "End date is required.";
  } else if (recurrence.end_type === "on_date" && recurrence.end_date.trim()) {
    if (
      recurrence.start_date.trim() &&
      recurrence.end_date < recurrence.start_date
    ) {
      errors.recurrence_end_date =
        "End date must be on or after the start date.";
    } else if (
      custom_availability &&
      custom_availability_end_date &&
      recurrence.end_date > custom_availability_end_date
    ) {
      errors.recurrence_end_date =
        "End date cannot be later than the custom availability end date.";
    }
  }
  if (recurrence.end_type === "after") {
    const sessions = parseInt(recurrence.end_after_sessions, 10);
    if (
      recurrence.end_after_sessions.trim() === "" ||
      !Number.isFinite(sessions) ||
      sessions < 1
    ) {
      errors.recurrence_end_after_sessions = "Enter at least 1 session.";
    } else if (
      custom_availability &&
      series?.max_sessions != null &&
      sessions > series.max_sessions
    ) {
      errors.recurrence_end_after_sessions = recurrence_sessions_capacity_error(
        series.max_sessions
      );
    } else if (series != null && series.ends_on == null) {
      errors.recurrence_end_after_sessions =
        "No available dates were found for this recurrence. Check the provider's working hours and date exceptions.";
    }
  }
}

type EventTypeFormLayoutProps = {
  value: event_type_form_state;
  onChange: (next: event_type_form_state) => void;
  editingId: number | null;
  formError: string | null;
  successMessage?: string | null;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  show_service_provider_field?: boolean;
  service_provider_options?: event_type_service_provider_option[];
  service_providers_loading?: boolean;
  /** Empty-value option for admins/managers who are not service providers. */
  self_assign_option?: { label: string; avatar_url?: string | null } | null;
  /** `panel` renders a compact sectioned layout for the right-side panel. */
  variant?: "page" | "panel";
  slug_error?: string | null;
  on_slug_blur?: () => void;
  on_slug_edited?: () => void;
  /** Returns true when the slug is valid and unique in the current workspace. */
  on_validate_slug?: () => Promise<boolean>;
  /** Workspace timezone label for the Review step summary. */
  timezone_label?: string | null;
  /** Preview public booking URL for the Review step summary. */
  booking_url?: string | null;
};

export function EventTypeFormLayout({
  value,
  onChange,
  editingId,
  formError,
  successMessage = null,
  submitting,
  onSubmit,
  onCancel,
  show_service_provider_field = false,
  service_provider_options = [],
  service_providers_loading = false,
  self_assign_option = null,
  variant = "page",
  slug_error = null,
  on_slug_blur,
  on_slug_edited,
  on_validate_slug,
  timezone_label = null,
  booking_url = null,
}: EventTypeFormLayoutProps) {
  const { availability: workspace_availability } = useWorkspaceSettings();
  const [active_step, set_active_step] = useState(0);
  const [field_errors, set_field_errors] = useState<event_type_field_errors>({});
  const [step_banner_error, set_step_banner_error] = useState<string | null>(null);
  const [slug_checking, set_slug_checking] = useState(false);
  const [is_panel_saving, set_is_panel_saving] = useState(false);
  const [booking_url_copied, set_booking_url_copied] = useState(false);
  const [departments, set_departments] = useState<event_type_department_option[]>([]);
  const [services, set_services] = useState<event_type_service_option[]>([]);
  const [lookups_loading, set_lookups_loading] = useState(false);
  const [date_exceptions, set_date_exceptions] = useState<date_exception[]>([]);
  const [service_panel_open, set_service_panel_open] = useState(false);
  const [service_panel_entered, set_service_panel_entered] = useState(false);

  const patch = useCallback(
    (partial: Partial<event_type_form_state>) => {
      onChange({ ...value, ...partial });
    },
    [onChange, value]
  );

  const lookups_mounted_ref = useRef(true);

  useEffect(() => {
    lookups_mounted_ref.current = true;
    return () => {
      lookups_mounted_ref.current = false;
    };
  }, []);

  const load_department_and_service_lookups = useCallback(async () => {
    set_lookups_loading(true);
    try {
      const { session } = await getWorkspaceSession();
      if (!session?.access_token || !lookups_mounted_ref.current) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [departments_response, services_response, exceptions_response] =
        await Promise.all([
          fetch("/api/departments", { headers }),
          fetch("/api/services", { headers }),
          fetch("/api/date-exceptions?status=active&limit=200", { headers }),
        ]);

      const departments_body = departments_response.ok
        ? ((await departments_response.json()) as { departments?: unknown })
        : { departments: [] };
      const services_body = services_response.ok
        ? ((await services_response.json()) as { services?: unknown })
        : { services: [] };

      const exceptions_body = exceptions_response.ok
        ? ((await exceptions_response.json()) as { exceptions?: unknown })
        : { exceptions: [] };

      if (!lookups_mounted_ref.current) return;

      const next_departments = Array.isArray(departments_body.departments)
        ? departments_body.departments
            .map((row) => {
              if (!row || typeof row !== "object") return null;
              const rec = row as { id?: unknown; name?: unknown };
              const id = Number(rec.id);
              const name = typeof rec.name === "string" ? rec.name.trim() : "";
              if (!Number.isFinite(id) || id <= 0 || !name) return null;
              return { id, name };
            })
            .filter((row): row is event_type_department_option => row !== null)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

      const next_services = Array.isArray(services_body.services)
        ? services_body.services
            .map((row) => {
              if (!row || typeof row !== "object") return null;
              const rec = row as {
                id?: unknown;
                name?: unknown;
                department_id?: unknown;
                meta_data?: unknown;
              };
              const id = typeof rec.id === "string" ? rec.id.trim() : String(rec.id ?? "").trim();
              const name = typeof rec.name === "string" ? rec.name.trim() : "";
              if (!id || !name) return null;
              const department_id =
                rec.department_id === null || rec.department_id === undefined
                  ? null
                  : Number(rec.department_id);
              const meta =
                rec.meta_data && typeof rec.meta_data === "object" && !Array.isArray(rec.meta_data)
                  ? (rec.meta_data as Record<string, unknown>)
                  : {};
              return {
                id,
                name,
                department_id:
                  department_id != null && Number.isFinite(department_id)
                    ? department_id
                    : null,
                service_providers: normalizeServiceProvidersMeta(meta.service_providers).map(
                  (provider) => ({
                    id: provider.id,
                    name: provider.name?.trim() || "Unknown",
                  })
                ),
              };
            })
            .filter((row): row is event_type_service_option => row !== null)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [];

      set_departments(next_departments);
      set_services(next_services);
      set_date_exceptions(
        Array.isArray(exceptions_body.exceptions)
          ? exceptions_body.exceptions.filter(
              (row): row is date_exception =>
                !!row &&
                typeof row === "object" &&
                typeof (row as date_exception).id === "number" &&
                typeof (row as date_exception).exception_date === "string"
            )
          : []
      );
    } catch (error) {
      console.error("Error loading department and service lookups:", error);
      if (lookups_mounted_ref.current) {
        set_departments([]);
        set_services([]);
        set_date_exceptions([]);
      }
    } finally {
      if (lookups_mounted_ref.current) set_lookups_loading(false);
    }
  }, []);

  useEffect(() => {
    void load_department_and_service_lookups();
  }, [load_department_and_service_lookups]);

  useEffect(() => {
    if (!service_panel_open) {
      set_service_panel_entered(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => set_service_panel_entered(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [service_panel_open]);

  const clear_field_error = useCallback((key: event_type_field_error_key) => {
    set_field_errors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const on_digit_field = useCallback(
    (
      field: "duration_hours" | "duration_minutes_part",
      raw: string
    ) => {
      if (raw === "" || /^\d+$/.test(raw)) {
        patch({ [field]: raw } as Partial<event_type_form_state>);
      }
    },
    [patch]
  );

  const on_duration_preset = useCallback(
    (preset: number) => {
      const h = Math.floor(preset / 60);
      const m = preset % 60;
      patch({
        duration_hours: h > 0 ? String(h) : "",
        duration_minutes_part: String(m),
      });
    },
    [patch]
  );

  const total_min = total_duration_minutes(value.duration_hours, value.duration_minutes_part);

  const capacity_locked = is_fixed_capacity_event_type_format(
    value.event_type_format,
    value.recurrence.audience
  );
  const recurring_format = value.event_type_format === "recurring";
  const group_format = value.event_type_format === "group_class";
  const custom_availability = value.availability_mode === "custom";
  const custom_availability_start_date = date_part_from_datetime_local(
    value.recurrence.custom_availability_start
  );
  const custom_availability_end_date = date_part_from_datetime_local(
    value.recurrence.custom_availability_end
  );

  /** Providers assigned to the chosen service, i.e. the only bookable candidates. */
  const assigned_service_providers = useMemo(() => {
    const selected_service = services.find((service) => service.id === value.service_id);
    if (!selected_service) return [];
    return selected_service.service_providers.map((provider) => {
      const option = service_provider_options.find((item) => item.id === provider.id);
      return {
        id: provider.id,
        name: option?.label || provider.name,
        avatar_url: option?.avatar_url ?? null,
        role_label: option?.role_label?.trim() || "Service provider",
      };
    });
  }, [service_provider_options, services, value.service_id]);

  const schedule_active =
    recurring_format || (group_format && value.recurrence.enabled);
  const schedule_frequency = recurring_format
    ? value.recurrence.frequency
    : value.recurrence.allowed_frequency;

  const series_preview = useMemo(() => {
    if (!schedule_active) return null;
    const sessions = parseInt(value.recurrence.end_after_sessions, 10);
    if (!Number.isFinite(sessions) || sessions < 1) return null;
    return calculate_recurrence_series({
      frequency: schedule_frequency,
      days_of_week: value.recurrence.days_of_week,
      start_date: value.recurrence.start_date,
      start_time: value.recurrence.start_time,
      session_count: sessions,
      duration_minutes: total_min,
      custom_availability,
      custom_availability_start: custom_availability
        ? value.recurrence.custom_availability_start || null
        : null,
      custom_availability_end: custom_availability
        ? value.recurrence.custom_availability_end || null
        : null,
      provider_ids: value.service_provider_ids,
      workspace_availability,
      date_exceptions,
    });
  }, [
    custom_availability,
    date_exceptions,
    schedule_active,
    schedule_frequency,
    total_min,
    value.recurrence.custom_availability_end,
    value.recurrence.custom_availability_start,
    value.recurrence.days_of_week,
    value.recurrence.end_after_sessions,
    value.recurrence.start_date,
    value.recurrence.start_time,
    value.service_provider_ids,
    workspace_availability,
  ]);

  // A service with a single provider leaves no choice to make, so pre-select it
  // once per service instead of forcing a click. Tracked by service id so a
  // deliberate deselection is not immediately undone.
  const auto_selected_provider_service_ref = useRef<string | null>(null);

  useEffect(() => {
    if (assigned_service_providers.length !== 1) return;
    if (auto_selected_provider_service_ref.current === value.service_id) return;
    auto_selected_provider_service_ref.current = value.service_id;
    const only_provider_id = assigned_service_providers[0].id;
    if (value.service_provider_ids.includes(only_provider_id)) return;
    patch({ service_provider_ids: [only_provider_id] });
  }, [
    assigned_service_providers,
    patch,
    value.service_id,
    value.service_provider_ids,
  ]);

  useEffect(() => {
    if (!custom_availability || !custom_availability_start_date) return;
    if (value.recurrence.start_date === custom_availability_start_date) return;
    patch({
      recurrence: {
        ...value.recurrence,
        start_date: custom_availability_start_date,
      },
    });
  }, [
    custom_availability,
    custom_availability_start_date,
    patch,
    value.recurrence,
  ]);

  const collect_step_errors = useCallback(
    (step: number): event_type_field_errors => {
      const errors: event_type_field_errors = {};

      if (step === 0) {
        if (!value.title.trim()) {
          errors.title = "Event name is required.";
        }
        if (!value.slug.trim()) {
          errors.slug = "Event URL slug is required.";
        }
        if (!value.department_id.trim()) {
          errors.department_id = "Department is required.";
        }
        if (!value.service_id.trim()) {
          errors.service_id = "Service is required.";
        }
      }

      if (step === 1) {
        if (total_min < 1) {
          errors.duration = "Duration is required.";
        }
        if (value.location_types.length === 0) {
          errors.location_types = "Select at least one location.";
        }
        if (!value.department_id.trim() || !value.service_id.trim()) {
          errors.service_provider_ids =
            "Please select a department and service in step 1.";
        } else if (assigned_service_providers.length === 0) {
          errors.service_provider_ids =
            "No providers are assigned to this service yet.";
        } else if (value.service_provider_ids.length === 0) {
          errors.service_provider_ids = "Select at least one provider.";
        }
        if (custom_availability) {
          const start = value.recurrence.custom_availability_start.trim();
          const end = value.recurrence.custom_availability_end.trim();
          const start_ms = start ? datetime_local_to_ms(start) : null;
          const end_ms = end ? datetime_local_to_ms(end) : null;
          if (!start) {
            errors.custom_availability_start =
              "Start date and time is required.";
          } else if (editingId == null && is_datetime_local_in_past(start)) {
            errors.custom_availability_start =
              "Start date and time cannot be in the past.";
          }
          if (!end) {
            errors.custom_availability_end = "End date and time is required.";
          } else if (start_ms != null && end_ms != null && end_ms <= start_ms) {
            errors.custom_availability_end =
              "End date and time must be later than the start date and time.";
          }
        }
      }

      if (step === 2) {
        if (!capacity_locked) {
          const capacity = parseInt(value.capacity_per_slot, 10);
          if (value.capacity_per_slot.trim() === "" || !Number.isFinite(capacity) || capacity < 1) {
            errors.capacity_per_slot = "Capacity must be at least 1.";
          }
        }
        if (recurring_format) {
          apply_recurrence_schedule_step_errors(
            value.recurrence,
            value.recurrence.frequency,
            errors,
            custom_availability,
            custom_availability_end_date,
            series_preview
          );
        }
        if (group_format && value.recurrence.enabled) {
          apply_recurrence_schedule_step_errors(
            value.recurrence,
            value.recurrence.allowed_frequency,
            errors,
            custom_availability,
            custom_availability_end_date,
            series_preview
          );
          if (value.recurrence.allow_custom_count) {
            const custom_count = parseInt(
              value.recurrence.custom_session_count,
              10
            );
            if (
              value.recurrence.custom_session_count.trim() === "" ||
              !Number.isFinite(custom_count) ||
              custom_count < 1
            ) {
              errors.recurrence_custom_session_count =
                "Enter a whole number of sessions (1 or more).";
            }
          }
        }
      }

      return errors;
    },
    [
      assigned_service_providers.length,
      capacity_locked,
      custom_availability,
      custom_availability_end_date,
      editingId,
      group_format,
      recurring_format,
      self_assign_option,
      series_preview,
      show_service_provider_field,
      total_min,
      value.capacity_per_slot,
      value.department_id,
      value.location_types.length,
      value.recurrence.allow_custom_count,
      value.recurrence.audience,
      value.recurrence.custom_availability_end,
      value.recurrence.custom_availability_start,
      value.recurrence.custom_session_count,
      value.recurrence.days_of_week.length,
      value.recurrence.enabled,
      value.recurrence.end_after_sessions,
      value.recurrence.end_date,
      value.recurrence.end_type,
      value.recurrence.frequency,
      value.recurrence.start_date,
      value.recurrence.start_time,
      value.service_id,
      value.service_provider_id,
      value.service_provider_ids.length,
      value.slug,
      value.title,
    ]
  );

  const validate_steps = useCallback(
    (steps: number[]): { ok: boolean; errors: event_type_field_errors; first_invalid_step: number | null } => {
      const errors: event_type_field_errors = {};
      let first_invalid_step: number | null = null;
      for (const step of steps) {
        const step_errors = collect_step_errors(step);
        if (Object.keys(step_errors).length > 0) {
          Object.assign(errors, step_errors);
          if (first_invalid_step == null) first_invalid_step = step;
        }
      }
      return {
        ok: first_invalid_step == null,
        errors,
        first_invalid_step,
      };
    },
    [collect_step_errors]
  );

  const show_step_errors = useCallback(
    (errors: event_type_field_errors, banner = STEP_REQUIRED_FIELDS_BANNER) => {
      set_field_errors(errors);
      set_step_banner_error(banner);
      const focus_key = first_invalid_field_key(errors);
      if (focus_key) {
        requestAnimationFrame(() => focus_event_type_field(focus_key));
      }
    },
    []
  );

  const go_to_next_step = useCallback(async () => {
    const result = validate_steps([active_step]);
    if (!result.ok) {
      show_step_errors(result.errors);
      return;
    }
    if (active_step === 0 && on_validate_slug) {
      set_slug_checking(true);
      try {
        const slug_ok = await on_validate_slug();
        if (!slug_ok) {
          set_step_banner_error(
            "Please enter a unique value in the required slug field."
          );
          requestAnimationFrame(() => focus_event_type_field("slug"));
          return;
        }
      } finally {
        set_slug_checking(false);
      }
    }
    set_field_errors({});
    set_step_banner_error(null);
    set_active_step((step) => Math.min(step + 1, EVENT_TYPE_PANEL_STEPS.length - 1));
  }, [active_step, on_validate_slug, show_step_errors, validate_steps]);

  useEffect(() => {
    set_active_step(0);
    set_field_errors({});
    set_step_banner_error(null);
  }, [editingId]);

  useEffect(() => {
    if (Object.keys(field_errors).length === 0 && !slug_error) {
      set_step_banner_error(null);
    }
  }, [field_errors, slug_error]);

  useEffect(() => {
    set_field_errors((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      const next = { ...prev };
      let changed = false;
      const clear = (key: event_type_field_error_key) => {
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      };
      if (value.title.trim()) clear("title");
      if (value.slug.trim()) clear("slug");
      if (total_min >= 1) clear("duration");
      if (capacity_locked) {
        clear("capacity_per_slot");
      } else {
        const capacity = parseInt(value.capacity_per_slot, 10);
        if (
          value.capacity_per_slot.trim() !== "" &&
          Number.isFinite(capacity) &&
          capacity >= 1
        ) {
          clear("capacity_per_slot");
        }
      }
      if (value.location_types.length > 0) clear("location_types");
      if (value.department_id.trim()) clear("department_id");
      if (value.service_id.trim()) clear("service_id");
      if (self_assign_option || value.service_provider_id) {
        clear("service_provider_id");
      }
      if (
        value.department_id.trim() &&
        value.service_id.trim() &&
        assigned_service_providers.length > 0 &&
        value.service_provider_ids.length > 0
      ) {
        clear("service_provider_ids");
      }
      if (!custom_availability) {
        clear("custom_availability_start");
        clear("custom_availability_end");
      } else {
        const start = value.recurrence.custom_availability_start.trim();
        const end = value.recurrence.custom_availability_end.trim();
        if (start && (editingId != null || !is_datetime_local_in_past(start))) {
          clear("custom_availability_start");
        }
        const start_ms = start ? datetime_local_to_ms(start) : null;
        const end_ms = end ? datetime_local_to_ms(end) : null;
        if (end && (start_ms == null || end_ms == null || end_ms > start_ms)) {
          clear("custom_availability_end");
        }
      }
      const schedule_active =
        recurring_format || (group_format && value.recurrence.enabled);
      const schedule_frequency = recurring_format
        ? value.recurrence.frequency
        : value.recurrence.allowed_frequency;

      if (!schedule_active) {
        clear("recurrence_days");
        clear("recurrence_start_date");
        clear("recurrence_start_time");
        clear("recurrence_end_date");
        clear("recurrence_end_after_sessions");
      }
      if (schedule_active) {
        if (value.recurrence.start_date.trim()) clear("recurrence_start_date");
        if (value.recurrence.start_time.trim()) clear("recurrence_start_time");
        if (
          schedule_frequency !== "weekly" ||
          value.recurrence.days_of_week.length > 0
        ) {
          clear("recurrence_days");
        }
        if (value.recurrence.end_type !== "on_date") {
          clear("recurrence_end_date");
        } else if (value.recurrence.end_date.trim()) {
          const end_date = value.recurrence.end_date;
          const start_date = value.recurrence.start_date.trim();
          const after_start = !start_date || end_date >= start_date;
          const before_custom_end =
            !custom_availability ||
            !custom_availability_end_date ||
            end_date <= custom_availability_end_date;
          if (after_start && before_custom_end) {
            clear("recurrence_end_date");
          }
        }
        if (value.recurrence.end_type !== "after") {
          clear("recurrence_end_after_sessions");
        } else {
          const sessions = parseInt(value.recurrence.end_after_sessions, 10);
          const valid_count =
            value.recurrence.end_after_sessions.trim() !== "" &&
            Number.isFinite(sessions) &&
            sessions >= 1;
          const overflow =
            custom_availability &&
            series_preview?.max_sessions != null &&
            valid_count &&
            sessions > series_preview.max_sessions;
          const missing_dates =
            series_preview != null &&
            series_preview.ends_on == null &&
            valid_count;
          if (valid_count && !overflow && !missing_dates) {
            clear("recurrence_end_after_sessions");
          }
        }
      }
      if (!group_format || !value.recurrence.enabled) {
        clear("recurrence_custom_session_count");
      } else if (!value.recurrence.allow_custom_count) {
        clear("recurrence_custom_session_count");
      } else {
        const custom_count = parseInt(value.recurrence.custom_session_count, 10);
        if (
          value.recurrence.custom_session_count.trim() !== "" &&
          Number.isFinite(custom_count) &&
          custom_count >= 1
        ) {
          clear("recurrence_custom_session_count");
        }
      }
      return changed ? next : prev;
    });
  }, [
    assigned_service_providers.length,
    capacity_locked,
    custom_availability,
    custom_availability_end_date,
    editingId,
    group_format,
    recurring_format,
    self_assign_option,
    total_min,
    value.capacity_per_slot,
    value.department_id,
    value.location_types.length,
    value.recurrence.allow_custom_count,
    value.recurrence.custom_availability_end,
    value.recurrence.custom_availability_start,
    value.recurrence.custom_session_count,
    value.recurrence.days_of_week.length,
    value.recurrence.enabled,
    value.recurrence.end_after_sessions,
    value.recurrence.end_date,
    value.recurrence.end_type,
    value.recurrence.frequency,
    value.recurrence.allowed_frequency,
    value.recurrence.start_date,
    value.recurrence.start_time,
    value.service_id,
    value.service_provider_id,
    value.service_provider_ids.length,
    value.slug,
    value.title,
    series_preview,
  ]);

  const duration_options = (() => {
    const presets: number[] = [...DURATION_PRESETS];
    if (total_min >= 1 && !presets.includes(total_min)) {
      return [...presets, total_min].sort((a, b) => a - b);
    }
    return presets;
  })();

  const panel_select_class = (has_error = false) =>
    `w-full appearance-none rounded-xl border bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
      has_error
        ? "border-red-400 focus:border-red-400"
        : "border-slate-200 focus:border-indigo-400"
    }`;

  const panel_input_class = (has_error = false) =>
    `w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:bg-white ${
      has_error
        ? "border-red-400 focus:border-red-400"
        : "border-slate-200 focus:border-indigo-400"
    }`;

  const field_error_message = (key: event_type_field_error_key, id: string) =>
    field_errors[key] ? (
      <p id={id} className="mt-1.5 text-sm text-red-600" role="alert">
        {field_errors[key]}
      </p>
    ) : null;

  const duration_dropdown_field = (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        Duration<span className="text-red-500">*</span>
      </span>
      <div className="relative">
        <select
          value={total_min >= 1 ? String(total_min) : ""}
          onChange={(e) => {
            const minutes = parseInt(e.target.value, 10);
            if (Number.isFinite(minutes) && minutes >= 1) {
              clear_field_error("duration");
              on_duration_preset(minutes);
            }
          }}
          className={panel_select_class(!!field_errors.duration)}
          aria-invalid={!!field_errors.duration || (!!formError && total_min < 1)}
          aria-describedby={field_errors.duration ? "event-type-duration-error" : undefined}
          data-event-type-field="duration"
        >
          <option value="" disabled>
            Select duration
          </option>
          {duration_options.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} mins
            </option>
          ))}
        </select>
        <LuChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
          aria-hidden
        />
      </div>
      {field_error_message("duration", "event-type-duration-error")}
    </label>
  );

  const location_dropdown_field = (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        Location<span className="text-red-500">*</span>
      </span>
      <LocationTypesMultiSelect
        value={value.location_types}
        onChange={(location_types) => {
          if (location_types.length > 0) clear_field_error("location_types");
          patch({ location_types });
        }}
        invalid={!!field_errors.location_types}
        error_id="event-type-location-error"
        focus_key="location_types"
      />
      {field_error_message("location_types", "event-type-location-error")}
    </label>
  );

  const selected_department_id = value.department_id.trim()
    ? Number(value.department_id)
    : null;
  const services_for_department = useMemo(() => {
    if (selected_department_id == null || !Number.isFinite(selected_department_id)) {
      return [];
    }
    return services.filter(
      (service) => Number(service.department_id) === selected_department_id
    );
  }, [selected_department_id, services]);

  const selected_department = useMemo(
    () =>
      departments.find(
        (department) => String(department.id) === value.department_id
      ) ?? null,
    [departments, value.department_id]
  );
  const selected_department_name = selected_department?.name ?? "—";
  const selected_service_name =
    services.find((service) => service.id === value.service_id)?.name ?? "—";

  const department_has_no_services =
    !lookups_loading &&
    selected_department != null &&
    services_for_department.length === 0;

  // A department with a single service leaves no choice to make, so pre-select it
  // once per department instead of forcing a click. Tracked by department id so a
  // deliberate change back to the placeholder is not immediately undone.
  const auto_selected_service_department_ref = useRef<string | null>(null);

  useEffect(() => {
    if (services_for_department.length !== 1) return;
    if (auto_selected_service_department_ref.current === value.department_id) return;
    auto_selected_service_department_ref.current = value.department_id;
    const only_service_id = services_for_department[0].id;
    if (value.service_id === only_service_id) return;
    clear_field_error("service_id");
    patch({ service_id: only_service_id, service_provider_ids: [] });
  }, [
    clear_field_error,
    patch,
    services_for_department,
    value.department_id,
    value.service_id,
  ]);

  const handle_service_created = useCallback(
    async (created: event_type_created_service) => {
      set_service_panel_open(false);
      await load_department_and_service_lookups();
      clear_field_error("service_id");
      patch({ service_id: created.id, service_provider_ids: [] });
    },
    [clear_field_error, load_department_and_service_lookups, patch]
  );

  const department_and_service_fields = (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Department<span className="text-red-500">*</span>
        </span>
        <div className="relative">
          <select
            value={value.department_id}
            onChange={(e) => {
              const next_department_id = e.target.value;
              if (next_department_id.trim()) clear_field_error("department_id");
              clear_field_error("service_id");
              patch({
                department_id: next_department_id,
                service_id: "",
                service_provider_ids: [],
              });
            }}
            disabled={lookups_loading}
            className={panel_select_class(!!field_errors.department_id)}
            aria-invalid={!!field_errors.department_id}
            aria-describedby={
              field_errors.department_id ? "event-type-department-error" : undefined
            }
            data-event-type-field="department_id"
          >
            <option value="">
              {lookups_loading ? "Loading departments…" : "Select department"}
            </option>
            {departments.map((department) => (
              <option key={department.id} value={String(department.id)}>
                {department.name}
              </option>
            ))}
          </select>
          <LuChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden
          />
        </div>
        {field_error_message("department_id", "event-type-department-error")}
      </label>
      <div className="block">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Service<span className="text-red-500">*</span>
          </span>
          <div className="relative">
            <select
              value={value.service_id}
              onChange={(e) => {
                const next_service_id = e.target.value;
                if (next_service_id.trim()) clear_field_error("service_id");
                patch({ service_id: next_service_id, service_provider_ids: [] });
              }}
              disabled={lookups_loading || !value.department_id}
              className={panel_select_class(!!field_errors.service_id)}
              aria-invalid={!!field_errors.service_id}
              aria-describedby={
                field_errors.service_id ? "event-type-service-error" : undefined
              }
              data-event-type-field="service_id"
            >
              <option value="">
                {lookups_loading
                  ? "Loading services…"
                  : !value.department_id
                    ? "Select a department first"
                    : services_for_department.length === 0
                      ? "No services in this department"
                      : "Select service"}
              </option>
              {services_for_department.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <LuChevronDown
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden
            />
          </div>
          {field_error_message("service_id", "event-type-service-error")}
        </label>
        {department_has_no_services ? (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-xs text-slate-500">
              No services are available for this department.
            </p>
            <button
              type="button"
              onClick={() => set_service_panel_open(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
            >
              <LuPlus className="h-3.5 w-3.5" aria-hidden />
              Add Service
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  const add_service_panel =
    service_panel_open && selected_department ? (
      <EventTypeAddServicePanel
        department={selected_department}
        existing_services={services}
        on_close={() => set_service_panel_open(false)}
        on_created={handle_service_created}
      />
    ) : null;

  const slug_field = (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        Event URL slug<span className="text-red-500">*</span>
      </span>
      <div
        className={`flex overflow-hidden rounded-xl border bg-slate-50 transition focus-within:bg-white ${
          slug_error || field_errors.slug
            ? "border-red-400 focus-within:border-red-400"
            : "border-slate-200 focus-within:border-indigo-400"
        }`}
      >
        <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-100 px-3 text-sm text-slate-500">
          /
        </span>
        <input
          value={value.slug}
          onChange={(e) => {
            on_slug_edited?.();
            if (e.target.value.trim()) clear_field_error("slug");
            patch({ slug: e.target.value });
          }}
          onBlur={() => {
            const normalized = normalize_event_type_slug_input(value.slug);
            if (normalized !== value.slug) {
              patch({ slug: normalized });
            }
            on_slug_blur?.();
          }}
          placeholder="product-demo"
          className="w-full bg-transparent px-3 py-2.5 text-sm text-slate-900 outline-none"
          aria-invalid={!!slug_error || !!field_errors.slug}
          aria-describedby={
            slug_error || field_errors.slug ? "event-type-slug-error" : undefined
          }
          data-event-type-field="slug"
        />
      </div>
      {slug_error ? (
        <p id="event-type-slug-error" className="mt-1.5 text-sm text-red-600" role="alert">
          {slug_error}
        </p>
      ) : (
        field_error_message("slug", "event-type-slug-error")
      )}
    </label>
  );

  const short_description_field = (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">
        {variant === "panel" ? "Description" : "Short description"}
      </span>
      <textarea
        value={value.short_description}
        onChange={(e) => patch({ short_description: e.target.value })}
        placeholder="Showcase our product and features to potential customers."
        rows={3}
        className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
      />
    </label>
  );

  const on_format_change = (next_format: event_type_format) => {
    const one_time = next_format === "recurring";
    const synced_start =
      custom_availability && custom_availability_start_date
        ? custom_availability_start_date
        : value.recurrence.start_date;
    const next_audience = one_time ? value.recurrence.audience : "single";
    patch({
      event_type_format: next_format,
      capacity_per_slot: String(
        default_capacity_for_event_type_format(next_format, next_audience)
      ),
      recurrence: {
        ...value.recurrence,
        enabled: false,
        audience: next_audience,
        start_date:
          one_time && !synced_start.trim()
            ? new Date().toISOString().slice(0, 10)
            : synced_start,
      },
    });
  };

  const on_one_time_audience_change = (next_audience: event_type_recurrence_audience) => {
    patch({
      capacity_per_slot: String(
        default_capacity_for_event_type_format("recurring", next_audience)
      ),
      recurrence: {
        ...value.recurrence,
        audience: next_audience,
      },
    });
  };

  const format_icon = (format: event_type_format) => {
    if (format === "recurring") {
      return <LuRefreshCw className="h-4 w-4" aria-hidden />;
    }
    if (format === "group_class") {
      return <LuUsers className="h-4 w-4" aria-hidden />;
    }
    return <LuUser className="h-4 w-4" aria-hidden />;
  };

  const format_icon_wrap_class = (format: event_type_format, selected: boolean) => {
    if (format === "recurring") {
      return selected
        ? "bg-sky-100 text-sky-600"
        : "bg-sky-50 text-sky-500";
    }
    if (format === "group_class") {
      return selected
        ? "bg-emerald-100 text-emerald-600"
        : "bg-emerald-50 text-emerald-500";
    }
    return selected
      ? "bg-indigo-100 text-indigo-600"
      : "bg-indigo-50 text-indigo-500";
  };

  const digit_key_filter = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (
      ["Backspace", "Delete", "Tab", "Escape", "Enter"].includes(e.key) ||
      (e.key === "a" && e.ctrlKey) ||
      (e.key === "c" && e.ctrlKey) ||
      (e.key === "v" && e.ctrlKey) ||
      (e.key === "x" && e.ctrlKey) ||
      /^\d$/.test(e.key)
    ) {
      return;
    }
    e.preventDefault();
  };

  const patch_recurrence = (changes: Partial<event_type_form_recurrence>) => {
    patch({ recurrence: { ...value.recurrence, ...changes } });
  };

  const setting_hint = (hint: string) => (
    <span className="inline-flex items-center text-slate-400" title={hint}>
      <LuInfo className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{hint}</span>
    </span>
  );

  const setting_label = (text: string, hint: string) => (
    <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
      {text}
      {setting_hint(hint)}
    </span>
  );

  const setting_switch = (
    checked: boolean,
    on_toggle: () => void,
    label: string,
    disabled = false
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={on_toggle}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "justify-end bg-indigo-600" : "justify-start bg-slate-200"
      }`}
    >
      <span className="h-4 w-4 rounded-full bg-white shadow" />
    </button>
  );

  const setting_chip_class = (selected: boolean) =>
    `min-w-[3.25rem] rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
      selected
        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  const select_session_preset = (preset: number) => {
    clear_field_error("recurrence_custom_session_count");
    patch_recurrence({
      session_preset: preset,
      allow_custom_count: false,
      custom_session_count: "",
    });
  };

  const select_custom_session_count = () => {
    patch_recurrence({ allow_custom_count: true, session_preset: null });
  };

  const booking_pattern_section_class =
    "space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4";

  const recurrence_series_schedule_slice = {
    days_of_week: value.recurrence.days_of_week,
    start_date: value.recurrence.start_date,
    start_time: value.recurrence.start_time,
    end_type: value.recurrence.end_type,
    end_date: value.recurrence.end_date,
    end_after_sessions: value.recurrence.end_after_sessions,
  };

  const recurrence_series_schedule_common_props = {
    recurrence: recurrence_series_schedule_slice,
    on_recurrence_patch: patch_recurrence,
    panel_select_class,
    field_errors,
    clear_field_error,
    field_error_message,
    custom_availability,
    custom_availability_start_date,
    custom_availability_end_date,
    ends_on_date: series_preview?.ends_on ?? null,
    max_fitting_sessions: series_preview?.max_sessions ?? null,
    series_ready: series_preview != null,
    digit_key_filter,
  };

  const group_recurring_booking_options = value.recurrence.enabled ? (
    <>
      <EventTypeRecurrenceSeriesSchedule
        {...recurrence_series_schedule_common_props}
        frequency={value.recurrence.allowed_frequency}
        on_frequency_change={(next) =>
          patch_recurrence({ allowed_frequency: next })
        }
        frequency_label="Allowed frequency"
        end_radio_name="event-type-group-recurrence-end"
        show_heading={false}
      />

      {/* <div className="flex flex-wrap items-center justify-between gap-3">
        {setting_label(
          "Session preset",
          "Series length offered to customers as a one-click option."
        )}
        <div className="flex flex-wrap items-center gap-2">
          {EVENT_TYPE_SESSION_PRESET_OPTIONS.map((preset) => {
            const selected =
              !value.recurrence.allow_custom_count &&
              value.recurrence.session_preset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => select_session_preset(preset)}
                aria-pressed={selected}
                className={setting_chip_class(selected)}
              >
                {preset}
              </button>
            );
          })}
          <button
            type="button"
            onClick={select_custom_session_count}
            aria-pressed={value.recurrence.allow_custom_count}
            className={setting_chip_class(value.recurrence.allow_custom_count)}
          >
            Custom
          </button>
        </div>
      </div>

      {value.recurrence.allow_custom_count ? (
        <label className="flex flex-wrap items-center justify-between gap-3">
          {setting_label(
            "Custom number of sessions",
            "Whole number of sessions in the series."
          )}
          <span className="flex flex-col items-end gap-1">
            <input
              type="text"
              inputMode="numeric"
              value={value.recurrence.custom_session_count}
              placeholder="e.g. 16"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw !== "" && !/^\d+$/.test(raw)) return;
                const count = parseInt(raw, 10);
                if (raw !== "" && Number.isFinite(count) && count >= 1) {
                  clear_field_error("recurrence_custom_session_count");
                }
                patch_recurrence({ custom_session_count: raw });
              }}
              onKeyDown={digit_key_filter}
              aria-invalid={!!field_errors.recurrence_custom_session_count}
              aria-describedby={
                field_errors.recurrence_custom_session_count
                  ? "event-type-recurrence-custom-count-error"
                  : undefined
              }
              className={`w-32 rounded-xl border bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:bg-white ${
                field_errors.recurrence_custom_session_count
                  ? "border-red-400 focus:border-red-400"
                  : "border-slate-200 focus:border-indigo-400"
              }`}
              data-event-type-field="recurrence_custom_session_count"
            />
            {field_errors.recurrence_custom_session_count ? (
              <span
                id="event-type-recurrence-custom-count-error"
                className="text-sm text-red-600"
                role="alert"
              >
                {field_errors.recurrence_custom_session_count}
              </span>
            ) : null}
          </span>
        </label>
      ) : null}

      <p className="flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
        <LuInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Customers will only see schedules that work across the full series.
      </p> */}
    </>
  ) : null;

  const one_on_one_settings_section = (
    <div className={booking_pattern_section_class}>
      <h4 className="text-sm font-bold text-slate-900">One-to-one settings</h4>
      <label className="block max-w-xs">
        <span className="mb-2 block">
          {setting_label(
            "Capacity per slot",
            "One-to-one events always hold a single booking per slot."
          )}
        </span>
        <input
          type="text"
          value="1"
          readOnly
          aria-readonly
          className={`${panel_input_class()} cursor-not-allowed opacity-70`}
        />
        <span className="mt-1.5 block text-xs text-slate-500">
          One booking per time slot.
        </span>
      </label>
    </div>
  );

  const group_settings_section = (
    <div className={booking_pattern_section_class}>
      <h4 className="text-sm font-bold text-slate-900">Group / class settings</h4>

      <label className="block max-w-xs">
        <span className="mb-2 block">
          {setting_label(
            "Capacity",
            "How many attendees can join a single session."
          )}
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value.capacity_per_slot}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw !== "" && !/^\d+$/.test(raw)) return;
            const capacity = parseInt(raw, 10);
            if (raw !== "" && Number.isFinite(capacity) && capacity >= 1) {
              clear_field_error("capacity_per_slot");
            }
            patch({ capacity_per_slot: raw });
          }}
          onKeyDown={digit_key_filter}
          aria-invalid={!!field_errors.capacity_per_slot}
          aria-describedby={
            field_errors.capacity_per_slot ? "event-type-capacity-error" : undefined
          }
          className={panel_input_class(!!field_errors.capacity_per_slot)}
          data-event-type-field="capacity_per_slot"
        />
        {field_error_message("capacity_per_slot", "event-type-capacity-error")}
      </label>

      <div className="flex items-center justify-between gap-3">
        {setting_label(
          "Show seats remaining",
          "Display how many places are left on the booking page."
        )}
        {setting_switch(
          value.show_seats_remaining,
          () => patch({ show_seats_remaining: !value.show_seats_remaining }),
          "Show seats remaining"
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {setting_label(
          "Waitlist",
          "Collect customers on a waitlist once the session is full."
        )}
        {setting_switch(
          value.allow_waitlist,
          () => patch({ allow_waitlist: !value.allow_waitlist }),
          "Waitlist"
        )}
      </div>

      <label className="flex flex-wrap items-center justify-between gap-3">
        {setting_label(
          "Waitlist capacity",
          "Leave empty for an unlimited waitlist."
        )}
        <input
          type="text"
          inputMode="numeric"
          value={value.waitlist_capacity}
          disabled={!value.allow_waitlist}
          placeholder="Unlimited"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw !== "" && !/^\d+$/.test(raw)) return;
            patch({ waitlist_capacity: raw });
          }}
          onKeyDown={digit_key_filter}
          className={`w-32 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60`}
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        {setting_label(
          "Allow recurring booking",
          "Let customers book a series of sessions instead of a single slot."
        )}
        {setting_switch(
          value.recurrence.enabled,
          () => patch_recurrence({ enabled: !value.recurrence.enabled }),
          "Allow recurring booking"
        )}
      </div>

      {group_recurring_booking_options}
    </div>
  );

  const recurring_series_schedule = (
    <EventTypeRecurrenceSeriesSchedule
      {...recurrence_series_schedule_common_props}
      frequency={value.recurrence.frequency}
      on_frequency_change={(next) => patch_recurrence({ frequency: next })}
      frequency_label="Recurring"
      end_radio_name="event-type-recurrence-end"
    />
  );

  const recurring_settings_section = (
    <div className={booking_pattern_section_class}>
      <h4 className="text-sm font-bold text-slate-900">One Time settings</h4>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Attendees<span className="text-red-500">*</span>
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {EVENT_TYPE_RECURRENCE_AUDIENCE_OPTIONS.map((option) => {
            const selected = value.recurrence.audience === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => on_one_time_audience_change(option.value)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
                aria-pressed={selected}
              >
                <span
                  className={`block text-sm font-semibold ${
                    selected ? "text-indigo-700" : "text-slate-900"
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {value.recurrence.audience === "group" ? (
        <label className="block max-w-xs">
          <span className="mb-2 block">
            {setting_label(
              "Capacity",
              "How many attendees can join a single session."
            )}
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={value.capacity_per_slot}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw !== "" && !/^\d+$/.test(raw)) return;
              const capacity = parseInt(raw, 10);
              if (raw !== "" && Number.isFinite(capacity) && capacity >= 1) {
                clear_field_error("capacity_per_slot");
              }
              patch({ capacity_per_slot: raw });
            }}
            onKeyDown={digit_key_filter}
            aria-invalid={!!field_errors.capacity_per_slot}
            aria-describedby={
              field_errors.capacity_per_slot ? "event-type-capacity-error" : undefined
            }
            className={panel_input_class(!!field_errors.capacity_per_slot)}
            data-event-type-field="capacity_per_slot"
          />
          {field_error_message("capacity_per_slot", "event-type-capacity-error")}
        </label>
      ) : null}

      {recurring_series_schedule}
    </div>
  );

  const selected_provider_names = assigned_service_providers
    .filter((provider) => value.service_provider_ids.includes(provider.id))
    .map((provider) => provider.name);

  const toggle_service_provider = (provider_id: string) => {
    const selected = value.service_provider_ids.includes(provider_id);
    patch({
      service_provider_ids: selected
        ? value.service_provider_ids.filter((id) => id !== provider_id)
        : [...value.service_provider_ids, provider_id],
    });
  };

  const service_provider_field = (
    <div
      className="block"
      data-event-type-field="service_provider_ids"
      role="group"
      aria-label="Providers"
      tabIndex={-1}
      aria-describedby={
        field_errors.service_provider_ids
          ? "event-type-service-provider-error"
          : undefined
      }
    >
      <span className="mb-2 block text-sm font-medium text-slate-700">
        Providers<span className="text-red-500">*</span>
      </span>
      {!value.department_id.trim() || !value.service_id.trim() ? (
        <div
          className={`rounded-xl border border-dashed px-3 py-3 text-sm ${
            field_errors.service_provider_ids
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <p>Please select a department and service in step 1.</p>
          <button
            type="button"
            onClick={() => set_active_step(0)}
            className="mt-2 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
          >
            Go to step 1
          </button>
        </div>
      ) : assigned_service_providers.length === 0 ? (
        <p
          className={`rounded-xl border border-dashed px-3 py-3 text-sm ${
            field_errors.service_provider_ids
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          No providers are assigned to this service yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          {assigned_service_providers.map((provider) => {
            const selected = value.service_provider_ids.includes(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => toggle_service_provider(provider.id)}
                aria-pressed={selected}
                className={`flex min-w-[220px] flex-1 items-center gap-3 rounded-2xl border px-3 py-3 text-left transition sm:max-w-xs ${
                  selected
                    ? "border-indigo-500 bg-indigo-50"
                    : field_errors.service_provider_ids
                      ? "border-red-400 bg-white hover:bg-slate-50"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <WorkspaceUserAvatar
                  name={provider.name}
                  userId={provider.id}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {provider.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {provider.role_label}
                  </span>
                </span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    selected
                      ? "bg-indigo-600 text-white"
                      : "border border-slate-300 bg-white"
                  }`}
                  aria-hidden
                >
                  {selected ? <LuCheck className="h-3.5 w-3.5" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {field_error_message(
        "service_provider_ids",
        "event-type-service-provider-error"
      )}
      <p className="mt-2 text-xs text-slate-500">
        Only providers assigned to this service can be booked.
      </p>
    </div>
  );

  const is_last_step = active_step >= EVENT_TYPE_PANEL_STEPS.length - 1;

  const handle_panel_save = useCallback(async () => {
    if (!is_last_step) return;

    const result = validate_steps([0, 1, 2]);
    if (!result.ok) {
      const target_step = result.first_invalid_step ?? 0;
      set_active_step(target_step);
      set_field_errors(result.errors);
      set_step_banner_error(STEP_REQUIRED_FIELDS_BANNER);
      window.setTimeout(() => {
        const focus_key = first_invalid_field_key(result.errors);
        if (focus_key) focus_event_type_field(focus_key);
      }, 50);
      return;
    }

    set_is_panel_saving(true);
    try {
      if (on_validate_slug) {
        const slug_ok = await on_validate_slug();
        if (!slug_ok) {
          set_active_step(0);
          set_step_banner_error(
            "Please enter a unique value in the required slug field."
          );
          requestAnimationFrame(() => focus_event_type_field("slug"));
          set_is_panel_saving(false);
          return;
        }
      }

      set_step_banner_error(null);
      // Synthetic event for parent handlers that expect FormEvent.
      onSubmit({
        preventDefault() {},
        stopPropagation() {},
      } as FormEvent);
    } catch {
      set_is_panel_saving(false);
    }
  }, [is_last_step, onSubmit, on_validate_slug, validate_steps]);

  useEffect(() => {
    if (!submitting) {
      set_is_panel_saving(false);
    }
  }, [submitting]);

  const review_summary_rows: ReadonlyArray<{ label: string; value: string }> = [
    {
      label: "Event name",
      value: value.title.trim() || "—",
    },
    {
      label: "Format",
      value:
        EVENT_TYPE_FORMAT_OPTIONS.find(
          (option) => option.value === value.event_type_format
        )?.label ?? "—",
    },
    {
      label: "Duration",
      value: format_review_duration_label(total_min),
    },
    {
      label: "Location",
      value:
        value.location_types.length > 0
          ? format_event_type_location_labels(value.location_types)
          : "—",
    },
    {
      label: "Department",
      value: selected_department_name,
    },
    {
      label: "Service",
      value: selected_service_name,
    },
    {
      label: "Provider",
      value: selected_provider_names.length > 0 ? selected_provider_names.join(", ") : "—",
    },
    {
      label: "Timezone",
      value: timezone_label?.trim() || "Not set",
    },
    {
      label: "Visibility",
      value: value.is_public ? "Public" : "Private",
    },
  ];

  if (variant === "panel") {
    return ( // Works on Add/Edit Event-type using side panel from all event-types page "/event-types"
      <form
        onSubmit={(e) => {
          // Wizard must never save via native submit (Enter key or Next→Save click-through).
          e.preventDefault();
        }}
        className="relative flex flex-col h-full"
        aria-describedby={
          [
            formError ? "event-type-form-error" : null,
            step_banner_error ? "event-type-step-banner-error" : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        <div className="flex flex-1 h-full">
          <nav
            aria-label="Event type steps"
            className="hidden w-52 shrink-0 overflow-y-auto border-r border-slate-200 bg-slate-50/80 py-4 sm:block lg:w-56"
          >
            {/* Stepper for Add/Edit Event-type using side panel from all event-types page "/event-types" */}
            <ol className="space-y-0.5 px-2">
              {EVENT_TYPE_PANEL_STEPS.map((step, index) => {
                const is_active = index === active_step;
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => set_active_step(index)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition ${
                        is_active
                          ? "bg-indigo-100 font-semibold text-indigo-700"
                          : "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                      aria-current={is_active ? "step" : undefined}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          is_active
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="leading-snug">{step.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="mb-3 flex gap-1 pb-1 sm:hidden">
                {EVENT_TYPE_PANEL_STEPS.map((step, index) => {
                  const is_active = index === active_step;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => set_active_step(index)}
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        is_active
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 text-slate-600"
                      }`}
                      aria-label={step.label}
                      aria-current={is_active ? "step" : undefined}
                    >
                      {index + 1}
                    </button>
                  );
                })}
              </div>

              {active_step === 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        1
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Basic Details
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Name this event and set its URL, department, and service.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 px-5 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Event name<span className="text-red-500">*</span>
                        </span>
                        <input
                          value={value.title}
                          onChange={(e) => {
                            if (e.target.value.trim()) clear_field_error("title");
                            patch({ title: e.target.value });
                          }}
                          placeholder="e.g. Therapy Session"
                          className={panel_input_class(!!field_errors.title)}
                          aria-invalid={!!field_errors.title}
                          aria-describedby={
                            field_errors.title ? "event-type-title-error" : undefined
                          }
                          data-event-type-field="title"
                        />
                        {field_error_message("title", "event-type-title-error")}
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Internal label (optional)
                        </span>
                        <input
                          value={value.internal_label}
                          onChange={(e) => patch({ internal_label: e.target.value })}
                          placeholder="e.g. Therapy Session Call"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                        />
                      </label>
                    </div>
                    {slug_field}
                    {short_description_field}
                    {department_and_service_fields}
                  </div>
                </div>
              ) : null}

              {active_step === 1 ? (
                <div className="overflow-visible rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        2
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Schedule & Availability
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Set when this event is available for booking.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 px-5 py-5">
                    <div>
                      <h4 className="mb-3 text-sm font-bold text-slate-900">
                        Availability
                      </h4>
                      <div className="space-y-3" role="radiogroup" aria-label="Availability">
                        {EVENT_TYPE_AVAILABILITY_MODE_OPTIONS.map((option) => {
                          const selected = value.availability_mode === option.value;
                          const provider_name =
                            selected_provider_names[0] ||
                            self_assign_option?.label ||
                            "the assigned provider";
                          const description =
                            option.description_template === "provider"
                              ? `Use the working hours already set for ${provider_name}`
                              : "Set different hours for this event type";
                          return (
                            <label
                              key={option.value}
                              className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition ${
                                selected
                                  ? "border-indigo-300 bg-indigo-50/60"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name="event-type-availability-mode"
                                className="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={selected}
                                onChange={() => {
                                  if (option.value === "custom") {
                                    const start =
                                      value.recurrence.custom_availability_start.trim() ||
                                      now_datetime_local();
                                    const start_date =
                                      date_part_from_datetime_local(start) ||
                                      value.recurrence.start_date;
                                    patch({
                                      availability_mode: option.value,
                                      recurrence: {
                                        ...value.recurrence,
                                        custom_availability_start: start,
                                        start_date,
                                      },
                                    });
                                    return;
                                  }
                                  patch({ availability_mode: option.value });
                                }}
                              />
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900">
                                  {option.label}
                                </span>
                                <span className="mt-0.5 block text-sm text-slate-500">
                                  {description}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {custom_availability ? (
                      <div className="grid gap-4">
                        <div className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Start date & time<span className="text-red-500">*</span>
                          </span>
                          <DateTimePicker
                            value={value.recurrence.custom_availability_start}
                            min={editingId == null ? now_datetime_local() : undefined}
                            onChange={(next_start) => {
                              const start_date =
                                date_part_from_datetime_local(next_start) ||
                                value.recurrence.start_date;
                              if (
                                next_start.trim() &&
                                !is_datetime_local_in_past(next_start)
                              ) {
                                clear_field_error("custom_availability_start");
                              }
                              patch_recurrence({
                                custom_availability_start: next_start,
                                start_date,
                              });
                            }}
                            invalid={!!field_errors.custom_availability_start}
                            error_id="event-type-custom-availability-start-error"
                            focus_key="custom_availability_start"
                          />
                          {field_error_message(
                            "custom_availability_start",
                            "event-type-custom-availability-start-error"
                          )}
                        </div>
                        <div className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            End date & time<span className="text-red-500">*</span>
                          </span>
                          <DateTimePicker
                            value={value.recurrence.custom_availability_end}
                            min={
                              value.recurrence.custom_availability_start ||
                              now_datetime_local()
                                ? value.recurrence.custom_availability_start
                                : now_datetime_local()
                            }
                            onChange={(next_end) => {
                              const start_ms = datetime_local_to_ms(
                                value.recurrence.custom_availability_start
                              );
                              const end_ms = datetime_local_to_ms(next_end);
                              if (
                                next_end.trim() &&
                                (start_ms == null ||
                                  end_ms == null ||
                                  end_ms > start_ms)
                              ) {
                                clear_field_error("custom_availability_end");
                              }
                              patch_recurrence({ custom_availability_end: next_end });
                            }}
                            invalid={!!field_errors.custom_availability_end}
                            error_id="event-type-custom-availability-end-error"
                            focus_key="custom_availability_end"
                          />
                          {field_error_message(
                            "custom_availability_end",
                            "event-type-custom-availability-end-error"
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="grid gap-4 sm:grid-cols-2">
                      {duration_dropdown_field}
                      <div className="hidden sm:block" aria-hidden />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {location_dropdown_field}
                      <div className="hidden sm:block" aria-hidden />
                    </div>
                    <div>
                      {service_provider_field}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Allow reschedule</p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={value.allow_reschedule}
                        onClick={() => patch({ allow_reschedule: !value.allow_reschedule })}
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                          value.allow_reschedule
                            ? "justify-end bg-indigo-600"
                            : "justify-start bg-slate-200"
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900">Allow cancellation</p>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={value.allow_cancellation}
                        onClick={() =>
                          patch({ allow_cancellation: !value.allow_cancellation })
                        }
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                          value.allow_cancellation
                            ? "justify-end bg-indigo-600"
                            : "justify-start bg-slate-200"
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {active_step === 2 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        3
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Booking Pattern
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Set how often this event repeats.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Event type format<span className="text-red-500">*</span>
                      </span>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {EVENT_TYPE_FORMAT_OPTIONS.map((option) => {
                          const selected = value.event_type_format === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => on_format_change(option.value)}
                              className={`flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                                selected
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-slate-200 bg-white hover:bg-slate-50"
                              }`}
                              aria-pressed={selected}
                            >
                              <span
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${format_icon_wrap_class(
                                  option.value,
                                  selected
                                )}`}
                              >
                                {format_icon(option.value)}
                              </span>
                              <span className="min-w-0">
                                <span
                                  className={`block text-sm font-semibold ${
                                    selected ? "text-indigo-700" : "text-slate-900"
                                  }`}
                                >
                                  {option.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-slate-500">
                                  {option.description}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {recurring_format
                      ? recurring_settings_section
                      : group_format
                        ? group_settings_section
                        : one_on_one_settings_section}
                  </div>
                </div>
              ) : null}

              {active_step === 3 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        4
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Booking Options
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Configure how this event can be booked.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <h4 className="mb-3 text-sm font-bold text-slate-900">Visibility</h4>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => patch({ is_public: true })}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            value.is_public
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          aria-pressed={value.is_public}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              value.is_public
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-slate-300 bg-white"
                            }`}
                            aria-hidden
                          >
                            {value.is_public ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            ) : null}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">
                              Public
                            </span>
                            <span className="mt-0.5 block text-sm text-slate-500">
                              Anyone can book
                            </span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => patch({ is_public: false })}
                          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                            !value.is_public
                              ? "border-indigo-500 bg-indigo-50"
                              : "border-slate-200 bg-white hover:bg-slate-50"
                          }`}
                          aria-pressed={!value.is_public}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                              !value.is_public
                                ? "border-indigo-600 bg-indigo-600"
                                : "border-slate-300 bg-white"
                            }`}
                            aria-hidden
                          >
                            {!value.is_public ? (
                              <span className="h-1.5 w-1.5 rounded-full bg-white" />
                            ) : null}
                          </span>
                          <span>
                            <span className="block text-sm font-semibold text-slate-900">
                              Private
                            </span>
                            <span className="mt-0.5 block text-sm text-slate-500">
                              Only people with the link
                            </span>
                          </span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-slate-900">Allow waitlist</p>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Add customers to waitlist when slots are full.
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={value.allow_waitlist}
                        onClick={() => patch({ allow_waitlist: !value.allow_waitlist })}
                        className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                          value.allow_waitlist
                            ? "justify-end bg-indigo-600"
                            : "justify-start bg-slate-200"
                        }`}
                      >
                        <span className="h-5 w-5 rounded-full bg-white shadow" />
                      </button>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-900">
                        Minimum booking notice
                      </span>
                      <div className="relative">
                        <select
                          value={value.min_booking_notice_minutes}
                          onChange={(e) =>
                            patch({ min_booking_notice_minutes: e.target.value })
                          }
                          className={panel_select_class()}
                        >
                          {EVENT_TYPE_MIN_BOOKING_NOTICE_OPTIONS.map((option) => (
                            <option key={option.value} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <LuChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                          aria-hidden
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-900">
                        Maximum booking window
                      </span>
                      <div className="relative">
                        <select
                          value={value.max_booking_window_days}
                          onChange={(e) =>
                            patch({ max_booking_window_days: e.target.value })
                          }
                          className={panel_select_class()}
                        >
                          {EVENT_TYPE_MAX_BOOKING_WINDOW_OPTIONS.map((option) => (
                            <option key={option.value} value={String(option.value)}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <LuChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                          aria-hidden
                        />
                      </div>
                    </label>
                  </div>
                </div>
              ) : null}

              {active_step === 4 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                        5
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          Review & Publish
                        </h3>
                        <p className="mt-0.5 text-sm text-slate-500">
                          Review Event-type summary and choose whether this event type is active.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5 px-5 py-5">
                    <div>
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Event status
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {EVENT_TYPE_STATUS_OPTIONS.map((option) => {
                          const selected = value.status === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => patch({ status: option.value })}
                              className={`rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                                selected
                                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              }`}
                              aria-pressed={selected}
                            >
                              <span className="block font-semibold">{option.label}</span>
                              <span className="mt-0.5 block text-xs text-slate-500">
                                {option.description}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-3 text-sm font-bold text-slate-900">
                        Event Summary
                      </h4>
                      <div className="space-y-3">
                        {review_summary_rows.map((row) => (
                          <div key={row.label} className="flex gap-3 text-sm">
                            <span className="w-28 shrink-0 text-slate-500 sm:w-36">
                              {row.label}
                            </span>
                            <span className="min-w-0 break-words font-semibold text-slate-900">
                              {row.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <p className="text-sm font-bold text-slate-900">Booking URL</p>
                      {booking_url ? (
                        <div className="mt-2 flex items-start gap-2">
                          <a
                            href={booking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-0 flex-1 break-all text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                          >
                            {display_booking_url(booking_url)}
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              void (async () => {
                                const copied = await copy_text_to_clipboard(booking_url);
                                if (!copied) return;
                                set_booking_url_copied(true);
                                window.setTimeout(() => set_booking_url_copied(false), 2000);
                              })();
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            aria-label={
                              booking_url_copied ? "Booking URL copied" : "Copy booking URL"
                            }
                          >
                            {booking_url_copied ? (
                              <LuCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                            ) : (
                              <LuCopy className="h-4 w-4" aria-hidden />
                            )}
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Add an event URL slug to preview the booking link.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {formError && (
                <p id="event-type-form-error" className="mt-4 text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}

              {successMessage && (
                <p
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  role="status"
                >
                  {successMessage}
                </p>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4">
              {active_step > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    set_step_banner_error(null);
                    set_active_step((step) => Math.max(step - 1, 0));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
              <div className="flex flex-col min-w-0 flex-1 items-end justify-end gap-3">
                {step_banner_error ? (
                  <p
                    id="event-type-step-banner-error"
                    className="min-w-0 truncate text-right text-sm font-medium text-red-600"
                    role="alert"
                  >
                    {step_banner_error}
                  </p>
                ) : null}
                {is_last_step ? (
                  <button
                    type="button"
                    onClick={() => void handle_panel_save()}
                    disabled={submitting || is_panel_saving}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting || is_panel_saving ? "Saving…" : "Save Event Type"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void go_to_next_step()}
                    disabled={slug_checking}
                    className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {slug_checking ? "Checking…" : "Next"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Nested overlay: keeps the event type wizard mounted underneath. */}
        {add_service_panel ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add service"
            className={`absolute inset-0 z-40 flex flex-col overflow-hidden bg-white transition-transform duration-300 ease-in-out will-change-transform ${
              service_panel_entered ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {add_service_panel}
          </div>
        ) : null}
      </form>
    );
  }

  return ( // Works on Edit Event-Type Page "/event-type/{event_type_id}/edit" when user clicks on event-type notification from all notifications page "/notifications/all"
    <div className="rounded-2xl bg-slate-50 p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">
            Event types
          </p>
          <h1
            id="event-type-form-heading"
            className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl"
          >
            {editingId ? "Update event type" : "Create event type"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Set duration with hours and minutes, location, and visibility. Clients see public types
            on your booking page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-7">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingId ? "Edit event type" : "New event type"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Build scheduling rules with flexible hour and minute controls.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Smart duration setup
              </div>
            </div>

            <form onSubmit={onSubmit} aria-describedby={formError ? "event-type-form-error" : undefined}>
              {show_service_provider_field && (
                <label className="mt-6 block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Service provider
                  </span>
                  <select
                    value={value.service_provider_id}
                    onChange={(e) => patch({ service_provider_id: e.target.value })}
                    disabled={service_providers_loading}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {service_providers_loading && !self_assign_option ? (
                      <option value="">Loading service providers…</option>
                    ) : null}
                    {self_assign_option ? (
                      <option value="">
                        {service_providers_loading
                          ? "Loading service providers…"
                          : self_assign_option.label}
                      </option>
                    ) : null}
                    {service_provider_options.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    {self_assign_option
                      ? `Optional. Leave as ${self_assign_option.label} to create under your account, or choose another provider.`
                      : "Select the service provider who will own this event type."}
                  </p>
                </label>
              )}

              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Event title</span>
                  <input
                    value={value.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    placeholder="e.g. 30-min Discovery Call"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Meeting type</span>
                  <LocationTypesMultiSelect
                    value={value.location_types}
                    onChange={(location_types) => patch({ location_types })}
                  />
                </label>
              </div>

              <div className="mt-6 space-y-5">
                {slug_field}
                {short_description_field}
                {department_and_service_fields}
              </div>

              <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/80 p-4 md:p-5">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Duration control</h3>
                    <p className="text-sm text-slate-500">
                      Set exact scheduling time in hours and minutes.
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                    Total duration:{" "}
                    <span className="text-slate-900">{format_duration_label(total_min)}</span>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Custom duration
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="et-duration-h">
                          Hours
                        </label>
                        <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <input
                            id="et-duration-h"
                            type="text"
                            inputMode="numeric"
                            value={value.duration_hours}
                            onChange={(e) => on_digit_field("duration_hours", e.target.value)}
                            onKeyDown={digit_key_filter}
                            className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                            placeholder="0"
                            aria-invalid={!!formError && total_min < 1}
                          />
                          <span className="text-sm text-slate-500">hr</span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="et-duration-m">
                          Minutes
                        </label>
                        <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                          <input
                            id="et-duration-m"
                            type="text"
                            inputMode="numeric"
                            value={value.duration_minutes_part}
                            onChange={(e) => on_digit_field("duration_minutes_part", e.target.value)}
                            onKeyDown={digit_key_filter}
                            className="w-full bg-transparent text-lg font-semibold text-slate-900 outline-none"
                            placeholder="0"
                            aria-invalid={!!formError && total_min < 1}
                          />
                          <span className="text-sm text-slate-500">min</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                      Tip: use quick presets or enter an exact duration.
                    </div>
                  </div>

                  <div className="rounded-3xl bg-white p-4 shadow-sm">
                    <p className="mb-3 text-sm font-medium text-slate-700">Quick minute presets</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {DURATION_PRESETS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => on_duration_preset(item)}
                          className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                            duration_preset_selected(
                              value.duration_hours,
                              value.duration_minutes_part,
                              item
                            )
                              ? "border-indigo-500 bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {item} min
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Public event</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {value.is_public
                          ? "This event is publicly visible on your booking page."
                          : "This event is private and hidden from public booking pages."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={value.is_public}
                      onClick={() => patch({ is_public: !value.is_public })}
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${
                        value.is_public ? "justify-end bg-indigo-600" : "justify-start bg-slate-200"
                      }`}
                    >
                      <span className="h-5 w-5 rounded-full bg-white shadow" />
                    </button>
                  </div>
                </div>
              </div>

              {formError && (
                <p id="event-type-form-error" className="mt-4 text-sm text-red-600" role="alert">
                  {formError}
                </p>
              )}

              {successMessage && (
                <p
                  className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
                  role="status"
                >
                  {successMessage}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(109,40,217,0.28)] hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? editingId
                      ? "Updating…"
                      : "Adding…"
                    : editingId
                      ? "Update event type"
                      : "Add event type"}
                </button>
              </div>
            </form>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Live preview</p>
                  <p className="mt-1 text-sm text-slate-500">How this event will look to clients</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    value.is_public ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {value.is_public ? "Public" : "Private"}
                </span>
              </div>

              <div className="mt-5 rounded-[26px] bg-slate-900 p-5 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Event card</p>
                <h3 className="mt-3 text-2xl font-semibold break-words">
                  {value.title.trim() || "Your event title"}
                </h3>
                {value.short_description.trim() ? (
                  <p className="mt-2 text-sm text-slate-400">{value.short_description.trim()}</p>
                ) : null}
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-4 py-3">
                    <span>Duration</span>
                    <span className="shrink-0 font-medium text-white">{format_duration_label(total_min)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-4 py-3">
                    <span>Location</span>
                    <span className="shrink-0 font-medium text-white text-right">
                      {format_event_type_location_labels(value.location_types)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="mt-5 w-full cursor-default rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900"
                  tabIndex={-1}
                >
                  Book this event
                </button>
              </div>
            </div>
          </aside>
      </div>

      {add_service_panel ? (
        <>
          <button
            type="button"
            aria-label="Close add service panel"
            onClick={() => set_service_panel_open(false)}
            className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ease-in-out ${
              service_panel_entered ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add service"
            className={`fixed top-0 right-0 bottom-0 z-50 flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-in-out will-change-transform md:w-[32rem] ${
              service_panel_entered ? "translate-x-0" : "translate-x-full"
            }`}
          >
            {add_service_panel}
          </div>
        </>
      ) : null}
    </div>
  );
}

export { split_duration_minutes, total_duration_minutes };
