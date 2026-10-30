"use client";

import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { LuChevronDown } from "react-icons/lu";
import { DateTimePicker } from "@/src/components/molecules/DateTimePicker";
import {
  datetime_local_from_date_and_time,
  format_iso_date_label,
  format_iso_date_long,
  now_datetime_local,
  parse_datetime_local_input,
} from "@/src/features/event-types/event_type_availability";
import {
  EVENT_TYPE_RECURRENCE_FREQUENCY_OPTIONS,
  EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS,
} from "@/src/features/event-types/event_type_recurrence";
import type {
  event_type_recurrence_end_type,
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
} from "@/src/types/event_types";

export type recurrence_series_schedule_field_error_key =
  | "recurrence_days"
  | "recurrence_start_date"
  | "recurrence_start_time"
  | "recurrence_end_date"
  | "recurrence_end_after_sessions";

export type recurrence_series_schedule_recurrence = {
  days_of_week: event_type_recurrence_weekday[];
  start_date: string;
  start_time: string;
  end_type: event_type_recurrence_end_type;
  end_date: string;
  end_after_sessions: string;
};

type EventTypeRecurrenceSeriesScheduleProps = {
  frequency: event_type_recurrence_frequency;
  on_frequency_change: (next: event_type_recurrence_frequency) => void;
  frequency_label: string;
  end_radio_name: string;
  recurrence: recurrence_series_schedule_recurrence;
  on_recurrence_patch: (changes: Partial<recurrence_series_schedule_recurrence>) => void;
  panel_select_class: (has_error?: boolean) => string;
  field_errors: Partial<Record<recurrence_series_schedule_field_error_key, string>>;
  clear_field_error: (key: recurrence_series_schedule_field_error_key) => void;
  field_error_message: (
    key: recurrence_series_schedule_field_error_key,
    id: string
  ) => ReactNode;
  custom_availability: boolean;
  custom_availability_start_date: string | null;
  custom_availability_end_date: string | null;
  ends_on_date: string | null;
  max_fitting_sessions: number | null;
  series_ready: boolean;
  digit_key_filter: (e: ReactKeyboardEvent<HTMLInputElement>) => void;
  show_heading?: boolean;
};

