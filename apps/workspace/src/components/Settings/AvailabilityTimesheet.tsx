"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  LuClock as Clock,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuTrash2 as Trash2,
  LuX as X,
  LuChevronRight as ChevronRight,
} from "react-icons/lu";
import { AvailabilityGeneralSkeleton } from '@/src/components/ui/AvailabilityGeneralSkeleton';
import { convertWallClockHHmm } from '@/src/utils/timezone';

type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

interface BreakTime {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}

export type availability_timesheet_save_feedback =
  | { type: "success" | "error"; text: string }
  | null;

export type availability_timesheet_handle = {
  applyMonFriPreset: () => void;
  copyMondayToWeekdays: () => void;
  saveChanges: () => Promise<void>;
  isBusy: () => boolean;
};

interface AvailabilityTimesheetProps {
  onSave?: (data: Record<DayName, DaySchedule>) => void;
  /** When set, save success/error is reported here instead of the inline banner below the grid */
  onSaveFeedback?: (payload: availability_timesheet_save_feedback) => void;
  /** When provided, skips the initial settings fetch and uses this data instead */
  initialTimesheet?: Record<string, DaySchedule> | null;
  /** When set, load/save under availability.providers[userId] via provider-availability API (service provider self) */
  providerUserId?: string;
  /** When set, load/save under availability.providers[userId] via workspace settings API (workspace admin) */
  saveAsProviderId?: string;
  /** Notifies parent when the day-edit side panel opens/closes (for layout shift) */
  onEditPanelOpenChange?: (open: boolean) => void;
  /** Notifies parent when busy/saving state changes (for top toolbar buttons) */
  onBusyChange?: (busy: boolean) => void;
  /** IANA timezone times are stored/edited in (workspace or browser) */
  sourceTimezone?: string;
  /** IANA timezone used only for displaying table times (not persisted) */
  displayTimezone?: string;
}

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

const DAYS: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS: DayName[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKEND_DAYS: DayName[] = ["Sat", "Sun"];

const DAY_NAMES: Record<DayName, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

const generateTimeOptions = () => {
  const options = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      const displayTime = formatTimeForDisplay(time);
      options.push({ value: time, label: displayTime });
    }
  }
  return options;
};

const formatTimeForDisplay = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const formatBreakRange = (start: string, end: string): string => {
  const [startHours, startMins] = start.split(':').map(Number);
  const [endHours, endMins] = end.split(':').map(Number);
  const startPeriod = startHours >= 12 ? 'PM' : 'AM';
  const endPeriod = endHours >= 12 ? 'PM' : 'AM';
  const startDisplay = `${startHours % 12 || 12}:${startMins.toString().padStart(2, '0')}`;
  const endDisplay = `${endHours % 12 || 12}:${endMins.toString().padStart(2, '0')}`;
  if (startPeriod === endPeriod) {
    return `${startDisplay} – ${endDisplay} ${endPeriod}`;
  }
  return `${startDisplay} ${startPeriod} – ${endDisplay} ${endPeriod}`;
};

const formatTimeForDisplayInZones = (
  time: string,
  sourceTimezone: string,
  displayTimezone: string
): string => {
  const converted = convertWallClockHHmm(time, sourceTimezone, displayTimezone);
  return formatTimeForDisplay(converted);
};

const formatBreakRangeInZones = (
  start: string,
  end: string,
  sourceTimezone: string,
  displayTimezone: string
): string => {
  const convertedStart = convertWallClockHHmm(start, sourceTimezone, displayTimezone);
  const convertedEnd = convertWallClockHHmm(end, sourceTimezone, displayTimezone);
  return formatBreakRange(convertedStart, convertedEnd);
};

const timeOptions = generateTimeOptions();

function buildDefaultSchedules(): Record<DayName, DaySchedule> {
  const defaultSchedule: DaySchedule = {
    enabled: false,
    startTime: '09:00',
    endTime: '17:00',
    breaks: [],
  };
  return {
    Mon: { ...defaultSchedule, enabled: true },
    Tue: { ...defaultSchedule, enabled: true },
    Wed: { ...defaultSchedule, enabled: true },
    Thu: { ...defaultSchedule, enabled: true },
    Fri: { ...defaultSchedule, enabled: true },
    Sat: { ...defaultSchedule },
    Sun: { ...defaultSchedule },
  };
}

function cloneDaySchedule(day: DaySchedule): DaySchedule {
  return {
    ...day,
    breaks: day.breaks.map((b) => ({ ...b })),
  };
}

function cloneSchedules(schedulesClone: Record<DayName, DaySchedule>): Record<DayName, DaySchedule> {
  const out = {} as Record<DayName, DaySchedule>;
  for (const d of DAYS) {
    out[d] = cloneDaySchedule(schedulesClone[d]);
  }
  return out;
}

/** Ignore break ids so break id churn does not mark a day dirty. */
function dayScheduleSignature(schedule: DaySchedule): string {
  const sortedBreaks = [...schedule.breaks]
    .map((b) => `${b.start}|${b.end}`)
    .sort()
    .join(';');
  return `${schedule.enabled}:${schedule.startTime}:${schedule.endTime}:${sortedBreaks}`;
}

