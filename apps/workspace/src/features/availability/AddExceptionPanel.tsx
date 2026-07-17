"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LuCalendar as Calendar,
  LuClock as Clock,
  LuUsers as Users,
  LuX as X,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import {
  classNames,
  PanelSection,
} from "@/src/features/departments/DepartmentPanelPrimitives";
import type {
  date_exception,
  date_exception_availability_type,
  date_exception_category,
} from "@/src/types/date_exceptions";

const NOTES_MAX = 200;

const panelFieldClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60";

type provider_option = {
  id: string;
  name: string;
};

export type AddExceptionPanelProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: (exception: date_exception) => void;
  exception?: date_exception | null;
  providers: provider_option[];
  defaultProviderId?: string;
  lockProviderScope?: boolean;
};

type availability_card = {
  value: date_exception_availability_type;
  title: string;
  subtitle: string;
};

const AVAILABILITY_CARDS: availability_card[] = [
  {
    value: "closed",
    title: "Closed All Day",
    subtitle: "No availability",
  },
  {
    value: "unavailable",
    title: "Unavailable Hours",
    subtitle: "Block time slots",
  },
  {
    value: "special_hours",
    title: "Special Hours",
    subtitle: "Set custom hours",
  },
];

function toInputTime(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return fallback;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

export function AddExceptionPanel({
  open,
  onClose,
  onSaved,
  exception = null,
  providers,
  defaultProviderId = "",
  lockProviderScope = false,
}: AddExceptionPanelProps) {
  const isEdit = Boolean(exception?.id);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [exceptionDate, setExceptionDate] = useState("");
  const [providerId, setProviderId] = useState("");
  const [availabilityType, setAvailabilityType] =
    useState<date_exception_availability_type>("closed");
  const [exceptionCategory, setExceptionCategory] =
    useState<date_exception_category>("custom");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [notes, setNotes] = useState("");

  const resetForm = useCallback(() => {
    setName("");
    setExceptionDate("");
    setProviderId(lockProviderScope ? defaultProviderId : "");
    setAvailabilityType("closed");
    setExceptionCategory("custom");
    setStartTime("09:00");
    setEndTime("17:00");
    setRepeatYearly(false);
    setNotes("");
  }, [defaultProviderId, lockProviderScope]);

  const hydrateFromException = useCallback(
    (row: date_exception) => {
      setName(row.name);
      setExceptionDate(row.exception_date);
      setProviderId(row.provider_id ?? "");
      setAvailabilityType(row.availability_type);
      setExceptionCategory(row.exception_category);
      setStartTime(toInputTime(row.start_time, "09:00"));
      setEndTime(toInputTime(row.end_time, "17:00"));
      setRepeatYearly(row.repeat_yearly);
      setNotes(row.notes ?? "");
    },
    []
  );

  useEffect(() => {
    if (!open) {
      setPanelAnimatedOpen(false);
      return;
    }
    if (exception) {
      hydrateFromException(exception);
    } else {
      resetForm();
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelAnimatedOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, exception, hydrateFromException, resetForm]);

  const panelVisible = open || panelAnimatedOpen;

  const handleClose = () => {
    setPanelAnimatedOpen(false);
    window.setTimeout(() => onClose(), 300);
  };

  const applyPreset = (preset: "holiday" | "team" | "special") => {
    if (preset === "holiday") {
      setAvailabilityType("closed");
      setExceptionCategory("holiday");
      if (!name.trim()) setName("Holiday Closure");
      return;
    }
    if (preset === "team") {
      setAvailabilityType("unavailable");
      setExceptionCategory("custom");
      setStartTime("13:00");
      setEndTime("15:00");
      if (!name.trim()) setName("Team Event");
      return;
    }
    setAvailabilityType("special_hours");
    setExceptionCategory("custom");
    setStartTime("08:00");
    setEndTime("19:00");
    if (!name.trim()) setName("Special Hours");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setAlertMessage("Exception name is required.");
      return;
    }
    if (!exceptionDate) {
      setAlertMessage("Date is required.");
      return;
    }
    if (availabilityType !== "closed" && (!startTime || !endTime)) {
      setAlertMessage("Start time and end time are required.");
      return;
    }
    if (availabilityType !== "closed" && startTime >= endTime) {
      setAlertMessage("End time must be after start time.");
      return;
    }

    setBusyAction(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setAlertMessage("Please sign in again.");
        return;
      }

      const payload = {
        name: name.trim(),
        exception_date: exceptionDate,
        provider_id: providerId.trim() ? providerId.trim() : null,
        availability_type: availabilityType,
        exception_category: exceptionCategory,
        start_time: availabilityType === "closed" ? null : startTime,
        end_time: availabilityType === "closed" ? null : endTime,
        repeat_yearly: repeatYearly,
        notes: notes.trim() ? notes.trim().slice(0, NOTES_MAX) : null,
      };

      const url = isEdit
        ? `/api/date-exceptions/${exception!.id}`
        : "/api/date-exceptions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlertMessage(
          typeof data.error === "string" ? data.error : "Failed to save exception."
        );
        return;
      }

      if (data.exception) {
        onSaved?.(data.exception as date_exception);
      }
      handleClose();
    } catch (error) {
      console.error("Error saving date exception:", error);
      setAlertMessage("Failed to save exception.");
    } finally {
      setBusyAction(false);
    }
  };

  const timesDisabled = availabilityType === "closed";

  return (
    <>
      <aside
        className={classNames(
          "fixed top-16 right-0 bottom-0 z-30 flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:w-[28rem]",
          "transform transition-transform duration-300 ease-in-out will-change-transform",
          panelAnimatedOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!panelVisible}
      >
        {panelVisible ? (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {isEdit ? "Edit Exception" : "Add Exception"}
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

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <PanelSection number={1} title="Basic Information">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Exception Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Independence Day"
                      className={panelFieldClass}
                      maxLength={200}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        value={exceptionDate}
                        onChange={(e) => setExceptionDate(e.target.value)}
                        className={classNames(panelFieldClass)}
                      />
                      {/* <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /> */}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Applies To <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      disabled={lockProviderScope}
                      className={panelFieldClass}
                    >
                      <option value="">All Providers</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </PanelSection>

                <PanelSection number={2} title="Availability Type">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {AVAILABILITY_CARDS.map((card) => {
                      const selected = availabilityType === card.value;
                      return (
                        <button
                          key={card.value}
                          type="button"
                          onClick={() => setAvailabilityType(card.value)}
                          className={classNames(
                            "rounded-xl border p-3 text-left transition",
                            selected
                              ? "border-violet-500 bg-violet-50 ring-1 ring-violet-400"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <Clock
                            className={classNames(
                              "mb-2 h-4 w-4",
                              selected ? "text-violet-600" : "text-slate-400"
                            )}
                          />
                          <p className="text-xs font-semibold text-slate-900">
                            {card.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {card.subtitle}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={timesDisabled}
                        className={panelFieldClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={timesDisabled}
                        className={panelFieldClass}
                      />
                    </div>
                  </div>
                  {timesDisabled ? (
                    <p className="text-xs text-slate-500">
                      Not required for full day closure.
                    </p>
                  ) : null}
                </PanelSection>

                <PanelSection number={3} title="Settings & Notes" isLast>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        Repeat Yearly
                      </p>
                      <p className="text-xs text-slate-500">
                        Add this exception every year on the same date
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={repeatYearly}
                      onClick={() => setRepeatYearly((v) => !v)}
                      className={classNames(
                        "relative h-6 w-11 shrink-0 rounded-full transition",
                        repeatYearly ? "bg-violet-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={classNames(
                          "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                          repeatYearly ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                      placeholder="Add a note (optional)"
                      rows={3}
                      className={panelFieldClass}
                    />
                    <p className="mt-1 text-right text-xs text-slate-400">
                      {notes.length}/{NOTES_MAX}
                    </p>
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Common presets
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => applyPreset("holiday")}
                        className="rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
                      >
                        <Calendar className="mb-2 h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-900">
                          Holiday Closure
                        </p>
                        <p className="text-[11px] text-slate-500">Full day closed</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("team")}
                        className="rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
                      >
                        <Users className="mb-2 h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-900">
                          Team Event
                        </p>
                        <p className="text-[11px] text-slate-500">Block time slots</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPreset("special")}
                        className="rounded-xl border border-slate-200 p-3 text-left hover:border-violet-300 hover:bg-violet-50/50"
                      >
                        <Clock className="mb-2 h-4 w-4 text-slate-500" />
                        <p className="text-xs font-semibold text-slate-900">
                          Special Hours
                        </p>
                        <p className="text-[11px] text-slate-500">Custom schedule</p>
                      </button>
                    </div>
                  </div>
                </PanelSection>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={busyAction}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction ? "Saving…" : "Save Exception"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </aside>

      {alertMessage ? (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      ) : null}
    </>
  );
}
