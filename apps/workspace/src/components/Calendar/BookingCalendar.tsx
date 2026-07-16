"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuCalendarDays as CalendarDays,
  LuChevronDown as ChevronDown,
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
  LuPlus as Plus,
} from "react-icons/lu";
import type { Booking } from "@/src/types/booking";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { CUSTOMER_TIMEZONE_OPTIONS } from "@/src/constants/timezone";
import {
  formatTimezoneSelectLabel,
  getBrowserTimezone,
} from "@/src/utils/timezone";
import { getLocalTimePartsInTimezone } from "@/lib/date-timezone";
import { TimezoneSelector } from "@/src/components/ui/TimezoneSelector";
import {
  CalendarFiltersBar,
  type CalendarStatusFilterOption,
} from "@/src/components/Calendar/CalendarFiltersBar";
import { CalendarDayGrid } from "@/src/components/Calendar/CalendarDayGrid";
import { CalendarMonthGrid } from "@/src/components/Calendar/CalendarMonthGrid";
import { CalendarWeekGrid } from "@/src/components/Calendar/CalendarWeekGrid";
import { CalendarSidebar } from "@/src/components/Calendar/CalendarSidebar";
import {
  buildCalendarCells,
  CALENDAR_STATUS_LEGEND,
  filterBookingsBySearch,
  getStatusDotClass,
  toDateKey,
  WEEK_DAYS,
} from "@/src/components/Calendar/calendar_utils";

type BookingApiResponse = {
  data?: Booking[];
};

type DepartmentsApiResponse = {
  departments?: Array<{
    id: number | string;
    name: string;
  }>;
};

type TeamMembersApiResponse = {
  teamMembers?: Array<{
    id: string;
    name?: string;
    avatar_url?: string | null;
    departments?: number[];
    role?: string | null;
    deactivated?: boolean;
  }>;
};

type DayProviderColumn = {
  key: string;
  label: string;
  department?: string;
  avatarUrl?: string | null;
};

type CalendarViewMode = "day" | "month" | "week" | "provider";

type SidebarSummary = {
  total: number;
  confirmed: number;
  completed: number;
  pending: number;
  cancelled: number;
  reschedule: number;
  noShow: number;
};

/**
 * Re-anchor an instant so its browser-local wall clock matches the wall clock
 * in the given timezone. Display-only: grids read times via local Date getters.
 */
function shift_iso_to_timezone_wall_clock(iso: string, timezone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return iso;
  try {
    const parts = getLocalTimePartsInTimezone(iso, timezone);
    const [year, month, day] = parts.dateStr.split("-").map(Number);
    const shifted = new Date(
      year,
      month - 1,
      day,
      parts.hours,
      parts.minutes,
      instant.getSeconds(),
      instant.getMilliseconds(),
    );
    return shifted.toISOString();
  } catch {
    return iso;
  }
}

function group_bookings_by_day(bookings: Booking[]): Record<string, Booking[]> {
  const grouped: Record<string, Booking[]> = {};

  for (const booking of bookings) {
    if (!booking.start_at) continue;
    const key = toDateKey(new Date(booking.start_at));
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(booking);
  }

  for (const items of Object.values(grouped)) {
    items.sort((a, b) => {
      const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
      const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
      return aTime - bTime;
    });
  }

  return grouped;
}

function start_of_month(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function to_filter_id(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value).trim();
}

function get_status_summary(bookings: Booking[]): SidebarSummary {
  return bookings.reduce<SidebarSummary>(
    (acc, booking) => {
      const status = (booking.status ?? "").toLowerCase();
      acc.total += 1;
      if (status === "confirmed") acc.confirmed += 1;
      if (status === "completed") acc.completed += 1;
      if (status === "pending") acc.pending += 1;
      if (status === "cancelled") acc.cancelled += 1;
      if (status === "reschedule") acc.reschedule += 1;
      if (status === "no_show" || status === "no-show" || status === "noshow") {
        acc.noShow += 1;
      }
      return acc;
    },
    {
      total: 0,
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      reschedule: 0,
      noShow: 0,
    },
  );
}