function fingerprintPartialTimesheet(
  partial: Record<string, DaySchedule> | null | undefined
): string {
  if (!partial || Object.keys(partial).length === 0) return '∅';
  return DAYS.map((d) =>
    partial[d] !== undefined ? dayScheduleSignature(partial[d] as DaySchedule) : '__'
  ).join('#');
}

// Helper function to compare times (returns true if time1 is after time2)
const isTimeAfter = (time1: string, time2: string): boolean => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  const totalMinutes1 = h1 * 60 + m1;
  const totalMinutes2 = h2 * 60 + m2;
  return totalMinutes1 > totalMinutes2;
};

// Helper function to check if time is equal
const isTimeEqual = (time1: string, time2: string): boolean => {
  return time1 === time2;
};

// Helper function to filter time options based on constraints
const getFilteredTimeOptions = (
  minTime?: string,
  maxTime?: string,
  excludeEqual?: boolean
) => {
  return timeOptions.filter((option) => {
    // Filter by minimum time
    if (minTime) {
      if (excludeEqual) {
        // Exclude times that are <= minTime (only allow times > minTime)
        if (!isTimeAfter(option.value, minTime)) {
          return false;
        }
      } else {
        // Exclude times that are < minTime (allow times >= minTime)
        if (!isTimeAfter(option.value, minTime) && !isTimeEqual(option.value, minTime)) {
          return false;
        }
      }
    }
    // Filter by maximum time (exclude times > maxTime)
    if (maxTime && isTimeAfter(option.value, maxTime)) {
      return false;
    }
    return true;
  });
};

const AvailabilityTimesheet = forwardRef<
  availability_timesheet_handle,
  AvailabilityTimesheetProps