export function EventTypeRecurrenceSeriesSchedule({
  frequency,
  on_frequency_change,
  frequency_label,
  end_radio_name,
  recurrence,
  on_recurrence_patch,
  panel_select_class,
  field_errors,
  clear_field_error,
  field_error_message,
  custom_availability,
  custom_availability_start_date,
  custom_availability_end_date,
  ends_on_date,
  max_fitting_sessions,
  series_ready,
  digit_key_filter,
  show_heading = true,
}: EventTypeRecurrenceSeriesScheduleProps) {
  const requested_sessions = parseInt(recurrence.end_after_sessions, 10);
  const sessions_overflow =
    custom_availability &&
    recurrence.end_type === "after" &&
    Number.isFinite(requested_sessions) &&
    requested_sessions >= 1 &&
    max_fitting_sessions != null &&
    requested_sessions > max_fitting_sessions;
  const sessions_unavailable =
    series_ready &&
    recurrence.end_type === "after" &&
    Number.isFinite(requested_sessions) &&
    requested_sessions >= 1 &&
    !sessions_overflow &&
    !ends_on_date;
  const sessions_error_id = "event-type-recurrence-sessions-error";
  const ends_on_label = ends_on_date ? format_iso_date_long(ends_on_date) : "";
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
      {show_heading ? (
        <h5 className="text-sm font-bold text-slate-900">Series schedule</h5>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-slate-700">
          {frequency_label}
          <span className="text-red-500">*</span>
        </span>
        <div className="relative">
          <select
            value={frequency}
            onChange={(e) =>
              on_frequency_change(e.target.value as event_type_recurrence_frequency)
            }
            className={panel_select_class()}
          >
            {EVENT_TYPE_RECURRENCE_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
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

      {frequency === "daily" ? (
        <label className="block max-w-xs">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Time<span className="text-red-500">*</span>
          </span>
          <DateTimePicker
            date={false}
            time
            value={recurrence.start_time}
            onChange={(next_time) => {
              if (next_time.trim()) {
                clear_field_error("recurrence_start_time");
              }
              on_recurrence_patch({ start_time: next_time });
            }}
            invalid={!!field_errors.recurrence_start_time}
            error_id="event-type-recurrence-start-time-error"
            focus_key="recurrence_start_time"
          />
          {field_error_message(
            "recurrence_start_time",
            "event-type-recurrence-start-time-error"
          )}
        </label>
      ) : null}

      {frequency === "weekly" ? (
        <>
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Day<span className="text-red-500">*</span>
            </span>
            <div
              tabIndex={-1}
              role="radiogroup"
              aria-label="Day of week"
              data-event-type-field="recurrence_days"
              className={`flex flex-wrap gap-2 rounded-xl p-1 outline-none ${
                field_errors.recurrence_days ? "ring-1 ring-red-400" : ""
              }`}
            >
              {EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS.map((day) => {
                const selected = recurrence.days_of_week[0] === day.value;
                return (
                  <button
                    key={day.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      if (selected) return;
                      clear_field_error("recurrence_days");
                      on_recurrence_patch({ days_of_week: [day.value] });
                    }}
                    className={`min-w-[3rem] rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      selected
                        ? "border-violet-600 bg-violet-600 text-white"
                        : field_errors.recurrence_days
                          ? "border-red-400 bg-white text-slate-800 hover:bg-slate-50"
                          : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
            {field_error_message("recurrence_days", "event-type-recurrence-days-error")}
          </div>
          <label className="block max-w-xs">
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Time<span className="text-red-500">*</span>
            </span>
            <DateTimePicker
              date={false}
              time
              value={recurrence.start_time}
              onChange={(next_time) => {
                if (next_time.trim()) {
                  clear_field_error("recurrence_start_time");
                }
                on_recurrence_patch({ start_time: next_time });
              }}
              invalid={!!field_errors.recurrence_start_time}
              error_id="event-type-recurrence-start-time-error"
              focus_key="recurrence_start_time"
            />
            {field_error_message(
              "recurrence_start_time",
              "event-type-recurrence-start-time-error"
            )}
          </label>
        </>
      ) : null}

      {frequency === "monthly" ? (
        <label className="block max-w-xs">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Date & time<span className="text-red-500">*</span>
          </span>
          <DateTimePicker
            value={datetime_local_from_date_and_time(
              recurrence.start_date,
              recurrence.start_time
            )}
            min={now_datetime_local()}
            onChange={(next_datetime) => {
              const parsed = parse_datetime_local_input(next_datetime);
              if (!parsed) {
                on_recurrence_patch({ start_date: "", start_time: "" });
                return;
              }
              if (parsed.trim()) {
                clear_field_error("recurrence_start_date");
                clear_field_error("recurrence_start_time");
              }
              on_recurrence_patch({
                start_date: parsed.slice(0, 10),
                start_time: parsed.slice(11, 16),
              });
            }}
            invalid={
              !!field_errors.recurrence_start_date ||
              !!field_errors.recurrence_start_time
            }
            error_id="event-type-recurrence-start-error"
            focus_key="recurrence_start_date"
          />
          {field_error_message(
            "recurrence_start_date",
            "event-type-recurrence-start-error"
          )}
          {field_error_message(
            "recurrence_start_time",
            "event-type-recurrence-start-time-error"
          )}
        </label>
      ) : null}

      {frequency !== "monthly" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Start date<span className="text-red-500">*</span>
          </span>
          <DateTimePicker
            date
            time={false}
            value={recurrence.start_date}
            readOnly={custom_availability}
            onChange={(next_start) => {
              if (custom_availability) return;
              if (next_start.trim()) {
                clear_field_error("recurrence_start_date");
              }
              on_recurrence_patch({ start_date: next_start });
            }}
            invalid={!!field_errors.recurrence_start_date}
            error_id="event-type-recurrence-start-error"
            described_by={
              custom_availability ? "event-type-recurrence-start-hint" : undefined
            }
            focus_key="recurrence_start_date"
          />
          {custom_availability ? (
            <p
              id="event-type-recurrence-start-hint"
              className="mt-1.5 text-xs text-slate-500"
            >
              Uses the Custom Availability start date:{" "}
              <span className="font-medium text-slate-700">
                {format_iso_date_label(custom_availability_start_date ?? "")}
              </span>
            </p>
          ) : null}
          {field_error_message(
            "recurrence_start_date",
            "event-type-recurrence-start-error"
          )}
        </label>
      ) : null}

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">End</span>
        <div className="space-y-3" role="radiogroup" aria-label="Recurrence end">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name={end_radio_name}
              className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-500"
              checked={recurrence.end_type === "never"}
              onChange={() => on_recurrence_patch({ end_type: "never" })}
            />
            <span className="text-sm font-medium text-slate-800">Never</span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name={end_radio_name}
                className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-500"
                checked={recurrence.end_type === "on_date"}
                onChange={() => on_recurrence_patch({ end_type: "on_date" })}
              />
              <span className="text-sm font-medium text-slate-800">On date</span>
            </label>
            <div className="min-w-[12rem] flex-1">
              <DateTimePicker
                date
                time={false}
                value={recurrence.end_date}
                min={recurrence.start_date || undefined}
                max={
                  custom_availability
                    ? custom_availability_end_date ?? undefined
                    : undefined
                }
                disabled={recurrence.end_type !== "on_date"}
                onChange={(next_end) => {
                  if (next_end.trim()) {
                    clear_field_error("recurrence_end_date");
                  }
                  on_recurrence_patch({
                    end_type: "on_date",
                    end_date: next_end,
                  });
                }}
                invalid={!!field_errors.recurrence_end_date}
                error_id="event-type-recurrence-end-date-error"
                described_by={
                  custom_availability
                    ? "event-type-recurrence-end-date-hint"
                    : undefined
                }
                focus_key="recurrence_end_date"
              />
            </div>
            {field_errors.recurrence_end_date ? (
              <p
                id="event-type-recurrence-end-date-error"
                className="basis-full text-sm text-red-600"
                role="alert"
              >
                {field_errors.recurrence_end_date}
              </p>
            ) : null}
            {custom_availability ? (
              <p
                id="event-type-recurrence-end-date-hint"
                className="basis-full text-xs text-slate-500"
              >
                Must be on or before the Custom Availability end date:{" "}
                <span className="font-medium text-slate-700">
                  {format_iso_date_label(custom_availability_end_date ?? "")}
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-3">
              <input
                type="radio"
                name={end_radio_name}
                className="h-4 w-4 border-slate-300 text-violet-600 focus:ring-violet-500"
                checked={recurrence.end_type === "after"}
                onChange={() => on_recurrence_patch({ end_type: "after" })}
              />
              <span className="text-sm font-medium text-slate-800">After</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={recurrence.end_after_sessions}
              disabled={recurrence.end_type !== "after"}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw !== "" && !/^\d+$/.test(raw)) return;
                const sessions = parseInt(raw, 10);
                if (
                  raw !== "" &&
                  Number.isFinite(sessions) &&
                  sessions >= 1 &&
                  !(
                    custom_availability &&
                    max_fitting_sessions != null &&
                    sessions > max_fitting_sessions
                  )
                ) {
                  clear_field_error("recurrence_end_after_sessions");
                }
                on_recurrence_patch({ end_type: "after", end_after_sessions: raw });
              }}
              onKeyDown={digit_key_filter}
              aria-invalid={
                !!field_errors.recurrence_end_after_sessions ||
                sessions_overflow ||
                sessions_unavailable
              }
              aria-describedby={
                field_errors.recurrence_end_after_sessions ||
                sessions_overflow ||
                sessions_unavailable
                  ? sessions_error_id
                  : ends_on_label && recurrence.end_type === "after"
                    ? "event-type-recurrence-ends-on"
                    : undefined
              }
              className={`w-16 rounded-xl border bg-slate-50 px-3 py-2.5 text-center text-sm text-slate-900 outline-none transition focus:bg-white disabled:cursor-not-allowed disabled:opacity-60 ${
                field_errors.recurrence_end_after_sessions ||
                sessions_overflow ||
                sessions_unavailable
                  ? "border-red-400 focus:border-red-400"
                  : "border-slate-200 focus:border-violet-400"
              }`}
              data-event-type-field="recurrence_end_after_sessions"
            />
            <span className="text-sm text-slate-600">sessions</span>
            {recurrence.end_type === "after" && ends_on_label ? (
              <span
                id="event-type-recurrence-ends-on"
                className="text-sm text-slate-600"
              >
                Ends on{" "}
                <span className="font-semibold text-slate-800">{ends_on_label}</span>
              </span>
            ) : null}
            {sessions_overflow && max_fitting_sessions != null ? (
              <p
                id={sessions_error_id}
                className="basis-full text-sm text-red-600"
                role="alert"
              >
                {max_fitting_sessions < 1 ? (
                  <>
                    The selected Custom Availability period cannot accommodate any
                    sessions for this recurrence. Please extend the Custom
                    Availability end date or choose a time the provider is
                    available.
                  </>
                ) : (
                  <>
                    The selected Custom Availability period can accommodate a maximum
                    of{" "}
                    <strong>
                      {max_fitting_sessions}{" "}
                      {max_fitting_sessions === 1 ? "session" : "sessions"}
                    </strong>
                    . Please reduce the number of sessions or extend the Custom
                    Availability end date.
                  </>
                )}
              </p>
            ) : sessions_unavailable ? (
              <p
                id={sessions_error_id}
                className="basis-full text-sm text-red-600"
                role="alert"
              >
                No available dates were found for this recurrence. Check the
                provider&apos;s working hours and date exceptions.
              </p>
            ) : field_errors.recurrence_end_after_sessions ? (
              <p
                id={sessions_error_id}
                className="basis-full text-sm text-red-600"
                role="alert"
              >
                {field_errors.recurrence_end_after_sessions}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