function start_of_week(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

function start_of_day(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export default function BookingCalendar() {
  const { open: open_create_booking } = useCreateBookingModal();
  const { general, settings } = useWorkspaceSettings();
  const today = new Date();
  const browser_timezone = useMemo(() => getBrowserTimezone(), []);
  const workspace_timezone =
    (general?.timezone ?? settings.general?.timezone ?? "").trim();
  const source_timezone = workspace_timezone || browser_timezone;

  const timezone_options = useMemo(() => {
    const set = new Set<string>([
      ...CUSTOMER_TIMEZONE_OPTIONS,
      source_timezone,
      browser_timezone,
    ]);
    return Array.from(set).sort((a, b) =>
      formatTimezoneSelectLabel(a).localeCompare(formatTimezoneSelectLabel(b)),
    );
  }, [source_timezone, browser_timezone]);

  // Display-only selection: bookings are re-rendered in this timezone.
  const [displayTimezone, setDisplayTimezone] = useState<string | null>(null);
  const selectedTimezone = displayTimezone ?? source_timezone;
  const timezoneLabel = selectedTimezone;
  const [viewDate, setViewDate] = useState(() => start_of_month(new Date()));
  const [viewMode, setViewMode] = useState<CalendarViewMode>("month");
  const [showMonthOptions, setShowMonthOptions] = useState(false);
  const [showDayPicker, setShowDayPicker] = useState(false);
  const [dayPickerMonth, setDayPickerMonth] = useState(() =>
    start_of_month(new Date()),
  );
  const todayCellRef = useRef<HTMLDivElement | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement | null>(null);
  const dayPickerRef = useRef<HTMLDivElement | null>(null);
  const appointmentDetailsRef = useRef<HTMLDivElement | null>(null);
  const [scroll_to_today, set_scroll_to_today] = useState(false);
  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CalendarStatusFilterOption>("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [departmentNameById, setDepartmentNameById] = useState<
    Record<string, string>
  >({});
  const [providerMetaById, setProviderMetaById] = useState<
    Record<
      string,
      {
        avatarUrl: string | null;
        departmentIds: number[];
      }
    >
  >({});
  const [refreshKey, setRefreshKey] = useState(0);

  const monthLabel = useMemo(
    () =>
      viewDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewDate],
  );
  const monthOptions = useMemo(() => {
    const baseToday = new Date();
    const currentYear = baseToday.getFullYear();
    const startMonth = baseToday.getMonth();

    return Array.from({ length: 12 - startMonth }, (_, index) => {
      const month = startMonth + index;
      const date = new Date(currentYear, month, 1);
      return {
        value: `${currentYear}-${month}`,
        label: date.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        }),
        date,
      };
    });
  }, []);
  const dayLabel = useMemo(
    () =>
      viewDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    [viewDate],
  );
  const weekLabel = useMemo(() => {
    const weekStart = start_of_week(viewDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const startMonth = weekStart.toLocaleDateString("en-US", { month: "short" });
    const endMonth = weekEnd.toLocaleDateString("en-US", { month: "short" });
    const startDay = weekStart.toLocaleDateString("en-US", { day: "numeric" });
    const endDay = weekEnd.toLocaleDateString("en-US", { day: "numeric" });
    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} - ${endDay}, ${weekEnd.getFullYear()}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${weekEnd.getFullYear()}`;
  }, [viewDate]);

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const calendarRows = useMemo(() => {
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);
  const dayPickerCells = useMemo(
    () => buildCalendarCells(dayPickerMonth),
    [dayPickerMonth],
  );
  const dayPickerRows = useMemo(() => {
    const rows: (typeof dayPickerCells)[] = [];
    for (let i = 0; i < dayPickerCells.length; i += 7) {
      rows.push(dayPickerCells.slice(i, i + 7));
    }
    return rows;
  }, [dayPickerCells]);
  const dayPickerMonthLabel = useMemo(
    () =>
      dayPickerMonth.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [dayPickerMonth],
  );

  const departmentOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();

    for (const [id, name] of Object.entries(departmentNameById)) {
      const trimmedId = id.trim();
      const trimmedName = name.trim();
      if (!trimmedId || !trimmedName || seen.has(trimmedId)) continue;
      seen.add(trimmedId);
      options.push({ value: trimmedId, label: trimmedName });
    }

    for (const booking of rawBookings) {
      const id = to_filter_id(booking.department_id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      options.push({ value: id, label: `Department ${id}` });
    }

    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [departmentNameById, rawBookings]);

  const serviceOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const booking of rawBookings) {
      const id = to_filter_id(booking.event_type_id);
      const title = booking.event_types?.title?.trim();
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      options.push({ value: id, label: title });
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [rawBookings]);

  const providerOptions = useMemo(() => {
    const options: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const booking of rawBookings) {
      const id = to_filter_id(booking.service_provider_id);
      const name = booking.service_provider_name?.trim();
      if (!id || !name || seen.has(id)) continue;
      seen.add(id);
      options.push({ value: id, label: name });
    }
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }, [rawBookings]);

  // Bookings with start/end re-anchored to the selected display timezone so
  // grids (which use local Date getters) place them on the right date/slot.
  const display_bookings = useMemo(() => {
    if (selectedTimezone === browser_timezone) return rawBookings;
    return rawBookings.map((booking) => ({
      ...booking,
      start_at: booking.start_at
        ? shift_iso_to_timezone_wall_clock(booking.start_at, selectedTimezone)
        : booking.start_at,
      end_at: booking.end_at
        ? shift_iso_to_timezone_wall_clock(booking.end_at, selectedTimezone)
        : booking.end_at,
    }));
  }, [rawBookings, selectedTimezone, browser_timezone]);

  const filtered_bookings_list = useMemo(() => {
    const searchedBookings = filterBookingsBySearch(display_bookings, search);
    return searchedBookings.filter((booking) => {
      const matchesDepartment =
        departmentFilter === "all" ||
        to_filter_id(booking.department_id) === departmentFilter;
      const matchesService =
        serviceFilter === "all" ||
        to_filter_id(booking.event_type_id) === serviceFilter;
      const matchesProvider =
        providerFilter === "all" ||
        to_filter_id(booking.service_provider_id) === providerFilter;
      return matchesDepartment && matchesService && matchesProvider;
    });
  }, [display_bookings, search, departmentFilter, serviceFilter, providerFilter]);

  const bookingsByDay = useMemo(
    () => group_bookings_by_day(filtered_bookings_list),
    [filtered_bookings_list],
  );

  const currentMonthBookings = useMemo(() => {
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    return filtered_bookings_list.filter((booking) => {
      if (!booking.start_at) return false;
      const d = new Date(booking.start_at);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [filtered_bookings_list, viewDate]);

  const currentDayBookings = useMemo(() => {
    const dayKey = toDateKey(viewDate);
    return filtered_bookings_list
      .filter((booking) => {
        if (!booking.start_at) return false;
        return toDateKey(new Date(booking.start_at)) === dayKey;
      })
      .sort((a, b) => {
        const t1 = a.start_at ? new Date(a.start_at).getTime() : 0;
        const t2 = b.start_at ? new Date(b.start_at).getTime() : 0;
        return t1 - t2;
      });
  }, [filtered_bookings_list, viewDate]);

  const currentWeekBookings = useMemo(() => {
    const weekStart = start_of_week(viewDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return filtered_bookings_list
      .filter((booking) => {
        if (!booking.start_at) return false;
        const at = new Date(booking.start_at);
        return at >= weekStart && at < weekEnd;
      })
      .sort((a, b) => {
        const t1 = a.start_at ? new Date(a.start_at).getTime() : 0;
        const t2 = b.start_at ? new Date(b.start_at).getTime() : 0;
        return t1 - t2;
      });
  }, [filtered_bookings_list, viewDate]);

  const daySummary = useMemo(
    () => get_status_summary(currentDayBookings),
    [currentDayBookings],
  );
  const monthSummary = useMemo(
    () => get_status_summary(currentMonthBookings),
    [currentMonthBookings],
  );
  const weekSummary = useMemo(
    () => get_status_summary(currentWeekBookings),
    [currentWeekBookings],
  );

  const scheduleDate = useMemo(() => {
    const viewingCurrentMonth =
      viewDate.getFullYear() === today.getFullYear() &&
      viewDate.getMonth() === today.getMonth();
    // Prefer today when browsing the current month so the sidebar matches "today".
    if (viewingCurrentMonth) return new Date(today);
    const first = currentMonthBookings.find((booking) => booking.start_at);
    if (first?.start_at) return new Date(first.start_at);
    return new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  }, [currentMonthBookings, today, viewDate]);

  const scheduleBookings = useMemo(() => {
    const key = toDateKey(scheduleDate);
    return currentMonthBookings
      .filter((booking) => {
        if (!booking.start_at) return false;
        return toDateKey(new Date(booking.start_at)) === key;
      })
      .slice(0, 6);
  }, [currentMonthBookings, scheduleDate]);

  const upcomingBookings = useMemo(() => {
    const source =
      viewMode === "day"
        ? currentDayBookings
        : viewMode === "week" || viewMode === "provider"
          ? currentWeekBookings
          : currentMonthBookings;
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    return [...source]
      .filter((booking) => {
        if (!booking.start_at) return false;
        return new Date(booking.start_at) >= startOfToday;
      })
      .sort((a, b) => {
        const t1 = a.start_at ? new Date(a.start_at).getTime() : 0;
        const t2 = b.start_at ? new Date(b.start_at).getTime() : 0;
        return t1 - t2;
      })
      .slice(0, viewMode === "day" ? 6 : viewMode === "week" || viewMode === "provider" ? 3 : 4);
  }, [viewMode, currentDayBookings, currentWeekBookings, currentMonthBookings, today]);

  const dayProviderColumns = useMemo((): DayProviderColumn[] => {
    if (loading && (viewMode === "day" || viewMode === "provider")) {
      return [];
    }

    const resolveDepartment = (
      providerId: string,
      bookingDepartmentId?: string | null,
    ): string => {
      const fromBooking = to_filter_id(bookingDepartmentId);
      if (fromBooking && departmentNameById[fromBooking]) {
        return departmentNameById[fromBooking];
      }
      const meta = providerMetaById[providerId];
      const firstDeptId = meta?.departmentIds?.[0];
      if (firstDeptId != null) {
        const key = String(firstDeptId);
        if (departmentNameById[key]) return departmentNameById[key];
      }
      return "—";
    };

    if (providerFilter !== "all") {
      const selectedProvider = providerOptions.find(
        (option) => option.value === providerFilter,
      );
      const bookingForProvider = currentDayBookings.find(
        (booking) => to_filter_id(booking.service_provider_id) === providerFilter,
      );
      return [
        {
          key: providerFilter,
          label: selectedProvider?.label || "Selected Provider",
          department: resolveDepartment(
            providerFilter,
            bookingForProvider?.department_id,
          ),
          avatarUrl: providerMetaById[providerFilter]?.avatarUrl ?? null,
        },
      ];
    }

    const providerMap = new Map<
      string,
      { label: string; departmentId: string | null }
    >();
    for (const booking of currentDayBookings) {
      const id = to_filter_id(booking.service_provider_id);
      const label = booking.service_provider_name?.trim();
      if (!id || !label) continue;
      if (!providerMap.has(id)) {
        providerMap.set(id, {
          label,
          departmentId: to_filter_id(booking.department_id) || null,
        });
      }
    }
    if (providerMap.size === 0) {
      for (const option of providerOptions) {
        providerMap.set(option.value, {
          label: option.label,
          departmentId: null,
        });
      }
    }

    return [...providerMap.entries()].map(([key, value]) => ({
      key,
      label: value.label,
      department: resolveDepartment(key, value.departmentId),
      avatarUrl: providerMetaById[key]?.avatarUrl ?? null,
    }));
  }, [
    currentDayBookings,
    departmentNameById,
    loading,
    providerFilter,
    providerMetaById,
    providerOptions,
    viewMode,
  ]);

  const providerColumns = useMemo(() => {
    if (providerFilter !== "all") {
      const selectedProvider = providerOptions.find(
        (option) => option.value === providerFilter,
      );
      return [
        {
          key: providerFilter,
          label: selectedProvider?.label || "Selected Provider",
        },
      ];
    }
    const providerSet = new Map<string, string>();
    for (const booking of currentWeekBookings) {
      const id = to_filter_id(booking.service_provider_id);
      const label = booking.service_provider_name?.trim() || "Unassigned";
      if (!id || providerSet.has(id)) continue;
      providerSet.set(id, label);
    }
    if (providerSet.size === 0) {
      return [{ key: "unassigned", label: "Unassigned" }];
    }
    return [...providerSet.entries()].map(([key, label]) => ({ key, label }));
  }, [currentWeekBookings, providerFilter, providerOptions]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return (
      currentDayBookings.find((booking) => booking.id === selectedBookingId) ||
      currentWeekBookings.find((booking) => booking.id === selectedBookingId) ||
      currentMonthBookings.find((booking) => booking.id === selectedBookingId) ||
      null
    );
  }, [selectedBookingId, currentDayBookings, currentWeekBookings, currentMonthBookings]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      setRawBookings([]);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || !active) {
          if (active) setRawBookings([]);
          return;
        }

        const startOfMonth = new Date(
          viewDate.getFullYear(),
          viewDate.getMonth(),
          1,
        );
        const endOfMonth = new Date(
          viewDate.getFullYear(),
          viewDate.getMonth() + 1,
          0,
        );
        const startOfWeek = start_of_week(viewDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        const rangeStart =
          viewMode === "month"
            ? startOfMonth
            : viewMode === "day" || viewMode === "provider"
              ? start_of_day(viewDate)
              : new Date(
                  startOfWeek.getFullYear(),
                  startOfWeek.getMonth(),
                  startOfWeek.getDate(),
                );
        const rangeEnd =
          viewMode === "month"
            ? endOfMonth
            : viewMode === "day" || viewMode === "provider"
              ? start_of_day(viewDate)
              : new Date(
                  endOfWeek.getFullYear(),
                  endOfWeek.getMonth(),
                  endOfWeek.getDate(),
                );
        const params = new URLSearchParams({
          start_date: toDateKey(rangeStart),
          end_date: toDateKey(rangeEnd),
        });
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const res = await fetch(`/api/bookings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const departmentsRes = await fetch("/api/departments", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const teamMembersRes = await fetch("/api/team-members", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!active) return;

        if (!res.ok) {
          setRawBookings([]);
          return;
        }

        const json = (await res.json()) as BookingApiResponse;
        const list = (json.data ?? []) as Booking[];

        list.sort((a, b) => {
          const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
          const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
          return aTime - bTime;
        });

        setRawBookings(list);
        if (departmentsRes.ok) {
          const departmentsJson =
            (await departmentsRes.json()) as DepartmentsApiResponse;
          const nextDepartmentNames: Record<string, string> = {};
          for (const department of departmentsJson.departments ?? []) {
            const id = String(department.id ?? "").trim();
            const name = department.name?.trim();
            if (!id || !name) continue;
            nextDepartmentNames[id] = name;
          }
          setDepartmentNameById(nextDepartmentNames);
        }
        if (teamMembersRes.ok) {
          const teamJson = (await teamMembersRes.json()) as TeamMembersApiResponse;
          const nextProviderMeta: Record<
            string,
            { avatarUrl: string | null; departmentIds: number[] }
          > = {};
          for (const member of teamJson.teamMembers ?? []) {
            const id = String(member.id ?? "").trim();
            if (!id) continue;
            if (member.deactivated) continue;
            nextProviderMeta[id] = {
              avatarUrl: member.avatar_url?.trim() || null,
              departmentIds: Array.isArray(member.departments)
                ? member.departments
                : [],
            };
          }
          setProviderMetaById(nextProviderMeta);
        }
      } catch {
        if (active) setRawBookings([]);
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [viewDate, viewMode, statusFilter, refreshKey]);

  useEffect(() => {
    if ((viewMode !== "week" && viewMode !== "day") || !selectedBookingId) return;
    appointmentDetailsRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    appointmentDetailsRef.current?.focus({ preventScroll: true });
  }, [selectedBookingId, viewMode]);

  useEffect(() => {
    if (!scroll_to_today) return;
    todayCellRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
    set_scroll_to_today(false);
  }, [scroll_to_today, viewDate, calendarRows]);

  const goToToday = useCallback(() => {
    const now = new Date();
    if (viewMode === "month") {
      setViewDate(start_of_month(now));
      set_scroll_to_today(true);
      return;
    }
    if (viewMode === "day" || viewMode === "provider") {
      setViewDate(start_of_day(now));
      return;
    }
    setViewDate(start_of_week(now));
  }, [viewMode]);

  const previousPeriod = useCallback(() => {
    setViewDate((prev) => {
      if (viewMode === "month") return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
      if (viewMode === "day" || viewMode === "provider") {
        const next = new Date(prev);
        next.setDate(prev.getDate() - 1);
        return start_of_day(next);
      }
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return start_of_week(next);
    });
  }, [viewMode]);

  const nextPeriod = useCallback(() => {
    setViewDate((prev) => {
      if (viewMode === "month") return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
      if (viewMode === "day" || viewMode === "provider") {
        const next = new Date(prev);
        next.setDate(prev.getDate() + 1);
        return start_of_day(next);
      }
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return start_of_week(next);
    });
  }, [viewMode]);

  const switchViewMode = useCallback((mode: CalendarViewMode) => {
    if (mode === "day" || mode === "provider") {
      setViewDate(start_of_day(new Date()));
    } else if (mode === "week") {
      setViewDate(start_of_week(new Date()));
    } else if (mode === "month") {
      setViewDate((prev) => start_of_month(prev));
    }
    setShowDayPicker(false);
    setShowMonthOptions(false);
    setViewMode(mode);
  }, []);

  useEffect(() => {
    const bump = () => setRefreshKey((k) => k + 1);
    window.addEventListener("bookings-viewed-update", bump);
    return () => window.removeEventListener("bookings-viewed-update", bump);
  }, []);

  useEffect(() => {
    if (!showMonthOptions) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!monthDropdownRef.current) return;
      if (!monthDropdownRef.current.contains(event.target as Node)) {
        setShowMonthOptions(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showMonthOptions]);

  useEffect(() => {
    if (!showDayPicker) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!dayPickerRef.current) return;
      if (!dayPickerRef.current.contains(event.target as Node)) {
        setShowDayPicker(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showDayPicker]);

  return (
    <div className="min-h-screen bg-slate-50/40">
      <div className="mx-auto space-y-4">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Booking Calendar
            </h1>
            <p className="text-sm text-slate-500">
              View and manage all appointments
            </p>
          </div>

          <button
            type="button"
            onClick={open_create_booking}
            className="inline-flex items-center gap-2 self-start rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 md:self-auto"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Booking
          </button>
        </header>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => switchViewMode("day")}
                className={`rounded-md px-5 py-2 text-xs font-semibold transition ${
                  viewMode === "day"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Day
              </button>
              <button
                type="button"
                onClick={() => switchViewMode("week")}
                className={`rounded-md px-5 py-2 text-xs font-semibold transition ${
                  viewMode === "week"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => switchViewMode("month")}
                className={`rounded-md px-5 py-2 text-xs font-semibold transition ${
                  viewMode === "month"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => switchViewMode("provider")}
                className={`rounded-md px-5 py-2 text-xs font-semibold transition ${
                  viewMode === "provider"
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Provider
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={goToToday}
                className="h-9 rounded-md border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Today
              </button>
              <button
                type="button"
                onClick={previousPeriod}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label={
                  viewMode === "month"
                    ? "Previous month"
                    : viewMode === "day" || viewMode === "provider"
                      ? "Previous day"
                      : "Previous week"
                }
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={nextPeriod}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                aria-label={
                  viewMode === "month"
                    ? "Next month"
                    : viewMode === "day" || viewMode === "provider"
                      ? "Next day"
                      : "Next week"
                }
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
              {viewMode === "month" ? (
                <div className="relative" ref={monthDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowMonthOptions((prev) => !prev)}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    aria-label={`Current month ${monthLabel}`}
                    aria-expanded={showMonthOptions}
                    aria-haspopup="listbox"
                  >
                    <CalendarDays
                      className="h-3.5 w-3.5 text-slate-500"
                      aria-hidden
                    />
                    {monthLabel}
                    <ChevronDown
                      className="h-3.5 w-3.5 text-slate-500"
                      aria-hidden
                    />
                  </button>

                  {showMonthOptions && (
                    <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                      <div className="max-h-72 overflow-y-auto py-1">
                        {monthOptions.map((option) => {
                          const isSelected =
                            option.date.getFullYear() === viewDate.getFullYear() &&
                            option.date.getMonth() === viewDate.getMonth();
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                setViewDate(start_of_month(option.date));
                                setShowMonthOptions(false);
                              }}
                              className={`flex w-full items-center px-3 py-2 text-left text-xs ${
                                isSelected
                                  ? "bg-indigo-50 font-semibold text-indigo-700"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                              role="option"
                              aria-selected={isSelected}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : viewMode === "day" || viewMode === "provider" ? (
                <div className="relative" ref={dayPickerRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setDayPickerMonth(start_of_month(viewDate));
                      setShowDayPicker((prev) => !prev);
                    }}
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    aria-label={`Select date ${dayLabel}`}
                    aria-expanded={showDayPicker}
                    aria-haspopup="dialog"
                  >
                    <CalendarDays
                      className="h-3.5 w-3.5 text-slate-500"
                      aria-hidden
                    />
                    {dayLabel}
                    <ChevronDown
                      className="h-3.5 w-3.5 text-slate-500"
                      aria-hidden
                    />
                  </button>

                  {showDayPicker && (
                    <div className="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() =>
                            setDayPickerMonth(
                              (prev) =>
                                new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                            )
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label="Previous month"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <p className="text-xs font-semibold text-slate-800">
                          {dayPickerMonthLabel}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setDayPickerMonth(
                              (prev) =>
                                new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                            )
                          }
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                          aria-label="Next month"
                        >
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      <div className="mb-1 grid grid-cols-7 gap-1">
                        {WEEK_DAYS.map((day) => (
                          <div
                            key={day}
                            className="py-1 text-center text-[10px] font-semibold text-slate-400"
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="space-y-1">
                        {dayPickerRows.map((row, rowIndex) => (
                          <div
                            key={`${dayPickerMonthLabel}-${rowIndex}`}
                            className="grid grid-cols-7 gap-1"
                          >
                            {row.map((cell) => {
                              const cellKey = toDateKey(cell.date);
                              const selectedKey = toDateKey(viewDate);
                              const todayKey = toDateKey(today);
                              const isSelected = cellKey === selectedKey;
                              const isToday = cellKey === todayKey;

                              return (
                                <button
                                  key={cell.date.toISOString()}
                                  type="button"
                                  onClick={() => {
                                    setViewDate(start_of_day(cell.date));
                                    setShowDayPicker(false);
                                  }}
                                  className={`h-8 rounded-md text-xs font-medium transition ${
                                    isSelected
                                      ? "bg-indigo-600 text-white"
                                      : isToday
                                        ? "bg-blue-50 font-semibold text-blue-700 hover:bg-blue-100"
                                        : cell.isCurrentMonth
                                          ? "text-slate-700 hover:bg-slate-100"
                                          : "text-slate-300 hover:bg-slate-50"
                                  }`}
                                >
                                  {cell.dayNumber}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700">
                  {weekLabel}
                </div>
              )}
            </div>
          </div>

          <CalendarFiltersBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            departmentFilter={departmentFilter}
            onDepartmentFilterChange={setDepartmentFilter}
            serviceFilter={serviceFilter}
            onServiceFilterChange={setServiceFilter}
            providerFilter={providerFilter}
            onProviderFilterChange={setProviderFilter}
            departmentOptions={departmentOptions}
            serviceOptions={serviceOptions}
            providerOptions={providerOptions}
            monthLabel={monthLabel}
            onPreviousMonth={previousPeriod}
            onNextMonth={nextPeriod}
          />

          <div
            className={
              viewMode === "provider"
                ? "grid gap-5"
                : "grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"
            }
          >
            <div className="space-y-4">
              {viewMode === "month" ? (
                <CalendarMonthGrid
                  rows={calendarRows}
                  bookingsByDay={bookingsByDay}
                  loading={loading}
                  today={today}
                  monthLabel={monthLabel}
                  todayCellRef={todayCellRef}
                />
              ) : viewMode === "day" || viewMode === "provider" ? (
                <CalendarDayGrid
                  viewDate={viewDate}
                  bookings={currentDayBookings}
                  providerColumns={dayProviderColumns}
                  loading={loading}
                  timezoneLabel={timezoneLabel}
                  onSelectBooking={(booking) => setSelectedBookingId(booking.id)}
                  selectedBookingId={selectedBookingId ?? undefined}
                />
              ) : (
                <CalendarWeekGrid
                  viewMode="week"
                  weekStart={viewDate}
                  bookings={currentWeekBookings}
                  providerColumns={providerColumns}
                  loading={loading}
                  timezoneLabel={timezoneLabel}
                  onSelectBooking={(booking) => setSelectedBookingId(booking.id)}
                  selectedBookingId={selectedBookingId ?? undefined}
                />
              )}

              <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-slate-200 pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {CALENDAR_STATUS_LEGEND.map((item) => (
                    <div
                      key={item.key}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"
                    >
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${getStatusDotClass(item.key)}`}
                        aria-hidden
                      />
                      {item.label}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <TimezoneSelector
                    timezone={selectedTimezone}
                    options={timezone_options}
                    onChange={setDisplayTimezone}
                    variant="inline"
                  />
                  <button
                    type="button"
                    onClick={() => setRefreshKey((k) => k + 1)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                    aria-label="Refresh calendar"
                  >
                    {/* <RefreshCw className="h-3.5 w-3.5" aria-hidden /> */}
                  </button>
                </div>
              </div>
            </div>

            {viewMode !== "provider" && (
              <CalendarSidebar
                viewMode={
                  viewMode === "month" ? "month" : viewMode === "day" ? "day" : "week"
                }
                monthSummary={monthSummary}
                weekSummary={weekSummary}
                daySummary={daySummary}
                scheduleDate={scheduleDate}
                scheduleBookings={scheduleBookings}
                upcomingBookings={upcomingBookings}
                dayBookings={currentDayBookings}
                loadingUpcoming={loading}
                onCreateBooking={open_create_booking}
                selectedBooking={selectedBooking}
                onSelectBooking={(booking) => setSelectedBookingId(booking.id)}
                appointmentDetailsRef={appointmentDetailsRef}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