>(function AvailabilityTimesheet(
  {
    onSave,
    onSaveFeedback,
    initialTimesheet,
    providerUserId,
    saveAsProviderId,
    onEditPanelOpenChange,
    onBusyChange,
    sourceTimezone = "UTC",
    displayTimezone = "UTC",
  },
  ref
) {
  const [schedules, setSchedules] = useState<Record<DayName, DaySchedule>>(buildDefaultSchedules);

  const [savedSchedules, setSavedSchedules] = useState<Record<DayName, DaySchedule>>(() =>
    cloneSchedules(buildDefaultSchedules())
  );

  const hasInitialData = initialTimesheet !== undefined;
  const [isLoading, setIsLoading] = useState(!hasInitialData);
  const [isSaving, setIsSaving] = useState(false);
  const [savingDay, setSavingDay] = useState<DayName | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [daySaveFeedback, setDaySaveFeedback] = useState<
    Partial<Record<DayName, { type: 'success' | 'error'; text: string }>>
  >({});
  const [editingDay, setEditingDay] = useState<DayName | null>(null);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [panelSnapshot, setPanelSnapshot] = useState<DaySchedule | null>(null);
  /** Full week snapshot taken before "Copy to other days" so Cancel can undo the copy */
  const [preCopySnapshot, setPreCopySnapshot] = useState<Record<
    DayName,
    DaySchedule
  > | null>(null);

  const editPanelOpen = editingDay !== null;
  const editPanelVisible = editPanelOpen || panelAnimatedOpen;

  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;

  const partialTimesheetFingerprint = fingerprintPartialTimesheet(initialTimesheet ?? undefined);

  useEffect(() => {
    onEditPanelOpenChange?.(editPanelOpen);
  }, [editPanelOpen, onEditPanelOpenChange]);

  useEffect(() => {
    if (!editPanelOpen) {
      setPanelAnimatedOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelAnimatedOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [editPanelOpen]);

  useEffect(() => {
    return () => {
      onEditPanelOpenChange?.(false);
    };
    // Notify parent only on unmount so layout margin resets when leaving the tab
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional unmount-only cleanup
  }, []);

  /* Intentionally depend on semantic timesheet fingerprint, not unstable object refs */
  /* eslint-disable react-hooks/exhaustive-deps -- loadAvailability merges once per fingerprint */
  useEffect(() => {
    if (hasInitialData) {
      const prev = schedulesRef.current;
      const next =
        initialTimesheet && Object.keys(initialTimesheet).length > 0
          ? { ...prev, ...initialTimesheet }
          : prev;
      setSchedules(next);
      setSavedSchedules(cloneSchedules(next));
      setIsLoading(false);
      return;
    }
    loadAvailability();
  }, [hasInitialData, partialTimesheetFingerprint, providerUserId, saveAsProviderId]);
  /* eslint-enable react-hooks/exhaustive-deps */


  const validateDaySchedule = (day: DayName, schedule: DaySchedule): string[] => {
    const validationErrors: string[] = [];
    if (schedule.enabled) {
      if (!isTimeAfter(schedule.endTime, schedule.startTime)) {
        validationErrors.push(`${DAY_NAMES[day]}: End time must be after start time`);
      }

      schedule.breaks.forEach((breakTime, index) => {
        if (!isTimeAfter(breakTime.start, schedule.startTime)) {
          validationErrors.push(
            `${DAY_NAMES[day]}: Break ${index + 1} start must be after day start time`
          );
        }
        if (!isTimeAfter(schedule.endTime, breakTime.end)) {
          validationErrors.push(
            `${DAY_NAMES[day]}: Break ${index + 1} end must be before day end time`
          );
        }
        if (!isTimeAfter(breakTime.end, breakTime.start)) {
          validationErrors.push(
            `${DAY_NAMES[day]}: Break ${index + 1} end must be after break start time`
          );
        }
      });
    }
    return validationErrors;
  };

  /** Clamp breaks into the valid window (strictly after start / before end) so save is not blocked by auto-added slots. */
  const clampBreaksForDay = (schedule: DaySchedule): DaySchedule => {
    if (!schedule.enabled) return schedule;

    const [startHours, startMins] = schedule.startTime.split(':').map(Number);
    const [endHours, endMins] = schedule.endTime.split(':').map(Number);
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    const minBreakDuration = 30;
    const earliestStart = startTotal + minBreakDuration;
    const latestEnd = endTotal - minBreakDuration;

    if (latestEnd - earliestStart < minBreakDuration) {
      return { ...schedule, breaks: [] };
    }

    const toTime = (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60) % 24;
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    const breaks = schedule.breaks
      .map((breakTime) => {
        const [bStartH, bStartM] = breakTime.start.split(':').map(Number);
        const [bEndH, bEndM] = breakTime.end.split(':').map(Number);
        let breakStartTotal = bStartH * 60 + bStartM;
        let breakEndTotal = bEndH * 60 + bEndM;

        if (breakStartTotal <= startTotal) {
          breakStartTotal = earliestStart;
        }
        if (breakEndTotal >= endTotal) {
          breakEndTotal = latestEnd;
        }
        if (breakEndTotal - breakStartTotal < minBreakDuration) {
          breakEndTotal = Math.min(breakStartTotal + minBreakDuration, latestEnd);
          if (breakEndTotal - breakStartTotal < minBreakDuration) {
            breakStartTotal = Math.max(earliestStart, breakEndTotal - minBreakDuration);
          }
        }

        return {
          ...breakTime,
          start: toTime(breakStartTotal),
          end: toTime(breakEndTotal),
        };
      })
      .filter((breakTime) => {
        return (
          isTimeAfter(breakTime.start, schedule.startTime) &&
          isTimeAfter(schedule.endTime, breakTime.end) &&
          isTimeAfter(breakTime.end, breakTime.start)
        );
      });

    return { ...schedule, breaks };
  };

  const persistTimesheet = async (timesheet: Record<DayName, DaySchedule>) => {
    const { supabase } = await import('@/lib/supabaseClient');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (saveAsProviderId) {
      const getResponse = await fetch('/api/settings', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      let existingSettings: Record<string, unknown> = {};
      if (getResponse.ok) {
        const payload = await getResponse.json();
        existingSettings =
          (payload?.settings ?? payload?.data?.settings ?? {}) as Record<string, unknown>;
      }

      const existingAvailability = (existingSettings.availability ?? {}) as Record<
        string,
        unknown
      >;
      const existingProviders = (existingAvailability.providers ?? {}) as Record<
        string,
        { timesheet?: Record<string, DaySchedule>; individual?: Record<string, boolean> }
      >;

      const updatedSettings = {
        ...existingSettings,
        availability: {
          ...existingAvailability,
          providers: {
            ...existingProviders,
            [saveAsProviderId]: {
              ...(existingProviders[saveAsProviderId] ?? {}),
              timesheet,
              lastUpdated: new Date().toISOString(),
            },
          },
        },
      };

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: updatedSettings }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          (result as { error?: string }).error || 'Failed to save provider availability'
        );
      }
      return;
    }

    if (providerUserId) {
      const response = await fetch('/api/settings/provider-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ timesheet }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(
          (result as { error?: string }).error || 'Failed to save provider availability'
        );
      }
      return;
    }

    const settingsPayload = {
      availability: {
        timesheet,
      },
    };

    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ settings: settingsPayload }),
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(
        (result as { error?: string }).error || 'Failed to save availability timesheet'
      );
    }
  };

  const pushSaveFeedback = (
    payload: availability_timesheet_save_feedback,
    clearAfterMs?: number
  ) => {
    if (payload === null) {
      return;
    }
    if (onSaveFeedback) {
      onSaveFeedback(payload);
      if (clearAfterMs !== undefined && clearAfterMs > 0) {
        setTimeout(() => onSaveFeedback(null), clearAfterMs);
      }
    } else {
      setSaveMessage(payload);
      if (clearAfterMs !== undefined && clearAfterMs > 0) {
        setTimeout(() => setSaveMessage(null), clearAfterMs);
      }
    }
  };

  const pushDaySaveFeedback = (
    day: DayName,
    payload: { type: 'success' | 'error'; text: string } | null,
    clearAfterMs?: number
  ) => {
    if (payload === null) {
      setDaySaveFeedback((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      return;
    }
    setDaySaveFeedback((prev) => ({ ...prev, [day]: payload }));
    if (clearAfterMs !== undefined && clearAfterMs > 0) {
      setTimeout(() => pushDaySaveFeedback(day, null), clearAfterMs);
    }
  };

  const loadAvailability = async () => {
    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch('/api/settings', {
        headers: token ? {
          'Authorization': `Bearer ${token}`,
        } : {},
      });

      if (response.ok) {
        const data = await response.json();
        const availability = data?.settings?.availability;
        const providerIdForLoad = saveAsProviderId ?? providerUserId;
        const providerEntry = providerIdForLoad
          ? availability?.providers?.[providerIdForLoad]
          : undefined;
        const providerTimesheet = providerEntry?.timesheet;
        let patch: Record<string, DaySchedule> | undefined;
        if (
          providerIdForLoad &&
          providerTimesheet &&
          Object.keys(providerTimesheet).length > 0
        ) {
          patch = providerTimesheet;
        } else if (availability?.timesheet && Object.keys(availability.timesheet).length > 0) {
          patch = availability.timesheet;
        }

        if (patch) {
          const currentSnap = schedulesRef.current;
          const next = { ...currentSnap, ...patch } as Record<DayName, DaySchedule>;
          setSchedules(next);
          setSavedSchedules(cloneSchedules(next));
        }
      } else if (response.status === 404) {
        // API route doesn't exist yet, use default schedules
        console.log('Settings API not found, using default schedules');
      }
    } catch (error) {
      console.error('Error loading availability timesheet:', error);
      // Continue with default schedules if API fails
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (): Promise<boolean> => {
    setIsSaving(true);
    setSaveMessage(null);
    onSaveFeedback?.(null);

    try {
      const clampedSchedules = {} as Record<DayName, DaySchedule>;
      for (const day of DAYS) {
        clampedSchedules[day] = clampBreaksForDay(schedules[day]);
      }
      setSchedules(cloneSchedules(clampedSchedules));

      const validationErrors: string[] = [];
      for (const day of DAYS) {
        validationErrors.push(...validateDaySchedule(day, clampedSchedules[day]));
      }

      if (validationErrors.length > 0) {
        throw new Error(`Validation failed:\n${validationErrors.join('\n')}`);
      }

      await persistTimesheet(clampedSchedules);
      const frozen = cloneSchedules(clampedSchedules);
      setSavedSchedules(frozen);
      pushSaveFeedback({ type: 'success', text: 'Availability timesheet saved successfully!' }, 3000);
      onSave?.(clampedSchedules);
      return true;
    } catch (error) {
      console.error('Error saving availability timesheet:', error);
      const errText =
        error instanceof Error
          ? error.message
          : 'Failed to save availability timesheet. Please try again.';
      pushSaveFeedback({ type: 'error', text: errText }, 5000);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDay = async (day: DayName): Promise<boolean> => {
    setSavingDay(day);
    pushDaySaveFeedback(day, null);
    onSaveFeedback?.(null);

    try {
      const clampedDay = clampBreaksForDay(schedules[day]);
      if (dayScheduleSignature(clampedDay) !== dayScheduleSignature(schedules[day])) {
        setSchedules((prev) => ({ ...prev, [day]: cloneDaySchedule(clampedDay) }));
      }

      const dayErrors = validateDaySchedule(day, clampedDay);
      if (dayErrors.length > 0) {
        throw new Error(`Validation failed:\n${dayErrors.join('\n')}`);
      }

      const merged: Record<DayName, DaySchedule> = {
        ...savedSchedules,
        [day]: cloneDaySchedule(clampedDay),
      };

      await persistTimesheet(merged);
      setSavedSchedules(cloneSchedules(merged));
      setSchedules((prev) => ({
        ...prev,
        [day]: cloneDaySchedule(merged[day]),
      }));
      pushDaySaveFeedback(
        day,
        { type: 'success', text: `${DAY_NAMES[day]} availability saved successfully!` },
        3000
      );
      onSave?.({
        ...schedules,
        [day]: cloneDaySchedule(clampedDay),
      });
      return true;
    } catch (error) {
      console.error('Error saving day availability:', error);
      const errText =
        error instanceof Error
          ? error.message
          : 'Failed to save availability timesheet. Please try again.';
      pushDaySaveFeedback(day, { type: 'error', text: errText }, 5000);
      return false;
    } finally {
      setSavingDay(null);
    }
  };

  const updateDaySchedule = (day: DayName, updates: Partial<DaySchedule>) => {
    setSchedules((prev) => {
      const currentSchedule = prev[day];
      const newSchedule = { ...currentSchedule, ...updates };
      
      // If start time changed, validate and reset end time if invalid
      if (updates.startTime !== undefined) {
        if (!isTimeAfter(newSchedule.endTime, newSchedule.startTime)) {
          // Find next valid end time (30 minutes after start)
          const [hours, minutes] = newSchedule.startTime.split(':').map(Number);
          const nextValidMinutes = (hours * 60 + minutes + 30) % (24 * 60);
          const nextValidHours = Math.floor(nextValidMinutes / 60);
          const nextValidMins = nextValidMinutes % 60;
          newSchedule.endTime = `${nextValidHours.toString().padStart(2, '0')}:${nextValidMins.toString().padStart(2, '0')}`;
        }
        
        // Validate and reset breaks that are now invalid
        newSchedule.breaks = newSchedule.breaks
          .map((breakTime) => {
            // Reset break if start is before day start or end is after day end
            if (!isTimeAfter(breakTime.start, newSchedule.startTime) || 
                !isTimeAfter(newSchedule.endTime, breakTime.end)) {
              // Reset to default valid break time
              const [startHours, startMins] = newSchedule.startTime.split(':').map(Number);
              const [endHours, endMins] = newSchedule.endTime.split(':').map(Number);
              const startTotal = startHours * 60 + startMins;
              const endTotal = endHours * 60 + endMins;
              const midTotal = Math.floor((startTotal + endTotal) / 2);
              const breakStartHours = Math.floor(midTotal / 60);
              const breakStartMins = midTotal % 60;
              const breakEndHours = Math.floor((midTotal + 60) / 60);
              const breakEndMins = (midTotal + 60) % 60;
              
              return {
                ...breakTime,
                start: `${breakStartHours.toString().padStart(2, '0')}:${breakStartMins.toString().padStart(2, '0')}`,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            // Also validate break end is after break start
            if (!isTimeAfter(breakTime.end, breakTime.start)) {
              const [breakStartHours, breakStartMins] = breakTime.start.split(':').map(Number);
              const breakStartTotal = breakStartHours * 60 + breakStartMins;
              const breakEndTotal = breakStartTotal + 60; // 1 hour after break start
              const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
              const breakEndMins = breakEndTotal % 60;
              return {
                ...breakTime,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            return breakTime;
          })
          .filter((breakTime) => {
            // Remove breaks that are completely outside the day range
            return isTimeAfter(breakTime.start, newSchedule.startTime) && 
                   isTimeAfter(newSchedule.endTime, breakTime.end);
          });
      }
      
      // If end time changed, validate and reset breaks if invalid
      if (updates.endTime !== undefined) {
        newSchedule.breaks = newSchedule.breaks
          .map((breakTime) => {
            // Reset break end if it's after day end
            if (!isTimeAfter(newSchedule.endTime, breakTime.end)) {
              // Set break end to 30 minutes before day end, or 30 minutes after break start, whichever is earlier
              const [endHours, endMins] = newSchedule.endTime.split(':').map(Number);
              const [breakStartHours, breakStartMins] = breakTime.start.split(':').map(Number);
              const endTotal = endHours * 60 + endMins;
              const breakStartTotal = breakStartHours * 60 + breakStartMins;
              const maxBreakEndTotal = endTotal - 30; // 30 minutes before day end
              const minBreakEndTotal = breakStartTotal + 30; // 30 minutes after break start
              const breakEndTotal = Math.min(maxBreakEndTotal, minBreakEndTotal);
              const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
              const breakEndMins = breakEndTotal % 60;
              return {
                ...breakTime,
                end: `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`,
              };
            }
            return breakTime;
          })
          .filter((breakTime) => {
            // Remove breaks that are completely outside the day range
            return isTimeAfter(breakTime.start, newSchedule.startTime) && 
                   isTimeAfter(newSchedule.endTime, breakTime.end);
          });
      }
      
      return {
        ...prev,
        [day]: newSchedule,
      };
    });
  };

  const addBreak = (day: DayName) => {
    const daySchedule = schedules[day];
    const [startHours, startMins] = daySchedule.startTime.split(':').map(Number);
    const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
    const startTotal = startHours * 60 + startMins;
    const endTotal = endHours * 60 + endMins;
    const minBreakDuration = 30;
    const defaultBreakDuration = 60;
    // Validation requires break start > day start and break end < day end
    const earliestStart = startTotal + minBreakDuration;
    const latestEnd = endTotal - minBreakDuration;

    if (latestEnd - earliestStart < minBreakDuration) {
      return;
    }

    const toTime = (totalMinutes: number) => {
      const hours = Math.floor(totalMinutes / 60) % 24;
      const mins = totalMinutes % 60;
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    };

    let breakStartTotal: number;
    let breakEndTotal: number;

    if (daySchedule.breaks.length === 0) {
      const midTotal = Math.floor((startTotal + endTotal) / 2);
      breakStartTotal = Math.max(midTotal, earliestStart);
      breakEndTotal = Math.min(breakStartTotal + defaultBreakDuration, latestEnd);
    } else {
      const sortedBreaks = [...daySchedule.breaks].sort((a, b) => {
        const aStart = a.start.split(':').map(Number);
        const bStart = b.start.split(':').map(Number);
        return aStart[0] * 60 + aStart[1] - (bStart[0] * 60 + bStart[1]);
      });

      const gaps: Array<{ start: number; end: number }> = [];
      let gapStart = earliestStart;
      for (const b of sortedBreaks) {
        const [bStartH, bStartM] = b.start.split(':').map(Number);
        const [bEndH, bEndM] = b.end.split(':').map(Number);
        const bStartTotal = bStartH * 60 + bStartM;
        const bEndTotal = bEndH * 60 + bEndM;
        if (bStartTotal > gapStart) {
          gaps.push({ start: gapStart, end: bStartTotal });
        }
        gapStart = Math.max(gapStart, bEndTotal);
      }
      if (latestEnd > gapStart) {
        gaps.push({ start: gapStart, end: latestEnd });
      }

      const validSlots = gaps.filter((g) => g.end - g.start >= minBreakDuration);
      const slot = validSlots.length > 0 ? validSlots[validSlots.length - 1] : undefined;
      if (slot) {
        breakStartTotal = Math.max(slot.start, earliestStart);
        breakEndTotal = Math.min(
          breakStartTotal + defaultBreakDuration,
          slot.end,
          latestEnd
        );
      } else {
        const midTotal = Math.floor((startTotal + endTotal) / 2);
        breakStartTotal = Math.max(midTotal, earliestStart);
        breakEndTotal = Math.min(breakStartTotal + defaultBreakDuration, latestEnd);
      }
    }

    if (breakEndTotal - breakStartTotal < minBreakDuration) {
      return;
    }

    const newBreak: BreakTime = {
      id: `break-${Date.now()}-${Math.random()}`,
      start: toTime(breakStartTotal),
      end: toTime(breakEndTotal),
    };
    updateDaySchedule(day, {
      breaks: [...daySchedule.breaks, newBreak],
    });
  };

  const removeBreak = (day: DayName, breakId: string) => {
    const daySchedule = schedules[day];
    updateDaySchedule(day, {
      breaks: daySchedule.breaks.filter((b) => b.id !== breakId),
    });
  };

  const updateBreak = (day: DayName, breakId: string, field: 'start' | 'end', value: string) => {
    const daySchedule = schedules[day];
    const updatedBreaks = daySchedule.breaks.map((b) => {
      if (b.id !== breakId) return b;
      
      const updatedBreak = { ...b, [field]: value };
      
      // If break start changed, validate and reset break end if invalid
      if (field === 'start') {
        // Ensure break start is after day start
        if (!isTimeAfter(updatedBreak.start, daySchedule.startTime)) {
          // Reset to 30 minutes after day start
          const [startHours, startMins] = daySchedule.startTime.split(':').map(Number);
          const breakStartTotal = startHours * 60 + startMins + 30;
          const breakStartHours = Math.floor(breakStartTotal / 60) % 24;
          const breakStartMins = breakStartTotal % 60;
          updatedBreak.start = `${breakStartHours.toString().padStart(2, '0')}:${breakStartMins.toString().padStart(2, '0')}`;
        }
        
        // Ensure break end is after break start and before day end
        if (!isTimeAfter(updatedBreak.end, updatedBreak.start) || 
            !isTimeAfter(daySchedule.endTime, updatedBreak.end)) {
          // Set break end to 30 minutes after break start, but not after day end
          const [breakStartHours, breakStartMins] = updatedBreak.start.split(':').map(Number);
          const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
          const breakStartTotal = breakStartHours * 60 + breakStartMins;
          const endTotal = endHours * 60 + endMins;
          const breakEndTotal = Math.min(breakStartTotal + 30, endTotal - 30);
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
      }
      
      // If break end changed, validate it's after break start and before day end
      if (field === 'end') {
        if (!isTimeAfter(updatedBreak.end, updatedBreak.start)) {
          // Reset to 30 minutes after break start
          const [breakStartHours, breakStartMins] = updatedBreak.start.split(':').map(Number);
          const breakStartTotal = breakStartHours * 60 + breakStartMins;
          const breakEndTotal = breakStartTotal + 30;
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
        if (!isTimeAfter(daySchedule.endTime, updatedBreak.end)) {
          // Reset to 30 minutes before day end
          const [endHours, endMins] = daySchedule.endTime.split(':').map(Number);
          const endTotal = endHours * 60 + endMins;
          const breakEndTotal = endTotal - 30;
          const breakEndHours = Math.floor(breakEndTotal / 60) % 24;
          const breakEndMins = breakEndTotal % 60;
          updatedBreak.end = `${breakEndHours.toString().padStart(2, '0')}:${breakEndMins.toString().padStart(2, '0')}`;
        }
      }
      
      return updatedBreak;
    });
    
    updateDaySchedule(day, {
      breaks: updatedBreaks,
    });
  };

  const buildSchedulesCopiedFromDay = (
    sourceDay: DayName,
    base: Record<DayName, DaySchedule>
  ): Record<DayName, DaySchedule> => {
    const sourceSchedule = base[sourceDay];
    const updated = { ...base };
    DAYS.forEach((day) => {
      if (day !== sourceDay) {
        updated[day] = {
          enabled: base[day].enabled,
          startTime: sourceSchedule.startTime,
          endTime: sourceSchedule.endTime,
          breaks: sourceSchedule.breaks.map((breakTime) => ({
            ...breakTime,
            id: `break-${Date.now()}-${Math.random()}`,
          })),
        };
      }
    });
    return updated;
  };

  const copyToAllDays = (sourceDay: DayName) => {
    setSchedules((prev) => buildSchedulesCopiedFromDay(sourceDay, prev));
  };

  const handlePanelCopyToOtherDays = (sourceDay: DayName) => {
    if (savingDay !== null || isSaving) return;
    setPreCopySnapshot((prev) => prev ?? cloneSchedules(schedules));
    copyToAllDays(sourceDay);
  };

  const handleCancelPendingCopy = () => {
    if (!preCopySnapshot) return;
    setSchedules(cloneSchedules(preCopySnapshot));
    setPreCopySnapshot(null);
  };

  const handleSavePendingCopyAllDays = async () => {
    if (isSaving || savingDay !== null) return;
    const ok = await handleSave();
    if (!ok) return;
    setPreCopySnapshot(null);
    if (editingDay) {
      setPanelSnapshot(cloneDaySchedule(schedulesRef.current[editingDay]));
    }
  };

  const applyMonFriPreset = () => {
    setSchedules((prev) => {
      const updated = { ...prev };
      WEEKDAYS.forEach((day) => {
        updated[day] = {
          enabled: true,
          startTime: "09:00",
          endTime: "17:00",
          breaks: [],
        };
      });
      WEEKEND_DAYS.forEach((day) => {
        updated[day] = {
          ...updated[day],
          enabled: false,
        };
      });
      return updated;
    });
  };

  const copyMondayToWeekdays = () => {
    setSchedules((prev) => {
      const monday = prev.Mon;
      const updated = { ...prev };
      (["Tue", "Wed", "Thu", "Fri"] as DayName[]).forEach((day) => {
        updated[day] = {
          enabled: monday.enabled,
          startTime: monday.startTime,
          endTime: monday.endTime,
          breaks: monday.breaks.map((breakTime) => ({
            ...breakTime,
            id: `break-${Date.now()}-${Math.random()}`,
          })),
        };
      });
      return updated;
    });
  };

  const isBusy = isSaving || savingDay !== null;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useImperativeHandle(
    ref,
    () => ({
      applyMonFriPreset,
      copyMondayToWeekdays,
      saveChanges: async () => {
        await handleSave();
      },
      isBusy: () => isBusy,
    }),
    // Handlers close over latest state via schedules/isBusy reads inside
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expose stable imperative API
    [isBusy, schedules, savedSchedules, isSaving, savingDay]
  );

  const revertEditingDayIfNeeded = (day: DayName | null, snapshot: DaySchedule | null) => {
    if (!day || !snapshot) return;
    setSchedules((prev) => ({
      ...prev,
      [day]: cloneDaySchedule(snapshot),
    }));
  };

  const openDayPanel = (day: DayName) => {
    if (preCopySnapshot) {
      const restored = cloneSchedules(preCopySnapshot);
      setSchedules(restored);
      setPreCopySnapshot(null);
      setPanelSnapshot(cloneDaySchedule(restored[day]));
      setEditingDay(day);
      return;
    }
    if (editingDay && editingDay !== day) {
      revertEditingDayIfNeeded(editingDay, panelSnapshot);
    }
    setPanelSnapshot(cloneDaySchedule(schedules[day]));
    setEditingDay(day);
  };

  const closeDayPanel = (revert: boolean) => {
    if (revert) {
      if (preCopySnapshot) {
        setSchedules(cloneSchedules(preCopySnapshot));
        setPreCopySnapshot(null);
      } else {
        revertEditingDayIfNeeded(editingDay, panelSnapshot);
      }
    } else {
      setPreCopySnapshot(null);
    }
    setEditingDay(null);
    setPanelSnapshot(null);
  };

  const handlePanelSave = async () => {
    if (!editingDay) return;
    if (preCopySnapshot) {
      await handleSavePendingCopyAllDays();
      closeDayPanel(false);
      return;
    }
    const ok = await handleSaveDay(editingDay);
    if (ok) {
      closeDayPanel(false);
    }
  };

  const handlePanelQuickAddBreak = () => {
    if (!editingDay) return;
    addBreak(editingDay);
  };

  const panelFieldClass =
    "w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60";

  if (isLoading) {
    return <AvailabilityGeneralSkeleton />;
  }

  const editingSchedule = editingDay ? schedules[editingDay] : null;
  const editingDayDirty =
    editingDay != null &&
    dayScheduleSignature(schedules[editingDay]) !==
      dayScheduleSignature(savedSchedules[editingDay]);

  return (
    <>
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Set your regular weekly availability. Click on a day to edit its hours and breaks.
        </p>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Day</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Working Hours</th>
                  <th className="px-4 py-3 font-semibold">Breaks</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {DAYS.map((day) => {
                  const schedule = schedules[day];
                  const isEditing = editingDay === day;
                  return (
                    <tr
                      key={day}
                      className={classNames(
                        "transition-colors",
                        isEditing ? "bg-indigo-50/40" : "hover:bg-slate-50/80"
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => openDayPanel(day)}
                          className="text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                        >
                          {DAY_NAMES[day]}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={classNames(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            schedule.enabled
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                              : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                          )}
                        >
                          {schedule.enabled ? "On" : "Off"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-700">
                        {schedule.enabled
                          ? `${formatTimeForDisplayInZones(schedule.startTime, sourceTimezone, displayTimezone)} – ${formatTimeForDisplayInZones(schedule.endTime, sourceTimezone, displayTimezone)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        {schedule.enabled && schedule.breaks.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {schedule.breaks.map((b) => (
                              <span
                                key={b.id}
                                className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                              >
                                {formatBreakRangeInZones(
                                  b.start,
                                  b.end,
                                  sourceTimezone,
                                  displayTimezone
                                )}
                              </span>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                openDayPanel(day);
                                addBreak(day);
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                              aria-label={`Add break on ${DAY_NAMES[day]}`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-400">
                              {schedule.enabled ? "No breaks" : "—"}
                            </span>
                            {schedule.enabled ? (
                              <button
                                type="button"
                                onClick={() => {
                                  openDayPanel(day);
                                  addBreak(day);
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-white hover:text-indigo-600"
                                aria-label={`Add break on ${DAY_NAMES[day]}`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openDayPanel(day)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <aside
        className={classNames(
          "fixed top-16 right-0 bottom-0 z-30 flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:w-[28rem]",
          "transform transition-transform duration-300 ease-in-out will-change-transform",
          panelAnimatedOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!editPanelVisible}
      >
        {editPanelVisible && editingDay && editingSchedule ? (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Edit {DAY_NAMES[editingDay]} Availability
              </h2>
              <button
                type="button"
                onClick={() => closeDayPanel(true)}
                className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-5">
                    <span className="text-sm font-medium text-slate-700">Available</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateDaySchedule(editingDay, {
                          enabled: !editingSchedule.enabled,
                        })
                      }
                      className={classNames(
                        "relative h-6 w-11 rounded-full transition",
                        editingSchedule.enabled ? "bg-indigo-600" : "bg-slate-300"
                      )}
                      aria-pressed={editingSchedule.enabled}
                      aria-label="Toggle available"
                    >
                      <span
                        className={classNames(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
                          editingSchedule.enabled ? "left-[22px]" : "left-0.5"
                        )}
                      />
                    </button>
                  </div>

                  <div
                    className={classNames(
                      "border-b border-slate-200 pb-5",
                      !editingSchedule.enabled && "opacity-50"
                    )}
                  >
                    <p className="mb-3 text-sm font-semibold text-slate-800">Working Hours</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-500">
                          Start Time
                        </span>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <select
                            value={editingSchedule.startTime}
                            onChange={(e) =>
                              updateDaySchedule(editingDay, { startTime: e.target.value })
                            }
                            disabled={!editingSchedule.enabled}
                            className={panelFieldClass}
                          >
                            {timeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-xs font-medium text-slate-500">
                          End Time
                        </span>
                        <div className="relative">
                          <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <select
                            value={editingSchedule.endTime}
                            onChange={(e) =>
                              updateDaySchedule(editingDay, { endTime: e.target.value })
                            }
                            disabled={!editingSchedule.enabled}
                            className={panelFieldClass}
                          >
                            {getFilteredTimeOptions(
                              editingSchedule.startTime,
                              undefined,
                              true
                            ).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className={classNames(!editingSchedule.enabled && "opacity-50")}>
                    <p className="mb-3 text-sm font-semibold text-slate-800">Breaks</p>
                    <div className="space-y-3">
                      {editingSchedule.breaks.map((breakTime) => (
                        <div
                          key={breakTime.id}
                          className="flex items-end gap-2"
                        >
                          <div className="relative min-w-0 flex-1">
                            <select
                              value={breakTime.start}
                              onChange={(e) =>
                                updateBreak(editingDay, breakTime.id, "start", e.target.value)
                              }
                              disabled={!editingSchedule.enabled}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                            >
                              {getFilteredTimeOptions(
                                editingSchedule.startTime,
                                editingSchedule.endTime,
                                true
                              ).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="mb-2.5 shrink-0 text-slate-400">–</span>
                          <div className="relative min-w-0 flex-1">
                            <select
                              value={breakTime.end}
                              onChange={(e) =>
                                updateBreak(editingDay, breakTime.id, "end", e.target.value)
                              }
                              disabled={!editingSchedule.enabled}
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-50"
                            >
                              {getFilteredTimeOptions(
                                breakTime.start,
                                editingSchedule.endTime,
                                true
                              ).map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBreak(editingDay, breakTime.id)}
                            disabled={!editingSchedule.enabled}
                            className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Remove break"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={handlePanelQuickAddBreak}
                      disabled={!editingSchedule.enabled}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" />
                      Add Break
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePanelCopyToOtherDays(editingDay)}
                    disabled={
                      !editingSchedule.enabled ||
                      savingDay !== null ||
                      isSaving
                    }
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-left transition hover:bg-indigo-100/70 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-indigo-900">
                        Copy to other days
                      </span>
                      <span className="mt-0.5 block text-xs text-indigo-700/80">
                        Apply these hours and breaks to other days of the week.
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-indigo-500" />
                  </button>

                  {preCopySnapshot ? (
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-xs text-slate-600">
                        Hours and breaks were copied to all other days. Save to
                        keep these changes, or cancel to undo the copy.
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleCancelPendingCopy}
                          disabled={isSaving || savingDay !== null}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSavePendingCopyAllDays()}
                          disabled={isSaving || savingDay !== null}
                          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? "Saving..." : "Save changes for all days"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {daySaveFeedback[editingDay] ? (
                    <div
                      className={classNames(
                        "rounded-lg border px-3 py-2 text-sm font-medium",
                        daySaveFeedback[editingDay]?.type === "success"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      )}
                    >
                      {daySaveFeedback[editingDay]?.text}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => closeDayPanel(true)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handlePanelSave()}
                    disabled={
                      savingDay === editingDay ||
                      isSaving ||
                      (!editingDayDirty && !preCopySnapshot)
                    }
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingDay === editingDay ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </aside>

      {saveMessage && !onSaveFeedback && (
        <div
          className={`mt-6 p-4 rounded-lg text-sm font-medium ${
            saveMessage.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {saveMessage.text}
        </div>
      )}
    </>
  );
});

export default AvailabilityTimesheet;