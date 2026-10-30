"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCalendar,
  LuChevronLeft,
  LuChevronRight,
  LuClock,
  LuX,
} from "react-icons/lu";
import {
  datetime_local_from_date,
  format_datetime_local_display,
  format_iso_date_display,
  format_time_display,
  iso_date_from_date,
  now_datetime_local,
  parse_datetime_local_input,
  parse_iso_date_input,
  parse_time_input,
  time_from_parts,
} from "@/src/features/event-types/event_type_availability";
import {
  picker_overlay_class,
  use_picker_overlay_placement,
} from "@/src/features/event-types/event_type_picker_placement";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const TIME_ITEM_HEIGHT = 28;
const TIME_LIST_HEIGHT = 112;
const TIME_LIST_SPACER = (TIME_LIST_HEIGHT - TIME_ITEM_HEIGHT) / 2;

export type date_time_picker_props = {
  /** Show the calendar step. Defaults to `true`. */
  date?: boolean;
  /** Show the time step. Defaults to `true`. */
  time?: boolean;
  value: string;
  onChange: (next: string) => void;
  min?: string;
  max?: string;
  invalid?: boolean;
  error_id?: string;
  described_by?: string;
  focus_key?: string;
  id?: string;
  disabled?: boolean;
  readOnly?: boolean;
  /** When set, clicking the trigger calls this instead of opening the built-in picker. */
  onTriggerClick?: () => void;
};

type picker_parts = {
  year: number;
  month: number;
  day: number;
  hour_12: number;
  minute: number;
  period: "AM" | "PM";
};

type picker_step = "date" | "time";

function resolve_modes(
  date_prop: boolean | undefined,
  time_prop: boolean | undefined
): { show_date: boolean; show_time: boolean } {
  const show_date = date_prop !== false;
  const show_time = time_prop !== false;
  if (!show_date && !show_time) {
    return { show_date: true, show_time: true };
  }
  return { show_date, show_time };
}

function hour_24_from_parts(hour_12: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour_12 === 12 ? 0 : hour_12;
  return hour_12 === 12 ? 12 : hour_12 + 12;
}

function parts_from_now(): picker_parts {
  const date = new Date();
  const hour_24 = date.getHours();
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour_12: hour_24 % 12 === 0 ? 12 : hour_24 % 12,
    minute: date.getMinutes(),
    period: hour_24 >= 12 ? "PM" : "AM",
  };
}

function parts_from_datetime_local(value: string): picker_parts {
  const parsed = parse_datetime_local_input(value);
  if (!parsed) return parts_from_now();
  const date = new Date(parsed);
  const hour_24 = date.getHours();
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hour_12: hour_24 % 12 === 0 ? 12 : hour_24 % 12,
    minute: date.getMinutes(),
    period: hour_24 >= 12 ? "PM" : "AM",
  };
}

