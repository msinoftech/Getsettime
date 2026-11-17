"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LuLeaf as Leaf,
  LuShield as Shield,
  LuStar as Star,
  LuX as X,
} from "react-icons/lu";
import { toast } from "@/src/components/ui/toast";
import { classNames } from "@/src/features/departments/DepartmentPanelPrimitives";
import {
  BOOKING_RULES_BUFFER_OPTIONS,
  BOOKING_RULES_CUSTOMER_PERIOD_OPTIONS,
  BOOKING_RULES_DEADLINE_OPTIONS,
  BOOKING_RULES_DURATION_OPTIONS,
  BOOKING_RULES_INTERVAL_OPTIONS,
  BOOKING_RULES_MAX_PER_CUSTOMER_OPTIONS,
  BOOKING_RULES_MAX_PER_DAY_OPTIONS,
  BOOKING_RULES_NOTICE_OPTIONS,
  BOOKING_RULES_PRESETS,
  BOOKING_RULES_WINDOW_OPTIONS,
} from "@/src/features/availability/booking_rules";
import type {
  booking_rules,
  booking_rules_edit_target,
  booking_rules_preset,
} from "@/src/types/booking_rules";

const panelFieldClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60";

type event_type_override_form = {
  duration_minutes: number;
  buffer_before: number;
  buffer_after: number;
  min_booking_notice_minutes: number;
};

