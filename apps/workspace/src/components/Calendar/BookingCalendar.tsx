"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking } from "@/src/types/booking";
import MultiStepBookingForm from "@/src/components/Booking/MultiStepBookingForm";
import { CalendarManagementHeader } from "@/src/components/Calendar/CalendarManagementHeader";
import {
  CalendarFiltersBar,
  type CalendarStatusFilterOption,
} from "@/src/components/Calendar/CalendarFiltersBar";
import { CalendarMonthGrid } from "@/src/components/Calendar/CalendarMonthGrid";
import { CalendarSidebar } from "@/src/components/Calendar/CalendarSidebar";
import { CalendarStatsRow } from "@/src/components/Calendar/CalendarStatsRow";
import {
  buildCalendarCells,
  filterBookingsBySearch,
  toDateKey,
} from "@/src/components/Calendar/calendar_utils";

type BookingApiResponse = {
  data?: Booking[];
};

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

export default function BookingCalendar() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const [viewDate, setViewDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [rawBookings, setRawBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CalendarStatusFilterOption>("all");
  const [showMultiStepForm, setShowMultiStepForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const monthLabel = useMemo(
    () =>
      viewDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [viewDate],
  );

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const calendarRows = useMemo(() => {
    const rows: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const filtered_bookings_list = useMemo(
    () => filterBookingsBySearch(rawBookings, search),
    [rawBookings, search],
  );

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

  const totalBookings = currentMonthBookings.length;
  const confirmedCount = currentMonthBookings.filter(
    (b) => (b.status ?? "").toLowerCase() === "confirmed",
  ).length;
  const pendingCount = currentMonthBookings.filter(
    (b) => (b.status ?? "").toLowerCase() === "pending",
  ).length;
  const cancelledCount = currentMonthBookings.filter(
    (b) => (b.status ?? "").toLowerCase() === "cancelled",
  ).length;

  const upcomingBookings = useMemo(() => {
    const startOfToday = new Date(today);
    startOfToday.setHours(0, 0, 0, 0);
    return [...currentMonthBookings]
      .filter((booking) => {
        if (!booking.start_at) return false;
        return new Date(booking.start_at) >= startOfToday;
      })
      .sort((a, b) => {
        const t1 = a.start_at ? new Date(a.start_at).getTime() : 0;
        const t2 = b.start_at ? new Date(b.start_at).getTime() : 0;
        return t1 - t2;
      })
      .slice(0, 6);
  }, [currentMonthBookings, today]);

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
        const params = new URLSearchParams({
          start_date: toDateKey(startOfMonth),
          end_date: toDateKey(endOfMonth),
        });
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        const res = await fetch(`/api/bookings?${params.toString()}`, {
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
  }, [viewDate, statusFilter, refreshKey]);

  const goToToday = useCallback(() => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }, [today]);

  const previousMonth = useCallback(() => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  }, []);

  const nextMonth = useCallback(() => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  }, []);

  const handleMultiStepSave = useCallback(() => {
    setShowMultiStepForm(false);
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(new Event("bookings-viewed-update"));
  }, []);

  const handleMultiStepCancel = useCallback(() => {
    setShowMultiStepForm(false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <CalendarManagementHeader
            onToday={goToToday}
            onSync={() => {
              router.push("/integrations");
            }}
            onCreateBooking={() => setShowMultiStepForm(true)}
          />

          <CalendarStatsRow
            totalBookings={totalBookings}
            confirmedCount={confirmedCount}
            pendingCount={pendingCount}
            cancelledCount={cancelledCount}
          />

          <div className="grid gap-6 p-5 xl:grid-cols-[minmax(0,1fr)_340px] md:p-6">
            <div className="space-y-5">
              <CalendarFiltersBar
                search={search}
                onSearchChange={setSearch}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                monthLabel={monthLabel}
                onPreviousMonth={previousMonth}
                onNextMonth={nextMonth}
              />

              <CalendarMonthGrid
                rows={calendarRows}
                bookingsByDay={bookingsByDay}
                loading={loading}
                today={today}
                monthLabel={monthLabel}
              />
            </div>

            <CalendarSidebar
              upcomingBookings={upcomingBookings}
              loadingUpcoming={loading}
              onCreateBooking={() => setShowMultiStepForm(true)}
            />
          </div>
        </section>
      </div>

      {showMultiStepForm && (
        <div
          className="fixed inset-0 z-999 m-0 overflow-y-auto bg-gray-50 bg-opacity-50"
          role="presentation"
          onClick={handleMultiStepSave}
        >
          <div
            className="relative mx-auto h-full w-full"
            role="presentation"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={handleMultiStepSave}
              className="fixed right-2 top-2 z-10 rounded-full text-slate-500 transition-colors hover:text-slate-700"
              aria-label="Close modal"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <MultiStepBookingForm
              onSave={handleMultiStepSave}
              onCancel={handleMultiStepCancel}
            />
          </div>
        </div>
      )}
    </div>
  );
}
