"use client";

import { useMemo } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";

type StatusBadge = {
  label: string;
  className: string;
};

function badge_for_status(status: string | null | undefined): StatusBadge {
  const raw = String(status ?? "").toLowerCase();
  if (raw === "confirmed") {
    return { label: "Confirmed", className: "bg-emerald-50 text-emerald-700" };
  }
  if (raw === "reschedule") {
    return { label: "Rescheduled", className: "bg-red-50 text-red-700" };
  }
  if (raw === "cancelled") {
    return { label: "Cancelled", className: "bg-rose-50 text-rose-700" };
  }
  if (raw === "completed") {
    return { label: "Completed", className: "bg-slate-100 text-slate-600" };
  }
  if (raw === "no-show") {
    return { label: "No-show", className: "bg-rose-50 text-rose-700" };
  }
  return { label: "Pending", className: "bg-amber-50 text-amber-700" };
}

function format_time(start_at: string | null): { time: string; period: string } {
  if (!start_at) return { time: "—", period: "" };
  const parts = new Date(start_at)
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .split(" ");
  return { time: parts[0] ?? "—", period: parts[1] ?? "" };
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <DashboardIcon name="calendarDays" size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Upcoming Appointments</h3>
        </div>
        <Link
          href="/calendar"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          View Calendar
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
            const { time, period } = format_time(booking.start_at);
            return (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 leading-tight">
                  <span className="text-sm font-bold text-indigo-600">{time}</span>
                  {period ? (
                    <span className="text-xs font-bold text-slate-700">{period}</span>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{guest}</p>
                  <p className="truncate text-xs font-medium text-slate-500">
                    {format_subtitle(booking)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${badge.className}`}
                >
                  {badge.label}
                </span>
                <DashboardIcon
                  name="chevronRight"
                  size={16}
                  className="shrink-0 text-slate-300"
                />
              </Link>
            );
          })}

          <div className="pt-3 text-center">
            <Link
              href="/bookings"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              View all appointments
              <DashboardIcon name="arrow" size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
