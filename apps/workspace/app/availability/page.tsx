"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  isSameDay,
  isSameWeek,
  eachDayOfInterval,
} from "date-fns";
import AvailabilityTimesheet from '@/src/components/Settings/AvailabilityTimesheet';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import { supabase } from "@/lib/supabaseClient";

type TabType = 'general' | 'availability';
type DayName = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
type BreakTime = { id: string; start: string; end: string };
type DaySchedule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
};

interface ServiceProvider {
  id: string;
  email: string;
  name: string;
}

export default function Availability() {
  const { settings, loading: settingsLoading } = useWorkspaceSettings();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [hoverDate, setHoverDate] = useState<Date | null>(null);
  const [hasSelectedDate, setHasSelectedDate] = useState(true);
  const calendarRef = useRef<HTMLDivElement>(null);
  const startWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startWeek, i));

  const [hours, setHours] = useState<number[]>(() =>
    Array.from({ length: 12 }, (_, i) => i + 8)
  );
  const [enabled, setEnabled] = useState<Record<DayName, boolean>>({
    Mon: true,
    Tue: true,
    Wed: true,
    Thu: true,
    Fri: true,
    Sat: false,
    Sun: false,
  });

  // General preset custom availability slots (keyed by day/hour)
  const [timeSlots, setTimeSlots] = useState<Record<string, boolean>>({});
  const [timesheet, setTimesheet] = useState<Record<DayName, DaySchedule> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookings, setBookings] = useState<Array<{ start_at: string; end_at: string | null; status: string | null }>>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  /** Cached full availability from settings - used to re-derive when selectedProviderId changes without re-fetching */
  const [settingsAvailability, setSettingsAvailability] = useState<{
    timesheet: Record<DayName, DaySchedule> | null;
    individual: Record<string, boolean> | undefined;
    providers: Record<string, { timesheet?: Record<DayName, DaySchedule>; individual?: Record<string, boolean> }>;
  } | null>(null);

  const formatHour = (hour: number) => {
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${displayHour.toString().padStart(2, "0")}:00 ${suffix}`;
  };

  // Helper function to create a unique key for day and hour
  const getTimeSlotKey = (dayName: DayName, hour: number, date?: Date) => {
    if (date) {
      return `${format(date, "yyyy-MM-dd")}-${hour}`;
    }
    return `${dayName}-${hour}`;
  };

  const parseTimeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const deriveAvailabilityFromTimesheet = (schedule: Record<DayName, DaySchedule>) => {
    const derivedEnabled: Record<DayName, boolean> = { ...enabled };
    const derivedSlots: Record<string, boolean> = {};
    let minMinutes = Number.POSITIVE_INFINITY;
    let maxMinutes = Number.NEGATIVE_INFINITY;

    (Object.keys(schedule) as DayName[]).forEach((day) => {
      const daySchedule = schedule[day];
      derivedEnabled[day] = !!daySchedule.enabled;

      if (!daySchedule.enabled) return;

      const startMinutes = parseTimeToMinutes(daySchedule.startTime);
      const endMinutes = parseTimeToMinutes(daySchedule.endTime);
      minMinutes = Math.min(minMinutes, startMinutes);
      maxMinutes = Math.max(maxMinutes, endMinutes);

      const startHour = Math.floor(startMinutes / 60);
      const endHour = Math.ceil(endMinutes / 60);

      for (let h = startHour; h < endHour; h += 1) {
        const blockStart = h * 60;
        const blockEnd = (h + 1) * 60;
        const insideWindow = blockStart >= startMinutes && blockEnd <= endMinutes;

        const isOnBreak =
          daySchedule.breaks?.some((b) => {
            const bStart = parseTimeToMinutes(b.start);
            const bEnd = parseTimeToMinutes(b.end);
            return bStart < blockEnd && bEnd > blockStart;
          }) ?? false;

        if (insideWindow && !isOnBreak) {
          derivedSlots[getTimeSlotKey(day, h)] = true;
        }
      }
    });

    if (!Number.isFinite(minMinutes) || !Number.isFinite(maxMinutes)) {
      return {
        enabled: derivedEnabled,
        timeSlots: derivedSlots,
        hours: hours,
      };
    }

    const startHour = Math.floor(minMinutes / 60);
    const endHour = Math.ceil(maxMinutes / 60);
    const derivedHours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);

    return {
      enabled: derivedEnabled,
      timeSlots: derivedSlots,
      hours: derivedHours,
    };
  };

  const isTimeSlotActive = (dayName: DayName, hour: number, date?: Date): boolean => {
    const key = getTimeSlotKey(dayName, hour, date);

    // For date-specific slots, check timeSlots first (date-based overrides)
    if (date && timeSlots[key] !== undefined) {
      return timeSlots[key];
    }

    // For weekday-based slots, check enabled state
    if (!date && !enabled[dayName]) return false;
    
    // For date-specific slots, check if the date is explicitly disabled
    if (date) {
      // Check if all time slots for this date are explicitly disabled
      const dateKey = format(date, "yyyy-MM-dd");
      const allSlotsDisabled = hours.every((h) => {
        const slotKey = `${dateKey}-${h}`;
        return timeSlots[slotKey] === false;
      });
      if (allSlotsDisabled) return false;
    }

    // Check timeSlots for weekday-based slots
    if (!date && timeSlots[key] !== undefined) {
      return timeSlots[key];
    }

    const schedule = timesheet?.[dayName];
    if (!schedule || !schedule.enabled) return false;

    const blockStart = hour * 60;
    const blockEnd = (hour + 1) * 60;
    const startMinutes = parseTimeToMinutes(schedule.startTime);
    const endMinutes = parseTimeToMinutes(schedule.endTime);
    const insideWindow = blockStart >= startMinutes && blockEnd <= endMinutes;

    const isOnBreak =
      schedule.breaks?.some((b) => {
        const bStart = parseTimeToMinutes(b.start);
        const bEnd = parseTimeToMinutes(b.end);
        return bStart < blockEnd && bEnd > blockStart;
      }) ?? false;

    return insideWindow && !isOnBreak;
  };

  // Check if a time slot is in the past
  const isPastSlot = (day: Date) => {
    const today = new Date();
    const slotDate = new Date(day);

    // Compare dates only (ignore hours/time)
    slotDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    return slotDate < today; // Disable only if day is before today
  };

  // Check if a specific date+hour slot is in the past (day or hour has passed)
  const isPastTimeSlot = (date: Date, hour: number): boolean => {
    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    return slotStart.getTime() < Date.now();
  };

  // Check if a time slot is booked
  const isTimeSlotBooked = (date: Date, hour: number): boolean => {
    if (!date || bookings.length === 0) return false;

    const slotStart = new Date(date);
    slotStart.setHours(hour, 0, 0, 0);
    const slotEnd = new Date(date);
    slotEnd.setHours(hour + 1, 0, 0, 0);

    return bookings.some((booking) => {
      // Skip cancelled bookings
      if (booking.status === 'cancelled') return false;

      const bookingStart = new Date(booking.start_at);
      const bookingEnd = booking.end_at ? new Date(booking.end_at) : new Date(bookingStart);

      // Check if time slots overlap: slotStart < bookingEnd && slotEnd > bookingStart
      return slotStart < bookingEnd && slotEnd > bookingStart;
    });
  };


  // Check if a specific date is disabled (all time slots are false)
  const isDateDisabled = (date: Date, dayName: DayName): boolean => {
    const dateKey = format(date, "yyyy-MM-dd");
    const dateSlots = hours.map((h) => {
      const slotKey = `${dateKey}-${h}`;
      return timeSlots[slotKey];
    });
    
    // If all slots are explicitly set to false, the date is disabled
    const allExplicitlyDisabled = dateSlots.every((slot) => slot === false);
    if (allExplicitlyDisabled) return true;
    
    // If no date-specific overrides exist, check weekday availability
    const hasDateOverrides = dateSlots.some((slot) => slot !== undefined);
    if (!hasDateOverrides) {
      // Check timesheet first (if available and has this day configured), then fall back to enabled state
      if (timesheet && timesheet[dayName] !== undefined) {
        return !timesheet[dayName].enabled;
      }
      return !enabled[dayName];
    }
    
    return false;
  };

  // Toggle all time slots for a specific date
  const toggleDateAvailability = (date: Date, dayName: DayName) => {
    if (isPastSlot(date)) return;
    
    const dateKey = format(date, "yyyy-MM-dd");
    const currentlyDisabled = isDateDisabled(date, dayName);
    
    if (currentlyDisabled) {
      // Enable the date: remove date-specific overrides to fall back to timesheet/weekday availability
      setTimeSlots((prev) => {
        const updated = { ...prev };
        hours.forEach((h) => {
          const slotKey = `${dateKey}-${h}`;
          delete updated[slotKey];
        });
        return updated;
      });
    } else {
      // Disable the date: set all slots to false (date-specific override)
      const newSlots: Record<string, boolean> = {};
      hours.forEach((h) => {
        const slotKey = `${dateKey}-${h}`;
        newSlots[slotKey] = false;
      });
      setTimeSlots((prev) => ({ ...prev, ...newSlots }));
    }
  };

  // Toggle individual time slot
  const toggleTimeSlot = (dayName: DayName, hour: number, date?: Date) => {
    // Prevent toggling booked slots
    if (date && isTimeSlotBooked(date, hour)) return;

    // For date-specific slots, disallow toggling past slots
    if (date) {
      if (isPastTimeSlot(date, hour)) return;
      const key = getTimeSlotKey(dayName, hour, date);
      setTimeSlots((prev) => ({
        ...prev,
        [key]: !isTimeSlotActive(dayName, hour, date),
      }));
      return;
    }

    // For weekday-based slots, check enabled state
    if (!enabled[dayName]) return;
    const key = getTimeSlotKey(dayName, hour, date);
    setTimeSlots((prev) => ({
      ...prev,
      [key]: !isTimeSlotActive(dayName, hour, date),
    }));
  };

  // Save availability handler
  const handleSaveAvailability = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const token = session.access_token;

      // First, get existing settings to avoid overwriting other data
      const getResponse = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });

      let existingSettings = {};
      if (getResponse.ok) {
        const payload = await getResponse.json();
        existingSettings = payload?.settings ?? payload?.data?.settings ?? {};
      }

      const existingAvailability = (existingSettings as any).availability ?? {};

      let updatedSettings;

      // If a specific provider is selected, save as provider-specific override
      if (selectedProviderId) {
        const providerAvailabilityData = {
          timesheet: timesheet,
          individual: timeSlots,
          lastUpdated: new Date().toISOString(),
        };

        const existingProviders = existingAvailability.providers ?? {};

        updatedSettings = {
          ...existingSettings,
          availability: {
            ...existingAvailability,
            providers: {
              ...existingProviders,
              [selectedProviderId]: providerAvailabilityData,
            },
          },
        };
      } else {
        // Save as general/workspace-wide availability (template for all providers)
        updatedSettings = {
          ...existingSettings,
          availability: {
            ...existingAvailability,
            timesheet: timesheet,
            individual: timeSlots,
            lastUpdated: new Date().toISOString(),
          },
        };
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          settings: updatedSettings,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save availability');
      }

      const saveTarget = selectedProviderId 
        ? `for provider ${serviceProviders.find(p => p.id === selectedProviderId)?.name || 'selected provider'}`
        : 'as general availability (applies to all providers)';

      setSaveMessage({ type: 'success', text: `Availability saved successfully ${saveTarget}!` });
      setTimeout(() => {
        setSaveMessage(null);
      }, 3000);

      console.log("Availability saved:", saveTarget);
    } catch (error) {
      console.error("Error saving availability:", error);
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to save availability. Please try again.'
      });

      setTimeout(() => {
        setSaveMessage(null);
      }, 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const buttonBase = "px-4 py-2 rounded-xl text-sm font-medium transition duration-200";
  const primaryBtn = `${buttonBase} bg-indigo-600 text-white hover:bg-indigo-800`;
  const outlineBtn = `${buttonBase} border border-slate-300 text-slate-600 hover:bg-slate-100`;


  // disable the prev date function
  const isPrevDisabled = () => { const today = new Date();
    if (viewMode === "week") {
      return startOfWeek(currentDate, { weekStartsOn: 1 }) <= startOfWeek(today, { weekStartsOn: 1 });
    }
    return currentDate <= today;
  };

  useEffect(() => {
    setCalendarMonth(currentDate);
    setHoverDate(null);
  }, [currentDate]);

  // Handle click outside calendar to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarOpen && calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setCalendarOpen(false);
      }
    };

    if (calendarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [calendarOpen]);

  // Apply merged availability from cached settings for a given providerId (no fetch)
  const applyAvailabilityForProvider = (avail: NonNullable<typeof settingsAvailability>, providerId: string) => {
    const generalTimesheet = avail.timesheet;
    const generalIndividual = avail.individual;
    const providerOverrides = avail.providers[providerId] ?? {};
    const providerTimesheet = providerOverrides.timesheet as Record<DayName, DaySchedule> | null;
    const providerIndividual = providerOverrides.individual as Record<string, boolean> | undefined;
    const finalTimesheet = generalTimesheet ? { ...generalTimesheet, ...(providerTimesheet || {}) } : providerTimesheet;
    const finalIndividual = { ...(generalIndividual || {}), ...(providerIndividual || {}) };

    if (finalTimesheet) {
      setTimesheet(finalTimesheet);
      const derived = deriveAvailabilityFromTimesheet(finalTimesheet);
      setHours(derived.hours);
      setEnabled(derived.enabled);
      setTimeSlots(Object.keys(finalIndividual).length ? finalIndividual : derived.timeSlots);
    } else {
      setTimesheet(null);
      setEnabled({ Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false });
      setTimeSlots(finalIndividual || {});
      setHours(Array.from({ length: 12 }, (_, i) => i + 8));
    }
  };

  // Use settings from WorkspaceSettingsProvider (single fetch app-wide). Only fetch team-members here.
  useEffect(() => {
    if (settingsLoading) return;

    const av = settings?.availability as typeof settingsAvailability | undefined;
    const availability: NonNullable<typeof settingsAvailability> = {
      timesheet: (av?.timesheet ?? null) as Record<DayName, DaySchedule> | null,
      individual: av?.individual as Record<string, boolean> | undefined,
      providers: (av?.providers ?? {}) as NonNullable<typeof settingsAvailability>['providers'],
    };
    setSettingsAvailability(availability);
  }, [settings, settingsLoading]);

  useEffect(() => {
    let cancelled = false;

    const loadTeamMembers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;

        const token = session.access_token;
        const userId = session.user.id;
        const userRole = session.user.user_metadata?.role || '';
        setCurrentUserId(userId);
        setCurrentUserRole(userRole);

        const teamRes = await fetch("/api/team-members", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        let initialProviderId = selectedProviderId;
        if (teamRes.ok) {
          const data = await teamRes.json();
          const providersList = (data.teamMembers || []).filter(
            (m: { role: string; deactivated?: boolean }) => m.role === 'service_provider' && !m.deactivated
          ) as ServiceProvider[];
          setServiceProviders(providersList);
          if (userRole === 'service_provider') {
            initialProviderId = userId;
          } else if (providersList.length > 0 && !initialProviderId) {
            initialProviderId = providersList[0].id;
          }
        }
        if (userRole === 'service_provider') {
          initialProviderId = userId;
        }

        if (cancelled) return;
        setSelectedProviderId(initialProviderId);
      } catch (error) {
        if (!cancelled) console.error("Error loading team members:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadTeamMembers();
    return () => { cancelled = true; };
  }, []);

  // Re-derive when selectedProviderId or settingsAvailability changes (no fetch)
  useEffect(() => {
    if (!settingsAvailability) return;
    applyAvailabilityForProvider(settingsAvailability, selectedProviderId);
  }, [selectedProviderId, settingsAvailability]);

  // Load bookings for the current view
  useEffect(() => {
    if (activeTab !== 'availability' || !hasSelectedDate || !selectedProviderId) return;

    const loadBookings = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        let datesToFetch: Date[];

        if (viewMode === 'week') {
          const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
          datesToFetch = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        } else {
          datesToFetch = [new Date(currentDate)];
        }

        // Fetch bookings for each date in parallel
        const bookingPromises = datesToFetch.map(async (date) => {
          const params = new URLSearchParams({
            date: format(date, 'yyyy-MM-dd'),
            service_provider_id: selectedProviderId, // Filter by selected provider
          });

          const response = await fetch(`/api/bookings?${params.toString()}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });

          if (!response.ok) {
            return [];
          }

          const result = await response.json();
          return result?.data || [];
        });

        const bookingArrays = await Promise.all(bookingPromises);
        const allBookings = bookingArrays.flat();

        // Filter out cancelled bookings and format
        const filteredBookings = allBookings
          .filter((booking: { start_at: string; status: string | null; service_provider_id: string }) => {
            return booking.status !== 'cancelled' && booking.service_provider_id === selectedProviderId;
          })
          .map((booking: { start_at: string; end_at: string | null; status: string | null }) => ({
            start_at: booking.start_at,
            end_at: booking.end_at,
            status: booking.status,
          }));

        setBookings(filteredBookings);
      } catch (error) {
        console.error("Error loading bookings:", error);
      }
    };

    loadBookings();
  }, [currentDate, viewMode, activeTab, hasSelectedDate, selectedProviderId]);

  const handleViewToggle = (mode: "week" | "day") => {
    if (mode === viewMode) {
      if (mode === "week") {
        setCalendarOpen((prev) => !prev);
      }
      return;
    }

    setViewMode(mode);
    setHoverDate(null);
    setHasSelectedDate(true);
    setCalendarOpen(mode === "week");
  };

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [calendarMonth]);

  return (
    <section className="space-y-6 mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Availability Timesheet</h3>
          <p className="text-xs text-slate-500">Manage your availability settings and schedule.</p>
        </div>

        <div className="border-b border-slate-200">
          <nav className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('general')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'general'
                  ? 'text-white bg-indigo-600'
                  : 'text-slate-600 bg-white hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('availability')}
              className={`flex-1 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'availability'
                  ? 'text-white bg-indigo-600'
                  : 'text-slate-600 bg-white hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              Availability
            </button>
          </nav>
        </div>
      </header>
      
      {/* Tabs */}
      <div className="rounded-2xl border border-slate-100 overflow-hidden">
        <div className="relative">
          {activeTab === 'general' && (
            <div className="mt-0 pt-6">
              {settingsLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-500">Loading...</div>
              ) : (
                <AvailabilityTimesheet
                  initialTimesheet={settingsAvailability?.timesheet ?? null}
                />
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <div className="bg-white p-6 shadow-md space-y-4 sm:space-y-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-2">
                {/* Filters */}
                <div className="w-full flex justify-between flex-col sm:flex-row gap-2 sm:gap-3">
                  <div className="relative" ref={calendarRef}>
                    <div className={`flex justify-between rounded-xl border text-sm font-medium overflow-hidden touch-manipulation border-slate-300 bg-white text-slate-600`}>
                      {["week", "day"].map((mode) => (
                        <button key={mode} type="button" onClick={() => handleViewToggle(mode as "week" | "day")} className={`sm:w-40 w-full px-4 py-2.5 sm:py-2 transition ${ viewMode === mode ? "bg-indigo-600 text-white" : "hover:bg-slate-100" }`} aria-pressed={viewMode === mode} aria-expanded={viewMode === mode && calendarOpen} >
                          {mode === "week" ? "Week View" : "Day View"}
                        </button>
                      ))}
                    </div>

                    {calendarOpen && (
                      <div className={`calender-block absolute left-0  sm:right-auto sm:left-0 top-full mt-2 w-full sm:w-auto min-w-[280px] grid gap-2 rounded-2xl overflow-hidden border text-sm z-50 shadow-lg border-slate-200 bg-white text-slate-700`} >
                        <div className="px-4 py-2 bg-indigo-600 text-white flex items-center justify-between">
                          <button type="button" onClick={() => setCalendarMonth((prev) => subMonths(prev, 1))} className="text-xs cursor-pointer hover:bg-white hover:text-indigo-600 font-semibold px-2 py-1 rounded-lg disabled:opacity-40">
                            Prev
                          </button>
                          <div className="text-sm font-semibold">{format(calendarMonth, "MMMM yyyy")}</div>
                          <button type="button" onClick={() => setCalendarMonth((prev) => addMonths(prev, 1))} className="text-xs cursor-pointer hover:bg-white hover:text-indigo-600 font-semibold px-2 py-1 rounded-lg disabled:opacity-40">
                            Next
                          </button>
                        </div>

                        <div className="px-4 grid grid-cols-7 text-[11px] uppercase tracking-wide text-center">
                          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                            <span key={day} className="font-semibold">{day}</span>
                          ))}
                        </div>

                        <div className="px-4 pb-4 grid grid-cols-7">
                          {calendarDays.map((day) => {
                            const isInactiveMonth = !isSameMonth(day, calendarMonth);
                            const isPast = isPastSlot(day);
                            const referenceDate = hoverDate ?? currentDate;
                            const isActive =
                              viewMode === "week"
                                ? isSameWeek(day, referenceDate, { weekStartsOn: 1 })
                                : isSameDay(day, referenceDate);

                            return (
                              <button
                                key={day.toISOString()}
                                type="button"
                                onMouseEnter={() => setHoverDate(day)}
                                onMouseLeave={() => setHoverDate(null)}
                                onClick={() => { const targetDate = viewMode === "week" ? startOfWeek(day, { weekStartsOn: 1 }) : day; setCurrentDate(targetDate); setCalendarMonth(targetDate); setHoverDate(null); setCalendarOpen(false); setHasSelectedDate(true); }}
                                disabled={isPast}
                                className={`text-xs sm:text-sm p-1 transition border ${ isActive ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200" } ${ isInactiveMonth ? "opacity-50" : "" } ${ isPast ? "cursor-not-allowed opacity-40" : "hover:bg-[var(--theme-primary-soft)] hover:text-indigo-600" }`}>
                                {format(day, "d")}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Service Provider Filter Dropdown */}
                  <div className="w-full sm:w-auto sm:min-w-[280px]">
                    <select
                      value={selectedProviderId}
                      onChange={(e) => setSelectedProviderId(e.target.value)}
                      disabled={currentUserRole === 'service_provider'}
                      className="w-full px-3 py-2.5 sm:py-2 rounded-lg border border-slate-300 text-sm bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {currentUserRole === 'service_provider' ? (
                        <option value={selectedProviderId}>
                          {serviceProviders.find(p => p.id === selectedProviderId)?.name || 'Your Availability'}
                        </option>
                      ) : (
                        <>
                          <option value="">General Availability (All Providers)</option>
                          {serviceProviders.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name} (Individual)
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {currentUserRole !== 'service_provider' && !selectedProviderId && (
                      <p className="text-xs text-slate-500 mt-1">
                        General availability applies to all providers unless individually overridden
                      </p>
                    )}
                    {currentUserRole !== 'service_provider' && selectedProviderId && (
                      <p className="text-xs text-slate-500 mt-1">
                        Individual overrides for this provider only
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {hasSelectedDate && (
                <>
                  {/* Date Navigation */}
                  <div className="flex items-center gap-2 sm:gap-3 justify-between">
                    <button className={`${outlineBtn} text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-2 touch-manipulation ${isPrevDisabled() ? "opacity-50 cursor-not-allowed" : ""}`} disabled={isPrevDisabled()} onClick={() => { if (!isPrevDisabled()) { setCurrentDate((date) => (viewMode === "week" ? subDays(date, 7) : subDays(date, 1))); setHasSelectedDate(true);} }}>Prev</button>

                    <div className="text-md sm:text-md text-center font-semibold px-2">
                      {viewMode === "week" ? `${format(startWeek, "dd MMM")} – ${format( endOfWeek(currentDate, { weekStartsOn: 1 }), "dd MMM yyyy")}` : format(currentDate, "EEE, dd MMM yyyy")}
                    </div>

                    <button className={`${outlineBtn} text-xs sm:text-sm px-3 sm:px-4 py-2.5 sm:py-2 touch-manipulation`} onClick={() => { setCurrentDate((date) => (viewMode === "week" ? addDays(date, 7) : addDays(date, 1))); setHasSelectedDate(true); }}>Next</button>
                  </div>

                  {/* Availability Grid - Mobile Vertical Layout / Desktop Horizontal Scroll */}
                  <div className="rounded-2xl overflow-hidden border border-gray-200">
                    {/* Desktop Week View - Horizontal Scroll */}
                    {viewMode === "week" && (
                      <>
                        {/* Desktop Grid View */}
                        <div className="hidden lg:block overflow-x-auto">
                          {/* Hours Header */}
                          <div className="grid grid-cols-[100px_repeat(12,minmax(80px,1fr))]">
                            <div></div>
                            {hours.map((h) => (
                              <div
                                key={h}
                                className="text-xs px-2 py-3 text-center text-slate-500 font-medium min-w-[80px]"
                              >
                                {formatHour(h)}
                              </div>
                            ))}
                          </div>

                          {/* Week Days */}
                          {weekDays.map((day) => {
                            const dayName = format(day, "EEE") as DayName;
                            return (
                              <div key={dayName} className="grid grid-cols-[100px_repeat(12,minmax(80px,1fr))]">
                                <div className="px-2 py-2 border-t border-gray-200 bg-gray-50 sticky left-0 z-10">
                                  <div>
                                    <span className="text-xs font-medium">{format(day, "EEE")}</span>
                                    <span className="text-[10px] ml-1 text-slate-500">{format(day, "dd MMM")}</span>
                                  </div>
                                  <label className={`inline-flex items-center mt-1 ${ isPastSlot(day) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <input type="checkbox" checked={!isDateDisabled(day, dayName) && !isPastSlot(day)} disabled={isPastSlot(day)} onChange={() => !isPastSlot(day) && toggleDateAvailability(day, dayName)} className="sr-only"/>

                                    <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(day) && !isDateDisabled(day, dayName) ? "bg-emerald-500" : "bg-slate-300" }`}>
                                      <div
                                        className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${
                                          !isPastSlot(day) && !isDateDisabled(day, dayName) ? "translate-x-4" : "translate-x-0"
                                        }`}
                                      ></div>
                                    </div>
                                  </label>
                                </div>

                                {hours.map((h) => {
                                  const active = isTimeSlotActive(dayName, h, day);
                                  const isPast = isPastTimeSlot(day, h);
                                  const isBooked = isTimeSlotBooked(day, h);

                                  return (
                                    <div
                                      key={h}
                                      className={`h-full border-t border-r border-gray-200 relative min-w-[80px] transition-opacity
                                      ${isPast || isBooked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
                                      `}
                                      onClick={() => {
                                        if (!isPast && !isBooked) toggleTimeSlot(dayName, h, day);
                                      }}
                                    >
                                      <div
                                        className={`absolute inset-1 rounded-lg border flex items-center justify-center
                                          ${isPast ? "bg-slate-300/60 border-slate-400" : isBooked ? "bg-red-400/50 border-red-500" : active ? "bg-indigo-600/50 border-indigo-600" : "bg-gray-200 border-transparent"}
                                        `}
                                      >
                                        {isBooked && (
                                          <span className="text-[10px] font-medium text-red-800">Booked</span>
                                        )}
                                        {isPast && !isBooked && (
                                          <span className="text-[10px] text-slate-500">Past</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>

                        {/* Mobile Vertical Card View */}
                        <div className="lg:hidden space-y-3 p-3">
                          {weekDays.map((day) => { const dayName = format(day, "EEE") as DayName;
                            return (
                              <div key={dayName} className="border border-gray-200 rounded-lg p-3 bg-white">
                                {/* Day Header */}
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <p className="text-sm font-semibold">{format(day, "EEE")}</p>
                                    <p className="text-xs text-slate-500">{format(day, "dd MMM yyyy")}</p>
                                  </div>
                                  <label className={`inline-flex items-center ${ isPastSlot(day) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                    <input type="checkbox" checked={!isDateDisabled(day, dayName) && !isPastSlot(day)} disabled={isPastSlot(day)} onChange={() => !isPastSlot(day) && toggleDateAvailability(day, dayName)} className="sr-only" />
                                    <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(day) && !isDateDisabled(day, dayName) ? "bg-emerald-500" : "bg-slate-300" }`}>
                                      <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(day) && !isDateDisabled(day, dayName) ? "translate-x-4" : "translate-x-0" }`}></div>
                                    </div>
                                  </label>
                                </div>

                                {/* Time Slots Grid */}
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                  {hours.map((h) => {
                                    const active = isTimeSlotActive(dayName, h, day);
                                    const isPast = isPastTimeSlot(day, h);
                                    const isBooked = isTimeSlotBooked(day, h);
                                    return (
                                      <div
                                        key={h}
                                        className={`p-2 rounded-lg text-center text-xs border-2 transition
                                          ${
                                            isPast || isBooked
                                              ? isBooked 
                                                ? "bg-red-200 border-red-400 text-red-700 cursor-not-allowed"
                                                : "bg-slate-200 border-slate-400 text-slate-500 cursor-not-allowed"
                                              : active
                                              ? "bg-indigo-600/20 border-indigo-600 text-indigo-600 font-medium cursor-pointer hover:opacity-80"
                                              : "bg-gray-100 border-gray-200 text-slate-500 cursor-pointer hover:opacity-80"
                                          }
                                        `}
                                        onClick={() => { if (!isPast && !isBooked) toggleTimeSlot(dayName, h, day); }}
                                      >
                                        <div>{formatHour(h)}</div>
                                        <div className="text-[10px] leading-tight mt-1">
                                          {isBooked ? "Booked" : isPast ? "Past" : active ? "Available" : "Unavailable"}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Day View */}
                    {viewMode === "day" && (() => { const dayName = format(currentDate, "EEE") as DayName;
                      return (
                        <>
                          {/* Desktop Day View */}
                          <div className="hidden md:block">
                            <div className="grid grid-cols-[100px_repeat(12,minmax(0,1fr))]">
                              <div className="px-3 py-3 border-t border-gray-200 bg-gray-50">
                                <span className="text-xs font-medium">{format(currentDate, "EEE")}</span>
                                <span className="text-[10px] ml-1 text-slate-500">{format(currentDate, "dd MMM")}</span>
                                <label className={`inline-flex items-center mt-2 ${ isPastSlot(currentDate) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                  <input type="checkbox" checked={!isDateDisabled(currentDate, dayName) && !isPastSlot(currentDate)} disabled={isPastSlot(currentDate)} onChange={() => !isPastSlot(currentDate) && toggleDateAvailability(currentDate, dayName)} className="sr-only" />
                                  <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(currentDate) && !isDateDisabled(currentDate, dayName) ? "bg-emerald-500" : "bg-slate-300" }`}>
                                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(currentDate) && !isDateDisabled(currentDate, dayName) ? "translate-x-4" : "translate-x-0" }`}></div>
                                  </div>
                                </label>
                              </div>

                              {hours.map((h) => {
                                const active = isTimeSlotActive(dayName, h, currentDate);
                                const isPast = isPastTimeSlot(currentDate, h);
                                const isBooked = isTimeSlotBooked(currentDate, h);
                                return (
                                  <div
                                    key={h}
                                    className={`h-full border-t border-r border-gray-200 relative transition-opacity
                                    ${isPast || isBooked ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}
                                    `}
                                    onClick={() => {
                                      if (!isPast && !isBooked) toggleTimeSlot(dayName, h, currentDate);
                                    }}
                                  >
                                    <div className="absolute top-1 left-1 right-1 text-xs text-slate-500 font-medium flex items-center justify-between gap-1">
                                      <span>{formatHour(h)}</span>
                                    </div>
                                    <div
                                      className={`absolute inset-1 mt-6 rounded-lg border flex items-center justify-center
                                      ${isPast ? "bg-slate-300/60 border-slate-400" : isBooked ? "bg-red-400/50 border-red-500" : active ? "bg-indigo-600/50 border-indigo-600" : "bg-gray-200 border-transparent"}
                                      `}
                                    >
                                      {isBooked && (
                                        <span className="text-[10px] font-medium text-red-800">Booked</span>
                                      )}
                                      {isPast && !isBooked && (
                                        <span className="text-[10px] text-slate-500">Past</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Mobile Day View */}
                          <div className="md:hidden p-4">
                            <div className="mb-4 flex items-center justify-between">
                              <div>
                                <p className="text-base font-semibold">{format(currentDate, "EEE")}</p>
                                <p className="text-sm text-slate-500">{format(currentDate, "dd MMM yyyy")}</p>
                              </div>
                              <label className={`inline-flex items-center ${ isPastSlot(currentDate) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                                <input type="checkbox" checked={!isDateDisabled(currentDate, dayName) && !isPastSlot(currentDate)} disabled={isPastSlot(currentDate)} onChange={() => !isPastSlot(currentDate) && toggleDateAvailability(currentDate, dayName)} className="sr-only" />
                                <div className={`w-9 h-5 rounded-full p-1 transition ${ !isPastSlot(currentDate) && !isDateDisabled(currentDate, dayName) ? "bg-emerald-500" : "bg-slate-300" }`}>
                                  <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition ${ !isPastSlot(currentDate) && !isDateDisabled(currentDate, dayName) ? "translate-x-4" : "translate-x-0" }`}></div>
                                </div>
                              </label>
                            </div>

                            {/* Time Slots Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {hours.map((h) => {
                                const active = isTimeSlotActive(dayName, h, currentDate);
                                const isPast = isPastTimeSlot(currentDate, h);
                                const isBooked = isTimeSlotBooked(currentDate, h);
                                return (
                                  <div
                                    key={h}
                                    className={`p-3 rounded-lg text-center border-2 transition
                                      ${
                                        isPast || isBooked
                                          ? isBooked
                                            ? "bg-red-200 border-red-400 text-red-700 cursor-not-allowed"
                                            : "bg-slate-200 border-slate-400 text-slate-500 cursor-not-allowed"
                                          : active
                                          ? "bg-indigo-600/20 border-indigo-600 text-indigo-600 font-semibold cursor-pointer hover:opacity-80"
                                          : "bg-gray-100 border-gray-200 text-slate-600 cursor-pointer hover:opacity-80"
                                      }
                                    `}
                                    onClick={() => {
                                      if (!isPast && !isBooked) toggleTimeSlot(dayName, h, currentDate);
                                    }}
                                  >
                                    <div className="text-base font-medium">{formatHour(h)}</div>
                                    <div className="text-[10px] mt-1">
                                      {isBooked ? "Booked" : isPast ? "Past" : active ? "Available" : "Unavailable"}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Save Message */}
              {saveMessage && (
                <div className={`p-3 rounded-lg text-sm font-medium ${ saveMessage.type === 'success'  ? 'bg-green-50 text-green-700 border  border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                  {saveMessage.text}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2">
                <button onClick={handleSaveAvailability} disabled={isSaving || isLoading} className={`${primaryBtn} w-full sm:w-auto py-3 sm:py-2 touch-manipulation cursor-pointer ${ isSaving || isLoading ? 'opacity-50  cursor-not-allowed' : '' }`}>{isSaving ? 'Saving...' : isLoading ? 'Loading...' : 'Save availability'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
