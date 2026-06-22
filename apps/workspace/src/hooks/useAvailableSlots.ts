"use client";

import { useEffect, useMemo, useState } from "react";
import { buildTimeslotsForDay } from "@/src/utils/bookingTime";
import { getBrowserTimezone } from "@app/location";
import type {
  AvailabilitySettings as BookingAvailabilitySettings,
  Booking as SlotBooking,
  EventType,
} from "@/src/types/bookingForm";
import type { DashboardRange } from "@/src/components/Dashboard/DashboardFilterBar";

type ApiBooking = {
  id: string;
  start_at: string | null;
  end_at: string | null;
  status: string | null;
};

const INACTIVE_STATUSES = new Set(["cancelled", "deleted"]);

function to_date_key(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Future-facing date window for each range (available slots are inherently upcoming). */
function build_range_dates(range: DashboardRange): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (range === "today") return [today];

  if (range === "week") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }

  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const dates: Date[] = [];
  const cursor = new Date(today);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/**
 * Counts open (bookable, not past/break/booked) time slots across the selected
 * range, derived from the workspace availability timesheet and default event
 * type duration. Returns 0 when availability is not configured.
 */
export function useAvailableSlots(
  user: { id?: string } | null,
  range: DashboardRange,
  availability: BookingAvailabilitySettings | null,
  provider_timezone: string | null,
): { count: number | null; loading: boolean } {
  const [duration, set_duration] = useState<number | null>(null);
  const [duration_loading, set_duration_loading] = useState(true);
  const [bookings, set_bookings] = useState<SlotBooking[]>([]);
  const [bookings_loading, set_bookings_loading] = useState(true);

  const user_id = user?.id ?? null;
  const has_timesheet = Boolean(availability?.timesheet);

  const range_dates = useMemo(() => build_range_dates(range), [range]);
  const range_start_key = range_dates.length ? to_date_key(range_dates[0]) : "";
  const range_end_key = range_dates.length
    ? to_date_key(range_dates[range_dates.length - 1])
    : "";

  useEffect(() => {
    if (!user_id) {
      set_duration(null);
      set_duration_loading(false);
      return;
    }

    const ac = new AbortController();
    (async () => {
      set_duration_loading(true);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || ac.signal.aborted) {
          set_duration(30);
          return;
        }
        const res = await fetch("/api/event-types", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        if (!res.ok || ac.signal.aborted) {
          set_duration(30);
          return;
        }
        const body = (await res.json()) as {
          data?: Array<{ duration_minutes?: number | null; is_public?: boolean }>;
        };
        const list = body.data ?? [];
        const picked = list.find((row) => row.is_public === true) ?? list[0] ?? null;
        const minutes =
          typeof picked?.duration_minutes === "number" && picked.duration_minutes >= 1
            ? Math.trunc(picked.duration_minutes)
            : 30;
        if (!ac.signal.aborted) set_duration(minutes);
      } catch {
        if (!ac.signal.aborted) set_duration(30);
      } finally {
        if (!ac.signal.aborted) set_duration_loading(false);
      }
    })();

    return () => ac.abort();
  }, [user_id]);

  useEffect(() => {
    if (!user_id || !has_timesheet || !range_start_key || !range_end_key) {
      set_bookings([]);
      set_bookings_loading(false);
      return;
    }

    const ac = new AbortController();
    (async () => {
      set_bookings_loading(true);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || ac.signal.aborted) {
          set_bookings([]);
          return;
        }
        const params = new URLSearchParams({
          start_date: range_start_key,
          end_date: range_end_key,
          limit: "500",
        });
        const res = await fetch(`/api/bookings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        if (!res.ok || ac.signal.aborted) {
          set_bookings([]);
          return;
        }
        const body = (await res.json()) as { data?: ApiBooking[] };
        const active = (body.data ?? [])
          .filter(
            (b) =>
              b.start_at &&
              b.end_at &&
              !INACTIVE_STATUSES.has(String(b.status ?? "").toLowerCase()),
          )
          .map<SlotBooking>((b) => ({
            id: b.id,
            start_at: b.start_at as string,
            end_at: b.end_at as string,
            status: String(b.status ?? ""),
          }));
        if (!ac.signal.aborted) set_bookings(active);
      } catch {
        if (!ac.signal.aborted) set_bookings([]);
      } finally {
        if (!ac.signal.aborted) set_bookings_loading(false);
      }
    })();

    return () => ac.abort();
  }, [user_id, has_timesheet, range_start_key, range_end_key]);

  const count = useMemo(() => {
    if (!availability?.timesheet || duration == null) return null;
    const tz = provider_timezone?.trim() || getBrowserTimezone();
    const event_type: EventType = {
      id: "dashboard-availability",
      title: "Availability",
      duration_minutes: duration,
    };
    let total = 0;
    for (const date of range_dates) {
      const slots = buildTimeslotsForDay(
        event_type,
        date,
        availability,
        bookings,
        0,
        duration,
        tz,
        tz,
      );
      total += slots.filter((s) => !s.disabled).length;
    }
    return total;
  }, [availability, duration, provider_timezone, range_dates, bookings]);

  const loading = duration_loading || bookings_loading;

  return { count: has_timesheet ? count : 0, loading };
}
