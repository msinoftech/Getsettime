"use client";

import { useCallback } from "react";

export type event_type_form_state = {
  title: string;
  duration_hours: string;
  duration_minutes_part: string;
  buffer_before: string;
  buffer_after: string;
  location_type: string;
  is_public: boolean;
};

const DURATION_PRESETS = [15, 30, 45, 60] as const;
const BUFFER_PRESETS = [0, 5, 10, 15] as const;

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

function buffer_preset_selected(
  before: string,
  after: string,
  chip: number
): boolean {
  const b = parse_non_negative_int(before);
  const a = parse_non_negative_int(after);
  return b === chip && a === chip;
}

function location_type_label(value: string): string {
  switch (value) {
    case "in_person":
      return "In person";
    case "phone":
      return "Phone";
    case "video":
      return "Video call";
    case "custom":
      return "Custom";
    default:
      return "Not set";
  }
}

function format_buffer_preview(before: string, after: string): string {
  const b = parse_non_negative_int(before);
  const a = parse_non_negative_int(after);
  if (b === 0 && a === 0) return "None";
  return `${b}m before · ${a}m after`;
}

type EventTypeFormLayoutProps = {
  value: event_type_form_state;
  onChange: (next: event_type_form_state) => void;
  editingId: number | null;
  formError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
};

export function EventTypeFormLayout({
  value,
  onChange,
  editingId,
  formError,
  submitting,
  onSubmit,
  onCancel,
}: EventTypeFormLayoutProps) {
  const patch = useCallback(
    (partial: Partial<event_type_form_state>) => {
      onChange({ ...value, ...partial });
    },
    [onChange, value]
  );

  const on_digit_field = useCallback(
    (
      field: "duration_hours" | "duration_minutes_part" | "buffer_before" | "buffer_after",
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

  const on_buffer_preset = useCallback(
    (chip: number) => {
      const s = chip === 0 ? "" : String(chip);
      patch({ buffer_before: s, buffer_after: s });
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
    <div className="bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-violet-600">
              Event types
            </p>
            <h1
              id="event-type-form-heading"
              className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl"
            >
              {editingId ? "Update event type" : "Create event type"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
              Set duration with hours and minutes, buffers, location, and visibility. Clients see public
              types on your booking page.
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
                  <span className="mb-2 block text-sm font-medium text-slate-700">Location type</span>
                  <select
                    value={value.location_type}
                    onChange={(e) => patch({ location_type: e.target.value })}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white"
                  >
                    <option value="">Select location type</option>
                    <option value="in_person">In person</option>
                    <option value="phone">Phone</option>
                    <option value="video">Video call</option>
                    <option value="custom">Custom</option>
                  </select>
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-3 text-sm font-medium text-slate-700">Quick minute presets</p>
                        <div className="grid grid-cols-2 gap-3">
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

                      <div>
                        <p className="mb-3 text-sm font-medium text-slate-700">Buffer before / after</p>
                        <div className="grid grid-cols-2 gap-3">
                          {BUFFER_PRESETS.map((item) => (
                            <button
                              key={item}
                              type="button"
                              onClick={() => on_buffer_preset(item)}
                              className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                                buffer_preset_selected(value.buffer_before, value.buffer_after, item)
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              }`}
                            >
                              {item === 0 ? "None" : `${item} min`}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Buffer before (minutes)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value.buffer_before}
                          onChange={(e) => on_digit_field("buffer_before", e.target.value)}
                          onKeyDown={digit_key_filter}
                          placeholder="e.g. 10"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Buffer after (minutes)</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={value.buffer_after}
                          onChange={(e) => on_digit_field("buffer_after", e.target.value)}
                          onKeyDown={digit_key_filter}
                          placeholder="e.g. 5"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:bg-white"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Public event</p>
                      <p className="mt-1 text-sm text-slate-500">Visible on your public booking page.</p>
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
                    <span>Buffer</span>
                    <span className="shrink-0 text-right font-medium text-white">
                      {format_buffer_preview(value.buffer_before, value.buffer_after)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-4 py-3">
                    <span>Location</span>
                    <span className="shrink-0 font-medium text-white">
                      {location_type_label(value.location_type)}
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
    </div>
  );
}

export { split_duration_minutes, total_duration_minutes };
