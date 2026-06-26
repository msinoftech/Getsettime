"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LuCheck, LuChevronDown } from "react-icons/lu";
import {
  EVENT_TYPE_LOCATION_OPTIONS,
  format_event_type_location_labels,
  label_for_event_type_location,
  parse_event_type_location_types,
  serialize_event_type_location_types,
  type event_type_location_value,
} from "@/src/types/event_type_location";

export {
  EVENT_TYPE_LOCATION_OPTIONS,
  type event_type_location_value,
  parse_event_type_location_types as parse_location_types_from_storage,
  serialize_event_type_location_types as serialize_location_types,
  format_event_type_location_labels,
};

export type event_type_form_state = {
  title: string;
  duration_hours: string;
  duration_minutes_part: string;
  buffer_before: string;
  buffer_after: string;
  location_types: event_type_location_value[];
  is_public: boolean;
  /** Empty string = assign to the logged-in user (admin/manager only). */
  service_provider_id: string;
};

export type event_type_service_provider_option = {
  id: string;
  label: string;
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
}: {
  value: event_type_location_value[];
  onChange: (next: event_type_location_value[]) => void;
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
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm outline-none transition focus:border-violet-400 focus:bg-white"
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
                        ? "border-violet-600 bg-violet-600 text-white"
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

type EventTypeFormLayoutProps = {
  value: event_type_form_state;
  onChange: (next: event_type_form_state) => void;
  editingId: number | null;
  formError: string | null;
  successMessage?: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  show_service_provider_field?: boolean;
  service_provider_options?: event_type_service_provider_option[];
  service_providers_loading?: boolean;
  /** Empty-value option for admins/managers who are not service providers. */
  self_assign_option?: { label: string } | null;
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
}: EventTypeFormLayoutProps) {
  const patch = useCallback(
    (partial: Partial<event_type_form_state>) => {
      onChange({ ...value, ...partial });
    },
    [onChange, value]
  );

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

  const digit_key_filter = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  return (
    <div className="rounded-2xl bg-slate-50 p-4 md:p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600">
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
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
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

                    <div className="mt-4 rounded-2xl border border-dashed border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
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
                              ? "border-violet-500 bg-violet-600 text-white shadow-lg shadow-violet-200"
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
                        value.is_public ? "justify-end bg-violet-600" : "justify-start bg-slate-200"
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
                  className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(109,40,217,0.28)] hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}

export { split_duration_minutes, total_duration_minutes };
