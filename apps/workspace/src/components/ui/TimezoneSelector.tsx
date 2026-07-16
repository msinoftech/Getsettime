"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuChevronDown as ChevronDown, LuGlobe as Globe } from "react-icons/lu";
import { formatTimezoneSelectLabel } from "@/src/utils/timezone";

export type timezone_option = {
  value: string;
  label: string;
};

export type TimezoneSelectorProps = {
  timezone: string;
  options: readonly string[] | readonly timezone_option[];
  onSave?: (timezone: string) => Promise<void> | void;
  onCancel?: () => void;
  /**
   * Selection-only mode: fires immediately when an option is picked and
   * Save/Cancel buttons are never shown. Takes precedence over `onSave`.
   */
  onChange?: (timezone: string) => void;
  disabled?: boolean;
  saving?: boolean;
  readOnly?: boolean;
  formatLabel?: (timezone: string) => string;
  variant?: "pill" | "header" | "inline";
  className?: string;
  menuAlign?: "left" | "right";
  /**
   * Vertical menu placement. `"auto"` (default) flips above/below based on
   * available viewport space around the trigger.
   */
  menuPlacement?: "auto" | "top" | "bottom";
  /** Where Save/Cancel appear relative to the timezone control. */
  actionsAlign?: "left" | "right";
};