export type EditBookingRulesPanelProps = {
  open: boolean;
  target: booking_rules_edit_target | null;
  rules: booking_rules;
  onClose: () => void;
  onSaveGlobal: (next: booking_rules) => Promise<void>;
  onSaveEventType: (
    eventTypeId: number,
    patch: event_type_override_form
  ) => Promise<void>;
};

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={classNames(
          "relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-indigo-600" : "bg-slate-300"
        )}
      >
        <span
          className={classNames(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: number | string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: number | string; label: string }>;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={panelFieldClass}
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

function panel_title(target: booking_rules_edit_target | null): string {
  if (!target) return "Edit Booking Rules";
  switch (target.kind) {
    case "global":
      return "Edit Global Booking Rules";
    case "slot_defaults":
      return "Edit Global Slot Defaults";
    case "advance_booking":
      return "Edit Advance Booking";
    case "limits":
      return "Edit Limits & Capacity";
    case "customer_actions":
      return "Edit Customer Actions";
    case "event_type":
      return `Edit Override · ${target.title}`;
    default:
      return "Edit Booking Rules";
  }
}

export function EditBookingRulesPanel({
  open,
  target,
  rules,
  onClose,
  onSaveGlobal,
  onSaveEventType,
}: EditBookingRulesPanelProps) {
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [draft, setDraft] = useState<booking_rules>(rules);
  const [eventDraft, setEventDraft] = useState<event_type_override_form>({
    duration_minutes: 30,
    buffer_before: 0,
    buffer_after: 0,
    min_booking_notice_minutes: 120,
  });
  const [busy, setBusy] = useState(false);

  const panelVisible = open && target !== null;
  const isEventType = target?.kind === "event_type";

  useEffect(() => {
    if (!open || !target) {
      setPanelAnimatedOpen(false);
      return;
    }
    const id = window.requestAnimationFrame(() => setPanelAnimatedOpen(true));
    return () => window.cancelAnimationFrame(id);
  }, [open, target]);

  useEffect(() => {
    if (!open || !target) return;
    setDraft(rules);
    if (target.kind === "event_type") {
      setEventDraft({
        duration_minutes: target.duration_minutes ?? 30,
        buffer_before: target.buffer_before ?? 0,
        buffer_after: target.buffer_after ?? 0,
        min_booking_notice_minutes: target.min_booking_notice_minutes,
      });
    }
  }, [open, target, rules]);

  const patchDraft = useCallback((partial: Partial<booking_rules>) => {
    setDraft((prev) => ({ ...prev, ...partial, preset: null }));
  }, []);

  const applyPreset = useCallback((preset: booking_rules_preset) => {
    const next = BOOKING_RULES_PRESETS[preset];
    setDraft({
      default_duration_minutes: next.default_duration_minutes ?? 30,
      slot_interval_minutes: next.slot_interval_minutes ?? 15,
      buffer_before_minutes: next.buffer_before_minutes ?? 0,
      buffer_after_minutes: next.buffer_after_minutes ?? 0,
      min_notice_minutes: next.min_notice_minutes ?? 240,
      booking_window_days: next.booking_window_days ?? 60,
      prevent_same_day_bookings: next.prevent_same_day_bookings ?? false,
      max_bookings_per_day: next.max_bookings_per_day ?? 12,
      max_bookings_per_customer: next.max_bookings_per_customer ?? 3,
      max_bookings_per_customer_period:
        next.max_bookings_per_customer_period ?? "week",
      allow_back_to_back: next.allow_back_to_back ?? true,
      allow_cancellation: next.allow_cancellation ?? true,
      cancellation_deadline_minutes: next.cancellation_deadline_minutes ?? 1440,
      allow_reschedule: next.allow_reschedule ?? true,
      reschedule_deadline_minutes: next.reschedule_deadline_minutes ?? 720,
      require_manual_approval: next.require_manual_approval ?? false,
      preset,
    });
  }, []);

  const showSlotDefaults =
    target?.kind === "global" || target?.kind === "slot_defaults";
  const showAdvance =
    target?.kind === "global" || target?.kind === "advance_booking";
  const showLimits = target?.kind === "limits";
  const showCustomer =
    target?.kind === "global" || target?.kind === "customer_actions";
  const showPresets = target?.kind === "global";

  const handleClose = () => {
    setPanelAnimatedOpen(false);
    window.setTimeout(() => onClose(), 280);
  };

  const handleSave = async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === "event_type") {
        await onSaveEventType(target.event_type_id, eventDraft);
        toast.success("Event type booking rules saved successfully.");
      } else {
        await onSaveGlobal(draft);
        toast.success("Booking rules saved successfully.");
      }
      handleClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save booking rules."
      );
    } finally {
      setBusy(false);
    }
  };

  const presetCards = useMemo(
    () =>
      (["standard", "strict", "flexible"] as const).map((id) => {
        const preset = BOOKING_RULES_PRESETS[id];
        const selected = draft.preset === id;
        const Icon = id === "standard" ? Star : id === "strict" ? Shield : Leaf;
        return (
          <button
            key={id}
            type="button"
            onClick={() => applyPreset(id)}
            disabled={busy}
            className={classNames(
              "rounded-xl border p-3 text-left transition",
              selected
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-400"
                : "border-slate-200 bg-white hover:border-slate-300"
            )}
          >
            <Icon
              className={classNames(
                "mb-2 h-4 w-4",
                selected ? "text-indigo-600" : "text-slate-400"
              )}
            />
            <p
              className={classNames(
                "text-xs font-semibold",
                selected ? "text-indigo-700" : "text-slate-900"
              )}
            >
              {preset.label}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {preset.description}
            </p>
          </button>
        );
      }),
    [applyPreset, busy, draft.preset]
  );

  return (
    <>
      <aside
        className={classNames(
          "fixed inset-0 z-100001 h-full flex",
          "transform transition-transform duration-300 ease-in-out will-change-transform",
          panelAnimatedOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!panelVisible}
      >
        <button
            type="button"
            aria-label="Close settings"
            onClick={handleClose}
            className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
          />
        {panelVisible ? (
          <div className="relative ml-auto flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {panel_title(target)}
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {isEventType ? (
                <SectionCard title="Event Type Override">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FieldSelect
                      label="Duration"
                      value={eventDraft.duration_minutes}
                      disabled={busy}
                      options={BOOKING_RULES_DURATION_OPTIONS}
                      onChange={(v) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          duration_minutes: Number(v),
                        }))
                      }
                    />
                    <FieldSelect
                      label="Minimum notice"
                      value={eventDraft.min_booking_notice_minutes}
                      disabled={busy}
                      options={BOOKING_RULES_NOTICE_OPTIONS}
                      onChange={(v) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          min_booking_notice_minutes: Number(v),
                        }))
                      }
                    />
                    <FieldSelect
                      label="Buffer before"
                      value={eventDraft.buffer_before}
                      disabled={busy}
                      options={BOOKING_RULES_BUFFER_OPTIONS}
                      onChange={(v) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          buffer_before: Number(v),
                        }))
                      }
                    />
                    <FieldSelect
                      label="Buffer after"
                      value={eventDraft.buffer_after}
                      disabled={busy}
                      options={BOOKING_RULES_BUFFER_OPTIONS}
                      onChange={(v) =>
                        setEventDraft((prev) => ({
                          ...prev,
                          buffer_after: Number(v),
                        }))
                      }
                    />
                  </div>
                </SectionCard>
              ) : (
                <>
                  {showSlotDefaults ? (
                    <SectionCard title="Global Slot Defaults">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldSelect
                          label="Default duration for new event types"
                          value={draft.default_duration_minutes}
                          disabled={busy}
                          options={BOOKING_RULES_DURATION_OPTIONS}
                          onChange={(v) =>
                            patchDraft({
                              default_duration_minutes: Number(v),
                            })
                          }
                        />
                        <FieldSelect
                          label="Slot interval"
                          value={draft.slot_interval_minutes}
                          disabled={busy}
                          options={BOOKING_RULES_INTERVAL_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ slot_interval_minutes: Number(v) })
                          }
                        />
                        <FieldSelect
                          label="Buffer before"
                          value={draft.buffer_before_minutes}
                          disabled={busy}
                          options={BOOKING_RULES_BUFFER_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ buffer_before_minutes: Number(v) })
                          }
                        />
                        <FieldSelect
                          label="Buffer after"
                          value={draft.buffer_after_minutes}
                          disabled={busy}
                          options={BOOKING_RULES_BUFFER_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ buffer_after_minutes: Number(v) })
                          }
                        />
                      </div>
                    </SectionCard>
                  ) : null}

                  {showAdvance ? (
                    <SectionCard title="Lead Time & Window">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldSelect
                          label="Minimum notice"
                          value={draft.min_notice_minutes}
                          disabled={busy}
                          options={BOOKING_RULES_NOTICE_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ min_notice_minutes: Number(v) })
                          }
                        />
                        <FieldSelect
                          label="Booking window"
                          value={draft.booking_window_days}
                          disabled={busy}
                          options={BOOKING_RULES_WINDOW_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ booking_window_days: Number(v) })
                          }
                        />
                      </div>
                      <ToggleRow
                        label="Prevent same-day bookings"
                        checked={draft.prevent_same_day_bookings}
                        disabled={busy}
                        onChange={(next) =>
                          patchDraft({ prevent_same_day_bookings: next })
                        }
                      />
                    </SectionCard>
                  ) : null}

                  {showLimits ? (
                    <SectionCard title="Limits & Capacity">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <FieldSelect
                          label="Max bookings per day"
                          value={draft.max_bookings_per_day}
                          disabled={busy}
                          options={BOOKING_RULES_MAX_PER_DAY_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ max_bookings_per_day: Number(v) })
                          }
                        />
                        <FieldSelect
                          label="Max bookings per customer"
                          value={draft.max_bookings_per_customer}
                          disabled={busy}
                          options={BOOKING_RULES_MAX_PER_CUSTOMER_OPTIONS}
                          onChange={(v) =>
                            patchDraft({ max_bookings_per_customer: Number(v) })
                          }
                        />
                        <FieldSelect
                          label="Customer limit period"
                          value={draft.max_bookings_per_customer_period}
                          disabled={busy}
                          options={BOOKING_RULES_CUSTOMER_PERIOD_OPTIONS}
                          onChange={(v) =>
                            patchDraft({
                              max_bookings_per_customer_period:
                                v as booking_rules["max_bookings_per_customer_period"],
                            })
                          }
                        />
                      </div>
                      <ToggleRow
                        label="Allow back-to-back bookings"
                        checked={draft.allow_back_to_back}
                        disabled={busy}
                        onChange={(next) =>
                          patchDraft({ allow_back_to_back: next })
                        }
                      />
                    </SectionCard>
                  ) : null}

                  {showCustomer ? (
                    <SectionCard title="Customer Self-Service">
                      <div className="space-y-2">
                        <ToggleRow
                          label="Allow cancellation"
                          checked={draft.allow_cancellation}
                          disabled={busy}
                          onChange={(next) =>
                            patchDraft({ allow_cancellation: next })
                          }
                        />
                        <ToggleRow
                          label="Allow rescheduling"
                          checked={draft.allow_reschedule}
                          disabled={busy}
                          onChange={(next) =>
                            patchDraft({ allow_reschedule: next })
                          }
                        />
                        <ToggleRow
                          label="Require manual approval"
                          checked={draft.require_manual_approval}
                          disabled={busy}
                          onChange={(next) =>
                            patchDraft({ require_manual_approval: next })
                          }
                        />
                      </div>
                      <div className="space-y-3">
                        <FieldSelect
                          label="Cancellation deadline"
                          value={draft.cancellation_deadline_minutes}
                          disabled={busy || !draft.allow_cancellation}
                          options={BOOKING_RULES_DEADLINE_OPTIONS}
                          onChange={(v) =>
                            patchDraft({
                              cancellation_deadline_minutes: Number(v),
                            })
                          }
                        />
                        <FieldSelect
                          label="Reschedule deadline"
                          value={draft.reschedule_deadline_minutes}
                          disabled={busy || !draft.allow_reschedule}
                          options={BOOKING_RULES_DEADLINE_OPTIONS}
                          onChange={(v) =>
                            patchDraft({
                              reschedule_deadline_minutes: Number(v),
                            })
                          }
                        />
                      </div>
                    </SectionCard>
                  ) : null}

                  {showPresets ? (
                    <SectionCard title="Common Presets">
                      <div className="grid grid-cols-3 gap-2">{presetCards}</div>
                    </SectionCard>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={busy}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save Rules"}
              </button>
            </div>
          </div>
        ) : null}
      </aside>

    </>
  );
}