function parts_from_iso_date(value: string): picker_parts {
  const parsed = parse_iso_date_input(value);
  const base = parts_from_now();
  if (!parsed) return base;
  const date = new Date(`${parsed}T00:00`);
  return {
    ...base,
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

function parts_from_time(value: string): picker_parts {
  const base = parts_from_now();
  const parsed = parse_time_input(value);
  if (!parsed) return base;
  const [hour_raw, minute_raw] = parsed.split(":");
  const hour_24 = parseInt(hour_raw, 10);
  const minute = parseInt(minute_raw, 10);
  return {
    ...base,
    hour_12: hour_24 % 12 === 0 ? 12 : hour_24 % 12,
    minute,
    period: hour_24 >= 12 ? "PM" : "AM",
  };
}

function parts_from_value(
  value: string,
  show_date: boolean,
  show_time: boolean
): picker_parts {
  if (show_date && show_time) return parts_from_datetime_local(value);
  if (show_date) return parts_from_iso_date(value);
  return parts_from_time(value);
}

function parts_to_ms(parts: picker_parts): number {
  return new Date(
    parts.year,
    parts.month,
    parts.day,
    hour_24_from_parts(parts.hour_12, parts.period),
    parts.minute,
    0,
    0
  ).getTime();
}

function start_of_day_ms(year: number, month: number, day: number): number {
  return new Date(year, month, day).getTime();
}

function is_same_calendar_day(parts: picker_parts, min: Date): boolean {
  return (
    parts.year === min.getFullYear() &&
    parts.month === min.getMonth() &&
    parts.day === min.getDate()
  );
}

function datetime_local_from_parts(parts: picker_parts): string {
  return datetime_local_from_date(
    new Date(
      parts.year,
      parts.month,
      parts.day,
      hour_24_from_parts(parts.hour_12, parts.period),
      parts.minute,
      0,
      0
    )
  );
}

function iso_date_from_parts(parts: picker_parts): string {
  return iso_date_from_date(new Date(parts.year, parts.month, parts.day));
}

function clamp_parts_to_min(parts: picker_parts, min: Date | null): picker_parts {
  if (!min || parts_to_ms(parts) >= min.getTime()) return parts;
  const clamped = parts_from_datetime_local(datetime_local_from_date(min));
  return {
    ...clamped,
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function is_before_min(parts: picker_parts, min: Date | null): boolean {
  return min != null && parts_to_ms(parts) < min.getTime();
}

function is_hour_before_min(
  hour_12: number,
  parts: picker_parts,
  min: Date | null
): boolean {
  if (!min || !is_same_calendar_day(parts, min)) return false;
  return is_before_min({ ...parts, hour_12, minute: 59 }, min);
}

function is_minute_before_min(
  minute: number,
  parts: picker_parts,
  min: Date | null
): boolean {
  if (!min || !is_same_calendar_day(parts, min)) return false;
  return is_before_min({ ...parts, minute }, min);
}

function is_period_before_min(
  period: "AM" | "PM",
  parts: picker_parts,
  min: Date | null
): boolean {
  if (!min || !is_same_calendar_day(parts, min)) return false;
  return is_before_min({ ...parts, period, hour_12: 11, minute: 59 }, min);
}

function start_of_month(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function calendar_cells(year: number, month: number): Date[] {
  const first = start_of_month(year, month);
  const start_weekday = first.getDay();
  const start = new Date(year, month, 1 - start_weekday);
  return Array.from({ length: 42 }, (_, i) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    return cell;
  });
}

function is_same_day(
  a: Date,
  b: { year: number; month: number; day: number }
): boolean {
  return (
    a.getFullYear() === b.year &&
    a.getMonth() === b.month &&
    a.getDate() === b.day
  );
}

function date_key(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function format_date_heading(parts: picker_parts): string {
  return `${String(parts.day).padStart(2, "0")} ${MONTH_LABELS[parts.month]} ${parts.year}`;
}

function scroll_selected_into_view(
  container: HTMLElement | null,
  item: HTMLElement | null
) {
  if (!container || !item) return;
  container.scrollTop = Math.max(0, item.offsetTop - TIME_LIST_SPACER);
}

function display_placeholder(show_date: boolean, show_time: boolean): string {
  if (show_date && show_time) return "dd-mm-yyyy hh:mm AM/PM";
  if (show_date) return "dd-mm-yyyy";
  return "hh:mm AM/PM";
}

function format_display_value(
  value: string,
  show_date: boolean,
  show_time: boolean
): string {
  if (show_date && show_time) return format_datetime_local_display(value);
  if (show_date) return format_iso_date_display(value);
  return format_time_display(value);
}

function parse_min_date(
  min: string | undefined,
  show_date: boolean,
  show_time: boolean
): Date | null {
  if (!min) return null;
  if (show_date && show_time) {
    const parsed = parse_datetime_local_input(min);
    return parsed ? new Date(parsed) : null;
  }
  if (show_date) {
    const parsed = parse_iso_date_input(min);
    return parsed ? new Date(`${parsed}T00:00`) : null;
  }
  return null;
}

function parse_max_iso(max: string | undefined): string | null {
  return parse_iso_date_input(max ?? "");
}

export function DateTimePicker({
  date: date_prop,
  time: time_prop,
  value,
  onChange,
  min,
  max,
  invalid = false,
  error_id,
  described_by,
  focus_key,
  id,
  disabled = false,
  readOnly = false,
  onTriggerClick,
}: date_time_picker_props) {
  const { show_date, show_time } = resolve_modes(date_prop, time_prop);
  const locked = disabled || readOnly;
  const external_trigger = Boolean(onTriggerClick);

  const root_ref = useRef<HTMLDivElement>(null);
  const hour_list_ref = useRef<HTMLDivElement>(null);
  const minute_list_ref = useRef<HTMLDivElement>(null);
  const hour_selected_ref = useRef<HTMLButtonElement>(null);
  const minute_selected_ref = useRef<HTMLButtonElement>(null);
  const dialog_ref = useRef<HTMLDivElement>(null);

  const [open, set_open] = useState(false);
  const [picker_step, set_picker_step] = useState<picker_step>(
    show_date ? "date" : "time"
  );
  const [draft, set_draft] = useState<picker_parts>(() =>
    parts_from_value(value, show_date, show_time)
  );
  const [view_month, set_view_month] = useState(() =>
    start_of_month(draft.year, draft.month)
  );

  const display_value = format_display_value(value, show_date, show_time);
  const min_date = parse_min_date(min, show_date, show_time);
  const min_iso =
    show_date && !show_time ? parse_iso_date_input(min ?? "") : null;
  const max_iso = show_date && !show_time ? parse_max_iso(max) : null;
  const min_parsed_datetime =
    show_date && show_time ? parse_datetime_local_input(min ?? "") : null;

  const cells = useMemo(
    () => calendar_cells(view_month.getFullYear(), view_month.getMonth()),
    [view_month]
  );

  useEffect(() => {
    if (!open) return;
    // Always open on the currently selected value when present (even if it is
    // before `min`). Past dates stay disabled for new picks; empty values fall
    // back to min/now as the draft seed.
    let initial: picker_parts;
    if (show_date && show_time) {
      const seed = value.trim()
        ? value
        : min_parsed_datetime || now_datetime_local();
      initial = parts_from_datetime_local(seed);
    } else if (show_date) {
      const seed = value.trim()
        ? value
        : min_iso || iso_date_from_date(new Date());
      initial = parts_from_iso_date(seed);
    } else {
      initial = parts_from_time(value);
    }

    set_draft(initial);
    set_view_month(start_of_month(initial.year, initial.month));
    set_picker_step(show_date ? "date" : "time");
    // Reset only when the picker opens so a live `min` cannot bounce
    // the user back to the calendar while they are choosing a time.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only init
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const on_pointer_down = (event: MouseEvent) => {
      if (root_ref.current?.contains(event.target as Node)) return;
      set_open(false);
    };
    const on_key_down = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (show_date && show_time && picker_step === "time") {
        set_picker_step("date");
        return;
      }
      set_open(false);
    };
    document.addEventListener("mousedown", on_pointer_down);
    document.addEventListener("keydown", on_key_down);
    return () => {
      document.removeEventListener("mousedown", on_pointer_down);
      document.removeEventListener("keydown", on_key_down);
    };
  }, [open, picker_step, show_date, show_time]);

  const open_above = use_picker_overlay_placement(
    open,
    root_ref,
    dialog_ref,
    show_date && show_time ? picker_step : undefined
  );

  useEffect(() => {
    if (!open || picker_step !== "time") return;
    const frame = window.requestAnimationFrame(() => {
      scroll_selected_into_view(
        hour_list_ref.current,
        hour_selected_ref.current
      );
      scroll_selected_into_view(
        minute_list_ref.current,
        minute_selected_ref.current
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, picker_step, draft.hour_12, draft.minute]);

  const commit_datetime = (next: picker_parts) => {
    const clamped = clamp_parts_to_min(next, min_date);
    if (is_before_min(clamped, min_date)) return;
    onChange(datetime_local_from_parts(clamped));
    set_open(false);
  };

  const commit_date = (next: picker_parts) => {
    onChange(iso_date_from_parts(next));
    set_open(false);
  };

  const commit_time = (next: picker_parts) => {
    onChange(time_from_parts(next.hour_12, next.minute, next.period));
    set_open(false);
  };

  const select_date = (cell: Date) => {
    const next: picker_parts = {
      ...draft,
      year: cell.getFullYear(),
      month: cell.getMonth(),
      day: cell.getDate(),
    };

    if (show_date && !show_time) {
      set_draft(next);
      commit_date(next);
      return;
    }

    set_draft(clamp_parts_to_min(next, min_date));
    set_picker_step("time");
  };

  const select_today = () => {
    if (show_date && !show_time) {
      let today = iso_date_from_date(new Date());
      if (min_iso && today < min_iso) today = min_iso;
      if (max_iso && today > max_iso) today = max_iso;
      const next = parts_from_iso_date(today);
      set_draft(next);
      set_view_month(start_of_month(next.year, next.month));
      commit_date(next);
      return;
    }

    const today_parts = parts_from_datetime_local(
      min_parsed_datetime && min_parsed_datetime > now_datetime_local()
        ? min_parsed_datetime
        : now_datetime_local()
    );
    set_draft(today_parts);
    set_view_month(start_of_month(today_parts.year, today_parts.month));
    if (show_time) {
      set_picker_step("time");
    }
  };

  const draft_before_min =
    show_date && show_time ? is_before_min(draft, min_date) : false;

  const prev_month_disabled =
    min_date != null &&
    new Date(view_month.getFullYear(), view_month.getMonth(), 1).getTime() <=
      new Date(min_date.getFullYear(), min_date.getMonth(), 1).getTime();

  const scroll_item_class = (selected: boolean, item_disabled = false) =>
    `relative z-20 flex h-7 w-full items-center justify-center rounded-md text-sm tabular-nums ${
      item_disabled
        ? "cursor-not-allowed text-slate-300"
        : selected
          ? "font-semibold text-violet-700"
          : "text-slate-500 hover:text-slate-800"
    }`;

  const close_picker = () => set_open(false);

  const described_by_value =
    [invalid && error_id ? error_id : null, described_by]
      .filter(Boolean)
      .join(" ") || undefined;

  const trigger_class = locked
    ? `cursor-not-allowed bg-slate-100 ${
        invalid ? "border-red-400" : "border-slate-200"
      } ${readOnly && !disabled ? "opacity-70" : ""} ${
        disabled ? "opacity-60" : ""
      }`
    : `bg-slate-50 focus:bg-white ${
        invalid
          ? "border-red-400 focus:border-red-400"
          : open
            ? "border-violet-400 bg-white"
            : "border-slate-200 focus:border-violet-400"
      }`;

  const show_calendar_panel = show_date && picker_step === "date";
  const show_time_panel =
    show_time && (picker_step === "time" || !show_date);

  return (
    <div ref={root_ref} className={`relative min-w-0 ${open ? "z-30" : ""}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup={locked ? undefined : "dialog"}
        aria-expanded={locked ? undefined : open}
        aria-invalid={invalid}
        aria-describedby={described_by_value}
        aria-readonly={readOnly || undefined}
        data-event-type-field={focus_key}
        onClick={() => {
          if (locked) return;
          if (onTriggerClick) {
            onTriggerClick();
            return;
          }
          set_open((prev) => !prev);
        }}
        className={`flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm outline-none transition ${trigger_class}`}
      >
        <span
          className={`min-w-0 truncate ${
            locked
              ? "text-slate-600"
              : display_value
                ? "text-slate-900"
                : "text-slate-400"
          }`}
        >
          {display_value || display_placeholder(show_date, show_time)}
        </span>
        {show_date ? (
          <LuCalendar className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        ) : (
          <LuClock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        )}
      </button>

      {open && !locked && !external_trigger ? (
        <div
          ref={dialog_ref}
          role="dialog"
          aria-label={
            show_calendar_panel
              ? "Choose date"
              : show_date
                ? "Choose time"
                : "Choose time"
          }
          className={picker_overlay_class(open_above)}
        >
          {show_calendar_panel ? (
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled={show_time ? prev_month_disabled : false}
                  onClick={() =>
                    set_view_month(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous month"
                >
                  <LuChevronLeft className="h-3.5 w-3.5" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-slate-800">
                  {MONTH_LABELS[view_month.getMonth()]}{" "}
                  {view_month.getFullYear()}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    set_view_month(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                  aria-label="Next month"
                >
                  <LuChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
                {show_time ? (
                  <button
                    type="button"
                    onClick={close_picker}
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label="Close"
                  >
                    <LuX className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <div className="mb-1 grid grid-cols-7 gap-0.5">
                {WEEKDAY_LABELS.map((day) => (
                  <div
                    key={day}
                    className="py-1 text-center text-[10px] font-semibold text-slate-400"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((cell) => {
                  const in_month = cell.getMonth() === view_month.getMonth();
                  const selected = is_same_day(cell, draft);
                  const today = is_same_day(cell, {
                    year: new Date().getFullYear(),
                    month: new Date().getMonth(),
                    day: new Date().getDate(),
                  });
                  const cell_ms = start_of_day_ms(
                    cell.getFullYear(),
                    cell.getMonth(),
                    cell.getDate()
                  );

                  let out_of_range = false;
                  if (show_date && !show_time) {
                    const min_ms = min_iso
                      ? start_of_day_ms(
                          Number(min_iso.slice(0, 4)),
                          Number(min_iso.slice(5, 7)) - 1,
                          Number(min_iso.slice(8, 10))
                        )
                      : null;
                    const max_ms = max_iso
                      ? start_of_day_ms(
                          Number(max_iso.slice(0, 4)),
                          Number(max_iso.slice(5, 7)) - 1,
                          Number(max_iso.slice(8, 10))
                        )
                      : null;
                    out_of_range =
                      (min_ms != null && cell_ms < min_ms) ||
                      (max_ms != null && cell_ms > max_ms);
                  } else if (min_date) {
                    const min_start = start_of_day_ms(
                      min_date.getFullYear(),
                      min_date.getMonth(),
                      min_date.getDate()
                    );
                    out_of_range = cell_ms < min_start;
                  }

                  return (
                    <button
                      key={date_key(cell)}
                      type="button"
                      disabled={out_of_range}
                      onClick={() => select_date(cell)}
                      className={`h-7 rounded-md text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        selected
                          ? "bg-violet-600 text-white"
                          : today
                            ? "bg-violet-50 font-semibold text-violet-700 hover:bg-violet-100"
                            : in_month
                              ? "text-slate-700 hover:bg-slate-100"
                              : "text-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {cell.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {show_time_panel ? (
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-slate-800">
                  {show_date ? format_date_heading(draft) : "Select time"}
                </p>
                <button
                  type="button"
                  onClick={close_picker}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <LuX className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <p className="mb-2 text-center text-base font-semibold tabular-nums text-slate-900">
                {String(draft.hour_12).padStart(2, "0")}:
                {String(draft.minute).padStart(2, "0")} {draft.period}
              </p>
              <div className="flex items-stretch justify-center gap-2">
                <div className="flex w-16 flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Hours
                  </span>
                  <div className="relative w-full">
                    <div
                      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-7 -translate-y-1/2 rounded-md bg-violet-100"
                      aria-hidden
                    />
                    <div
                      ref={hour_list_ref}
                      className="relative h-28 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      aria-label="Hours"
                    >
                      <div style={{ height: TIME_LIST_SPACER }} />
                      {HOURS_12.map((hour) => {
                        const hour_disabled =
                          show_date && show_time
                            ? is_hour_before_min(hour, draft, min_date)
                            : false;
                        return (
                          <button
                            key={hour}
                            ref={
                              draft.hour_12 === hour
                                ? hour_selected_ref
                                : undefined
                            }
                            type="button"
                            disabled={hour_disabled}
                            onClick={() =>
                              set_draft((prev) =>
                                show_date && show_time
                                  ? clamp_parts_to_min(
                                      { ...prev, hour_12: hour },
                                      min_date
                                    )
                                  : { ...prev, hour_12: hour }
                              )
                            }
                            className={scroll_item_class(
                              draft.hour_12 === hour,
                              hour_disabled
                            )}
                          >
                            {String(hour).padStart(2, "0")}
                          </button>
                        );
                      })}
                      <div style={{ height: TIME_LIST_SPACER }} />
                    </div>
                  </div>
                </div>
                <span className="mt-8 self-center text-lg font-semibold text-slate-300">
                  :
                </span>
                <div className="flex w-16 flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Minutes
                  </span>
                  <div className="relative w-full">
                    <div
                      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-7 -translate-y-1/2 rounded-md bg-violet-100"
                      aria-hidden
                    />
                    <div
                      ref={minute_list_ref}
                      className="relative h-28 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                      aria-label="Minutes"
                    >
                      <div style={{ height: TIME_LIST_SPACER }} />
                      {MINUTES.map((minute) => {
                        const minute_disabled =
                          show_date && show_time
                            ? is_minute_before_min(minute, draft, min_date)
                            : false;
                        return (
                          <button
                            key={minute}
                            ref={
                              draft.minute === minute
                                ? minute_selected_ref
                                : undefined
                            }
                            type="button"
                            disabled={minute_disabled}
                            onClick={() =>
                              set_draft((prev) =>
                                show_date && show_time
                                  ? clamp_parts_to_min(
                                      { ...prev, minute },
                                      min_date
                                    )
                                  : { ...prev, minute }
                              )
                            }
                            className={scroll_item_class(
                              draft.minute === minute,
                              minute_disabled
                            )}
                          >
                            {String(minute).padStart(2, "0")}
                          </button>
                        );
                      })}
                      <div style={{ height: TIME_LIST_SPACER }} />
                    </div>
                  </div>
                </div>
                <div className="flex w-12 flex-col items-center">
                  <span className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    AM/PM
                  </span>
                  <div
                    className="flex h-28 flex-col justify-center gap-1"
                    aria-label="AM or PM"
                  >
                    {(["AM", "PM"] as const).map((period) => {
                      const period_disabled =
                        show_date && show_time
                          ? is_period_before_min(period, draft, min_date)
                          : false;
                      return (
                        <button
                          key={period}
                          type="button"
                          disabled={period_disabled}
                          onClick={() =>
                            set_draft((prev) =>
                              show_date && show_time
                                ? clamp_parts_to_min(
                                    { ...prev, period },
                                    min_date
                                  )
                                : { ...prev, period }
                            )
                          }
                          className={`rounded-md px-2 py-1.5 text-xs font-semibold ${
                            period_disabled
                              ? "cursor-not-allowed text-slate-300"
                              : draft.period === period
                                ? "bg-violet-600 text-white"
                                : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {period}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <div className="flex items-center gap-3">
              {show_date && show_time && picker_step === "time" ? (
                <button
                  type="button"
                  onClick={() => set_picker_step("date")}
                  className="text-sm font-medium text-violet-700 hover:text-violet-800"
                >
                  Back
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  set_open(false);
                }}
                className="text-sm font-medium text-violet-700 hover:text-violet-800"
              >
                Clear
              </button>
              {show_date && picker_step === "date" ? (
                <button
                  type="button"
                  onClick={select_today}
                  className="text-sm font-medium text-violet-700 hover:text-violet-800"
                >
                  Today
                </button>
              ) : null}
            </div>
            {show_date && !show_time ? null : show_date &&
              show_time &&
              picker_step === "date" ? (
              <button
                type="button"
                onClick={close_picker}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            ) : (
              <button
                type="button"
                disabled={draft_before_min}
                onClick={() => {
                  if (show_date && show_time) {
                    commit_datetime(draft);
                    return;
                  }
                  commit_time(draft);
                }}
                className="shrink-0 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Select
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