function normalize_options(
  options: readonly string[] | readonly timezone_option[],
  format_label: (timezone: string) => string,
): timezone_option[] {
  if (options.length === 0) return [];
  const first = options[0];
  if (typeof first === "string") {
    return (options as readonly string[]).map((value) => ({
      value,
      label: format_label(value),
    }));
  }
  return (options as readonly timezone_option[]).map((option) => ({
    value: option.value,
    label: option.label ?? format_label(option.value),
  }));
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 shrink-0 animate-spin text-indigo-600"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth={4}
      />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export function TimezoneSelector({
  timezone,
  options,
  onSave,
  onCancel,
  onChange,
  disabled = false,
  saving = false,
  readOnly = false,
  formatLabel,
  variant = "pill",
  className = "",
  menuAlign = "right",
  menuPlacement = "auto",
  actionsAlign = "right",
}: TimezoneSelectorProps) {
  const root_ref = useRef<HTMLDivElement>(null);
  const [open, set_open] = useState(false);
  const [draft, set_draft] = useState(timezone);
  const [internal_saving, set_internal_saving] = useState(false);
  const [resolved_placement, set_resolved_placement] = useState<"top" | "bottom">(
    menuPlacement === "top" ? "top" : "bottom",
  );

  const format_label = useMemo(
    () => formatLabel ?? formatTimezoneSelectLabel,
    [formatLabel],
  );

  const normalized_options = useMemo(
    () => normalize_options(options, format_label),
    [options, format_label],
  );

  const is_saving = saving || internal_saving;
  const select_only = Boolean(onChange);
  const is_dirty = !select_only && draft !== timezone;
  const is_interactive = !readOnly && (select_only || Boolean(onSave));
  const display_label = format_label(draft);

  const MENU_MAX_HEIGHT_PX = 288; // max-h-72
  const MENU_GAP_PX = 8;

  const resolve_placement = useCallback((): "top" | "bottom" => {
    if (menuPlacement === "top" || menuPlacement === "bottom") {
      return menuPlacement;
    }
    const rect = root_ref.current?.getBoundingClientRect();
    if (!rect) return "bottom";

    const space_below = window.innerHeight - rect.bottom - MENU_GAP_PX;
    const space_above = rect.top - MENU_GAP_PX;

    if (space_below >= MENU_MAX_HEIGHT_PX) return "bottom";
    if (space_above >= MENU_MAX_HEIGHT_PX) return "top";
    return space_above > space_below ? "top" : "bottom";
  }, [menuPlacement]);

  const toggle_open = useCallback(() => {
    if (!is_interactive) return;
    set_open((was_open) => {
      if (was_open) return false;
      set_resolved_placement(resolve_placement());
      return true;
    });
  }, [is_interactive, resolve_placement]);

  useEffect(() => {
    set_draft(timezone);
  }, [timezone]);

  useEffect(() => {
    if (!open) return;
    const on_pointer_down = (event: MouseEvent) => {
      if (!root_ref.current?.contains(event.target as Node)) {
        set_open(false);
      }
    };
    const on_resize = () => set_resolved_placement(resolve_placement());
    document.addEventListener("mousedown", on_pointer_down);
    window.addEventListener("resize", on_resize);
    return () => {
      document.removeEventListener("mousedown", on_pointer_down);
      window.removeEventListener("resize", on_resize);
    };
  }, [open, resolve_placement]);

  const handle_select = useCallback(
    (value: string) => {
      set_draft(value);
      if (onChange) {
        onChange(value);
        set_open(false);
      }
    },
    [onChange],
  );

  const handle_cancel = useCallback(() => {
    set_draft(timezone);
    onCancel?.();
    set_open(false);
  }, [onCancel, timezone]);

  const handle_save = useCallback(async () => {
    if (!onSave || !is_dirty || is_saving) return;
    set_internal_saving(true);
    try {
      await onSave(draft);
      set_open(false);
    } finally {
      set_internal_saving(false);
    }
  }, [draft, is_dirty, is_saving, onSave]);

  const action_buttons = is_dirty && is_interactive ? (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => void handle_save()}
        disabled={is_saving || disabled}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {is_saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={handle_cancel}
        disabled={is_saving || disabled}
        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Cancel
      </button>
    </div>
  ) : null;

  const menu = open && is_interactive ? (
    <div
      role="listbox"
      className={`absolute ${menuAlign === "right" ? "right-0" : "left-0"} z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ${
        resolved_placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
      }`}
    >
      {normalized_options.map((option) => {
        const selected = option.value === draft;
        return (
          <button
            key={option.value || "empty"}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => handle_select(option.value)}
            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
              selected
                ? "bg-indigo-50 font-semibold text-indigo-700"
                : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="truncate">{option.label}</span>
            {selected ? (
              <svg
                className="h-4 w-4 shrink-0 text-indigo-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  ) : null;

  const trigger =
    variant === "header" ? (
      <div ref={root_ref} className="relative shrink-0">
        <button
          type="button"
          onClick={toggle_open}
          disabled={disabled || is_saving || !is_interactive}
          aria-haspopup={is_interactive ? "listbox" : undefined}
          aria-expanded={open}
          className="inline-flex items-center gap-3 rounded-lg px-1 py-1 text-left transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Globe className="h-5 w-5 shrink-0 text-slate-600" />
          <span className="min-w-0">
            <span className="block text-xs text-slate-500">Timezone</span>
            <span className="block truncate text-sm font-medium text-slate-800">
              {display_label}
            </span>
          </span>
          {is_interactive ? (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          ) : null}
        </button>
        {menu}
      </div>
    ) : variant === "inline" ? (
      <div ref={root_ref} className="relative">
        <button
          type="button"
          onClick={toggle_open}
          disabled={disabled || is_saving || !is_interactive}
          aria-haspopup={is_interactive ? "listbox" : undefined}
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <span className="text-slate-500">Time Zone:</span>
          <span className="max-w-[180px] truncate">{display_label}</span>
          {is_interactive ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          ) : null}
        </button>
        {menu}
      </div>
    ) : (
      <div ref={root_ref} className="relative">
        <button
          type="button"
          onClick={toggle_open}
          disabled={disabled || is_saving || !is_interactive}
          aria-haspopup={is_interactive ? "listbox" : undefined}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Globe className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate">Timezone: {display_label}</span>
          {is_saving ? (
            <>
              <Spinner />
              <span className="text-xs font-semibold text-indigo-600">Updating…</span>
            </>
          ) : is_interactive ? (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          ) : null}
        </button>
        {menu}
      </div>
    );

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {actionsAlign === "left" ? action_buttons : null}
      {trigger}
      {actionsAlign === "right" ? action_buttons : null}
    </div>
  );
}
