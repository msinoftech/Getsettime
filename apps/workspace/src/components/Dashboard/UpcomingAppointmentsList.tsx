"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BookingPreviewPanel } from "@/src/components/Booking/BookingPreviewPanel";
import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";

type StatusBadge = {
  label: string;
  className: string;
};

function badge_for_status(status: string | null | undefined): StatusBadge {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "confirmed") {
    return { label: "Confirmed", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (raw === "reschedule") {
    return { label: "Rescheduled", className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (raw === "cancelled") {
    return { label: "Cancelled", className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (raw === "completed") {
    return { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  if (raw === "no-show") {
    return { label: "No-show", className: "bg-red-50 text-red-700 border-red-200" };
  }
  return { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" };
}

function format_schedule(start_at: string | null): {
  month_label: string;
  day_label: string;
  time: string;
  period: string;
} {
  if (!start_at) return { month_label: "", day_label: "", time: "—", period: "" };
  const date = new Date(start_at);
  const parts = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .split(" ");
  return {
    month_label: date
      .toLocaleDateString("en-US", { month: "short" })
      .replace(".", "")
      .toUpperCase(),
    day_label: String(date.getDate()).padStart(2, "0"),
    time: parts[0] ?? "—",
    period: parts[1] ?? "",
  };
}

/** Active (pending/confirmed/null) and still in the future — matches the "Upcoming" stat. */
function is_upcoming_booking(booking: Booking): boolean {
  const raw = String(booking.status ?? "").toLowerCase();
  const active = raw === "" || raw === "pending" || raw === "confirmed" || raw === "reschedule";
  const future = booking.start_at
    ? new Date(booking.start_at).getTime() > Date.now()
    : false;
  return active && future;
}

function format_subtitle(booking: Booking): string {
  const service = booking.event_types?.title?.trim() || "Appointment";
  const duration = booking.event_types?.duration_minutes;
  return duration ? `${duration} min ${service.toLowerCase()}` : service;
}

export default function UpcomingAppointmentsList({
  bookings,
  loading,
}: {
  bookings: Booking[];
  loading: boolean;
}) {
  const [preview_booking, set_preview_booking] = useState<Booking | null>(null);

  const items = useMemo(
    () =>
      bookings
        .filter(is_upcoming_booking)
        .sort((a, b) => {
          const a_time = a.start_at ? new Date(a.start_at).getTime() : 0;
          const b_time = b.start_at ? new Date(b.start_at).getTime() : 0;
          return a_time - b_time;
        })
        .slice(0, 5),
    [bookings],
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <DashboardIcon name="calendarDays" size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Upcoming Appointments</h3>
        </div>
        <Link
          href="/bookings"
          className="inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
        >
          View all appointments
          <DashboardIcon name="arrow" size={16} />
        </Link>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm font-semibold text-slate-400">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm font-semibold text-slate-400">
          No upcoming appointments.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((booking) => {
            const badge = badge_for_status(booking.status);
            const guest =
              booking.invitee_name?.trim() ||
              booking.contacts?.name?.trim() ||
              "Guest";
            const { month_label, day_label, time, period } = format_schedule(
              booking.start_at,
            );
            return (
              <button
                type="button"
                key={booking.id}
                onClick={() => set_preview_booking(booking)}
                className="flex w-full cursor-pointer items-start gap-2 sm:gap-4 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex h-11 w-10 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm">
                  {month_label && day_label ? (
                    <>
                      <span className="bg-indigo-600 py-[3px] text-center text-[10px] font-bold uppercase leading-none tracking-wide text-white">
                        {month_label}
                      </span>
                      <span className="flex flex-1 items-center justify-center text-sm font-bold leading-none text-indigo-600">
                        {day_label}
                      </span>
                    </>
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{guest}</p>
                  <div className="flex items-center flex-wrap gap-1">
                    <span className="truncate text-sm text-slate-500">
                      {format_subtitle(booking)}
                    </span>
                    <span className="flex items-center gap-1 truncate text-sm text-slate-500">
                      <svg className="h-3.5 w-3.5 text-indigo-600" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      {time}
                      {period ? ` ${period}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex max-[450px]:flex-col items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold border ${badge.className}`}
                  >
                    {badge.label}
                  </span>

                  <DashboardIcon
                    name="chevronRight"
                    size={16}
                    className="shrink-0 hidden sm:block text-slate-300"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
      <BookingPreviewPanel
        open={preview_booking != null}
        onClose={() => set_preview_booking(null)}
        booking={preview_booking}
      />
    </div>
  );
}
