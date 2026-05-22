"use client";

import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";

function format_booking_time(booking: Booking): string {
  if (!booking.start_at) return "—";
  const d = new Date(booking.start_at);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

function minutes_until_start(start_at: string | null): number | null {
  if (!start_at) return null;
  const diff_ms = new Date(start_at).getTime() - Date.now();
  if (diff_ms < 0) return 0;
  return Math.ceil(diff_ms / 60000);
}

export default function DashboardHero({
  next_booking,
  next_loading,
}: {
  next_booking: Booking | null;
  next_loading: boolean;
}) {
  const name =
    next_booking?.invitee_name?.trim() ||
    next_booking?.contacts?.name?.trim() ||
    "Guest";
  const service = next_booking?.event_types?.title?.trim() || "Appointment";
  const mins = minutes_until_start(next_booking?.start_at ?? null);
  const starts_label =
    next_loading ? "Loading…" : mins === null ? "No upcoming booking" : `Starts in ${mins}m`;

  return (
    <section
      aria-label="dashboard-hero"
      className="overflow-hidden rounded-[34px] bg-gradient-to-br from-[#4d46e8] via-[#5046f8] to-[#7c3aed] p-5 text-white shadow-2xl shadow-indigo-500/25 md:p-7"
    >
      <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black backdrop-blur">
            <DashboardIcon name="activity" size={14} /> Real-time command center
          </div>
          <h3 className="max-w-2xl text-3xl font-black tracking-tight md:text-5xl">
            Manage appointments at your fingertips.
          </h3>
          <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/80 md:text-base">
            Track bookings, team availability, reminders, and automation from one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/bookings"
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-600 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <DashboardIcon name="plus" size={17} /> Create Booking
            </Link>
            <Link
              href="/calendar"
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/25"
            >
              View Calendar <DashboardIcon name="arrow" size={17} />
            </Link>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/20 bg-white/15 p-5 backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-black">Next Appointment</p>
            {next_booking && !next_loading ? (
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-100">
                {starts_label}
              </span>
            ) : null}
          </div>
          {!next_loading && !next_booking ? (
            <p className="py-8 text-center text-sm font-semibold text-white/80">
              No upcoming bookings scheduled.
            </p>
          ) : next_loading ? (
            <div className="py-10 text-center text-sm font-semibold text-white/75">Loading…</div>
          ) : next_booking ? (
            <>
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-lg">
                  <DashboardIcon name="video" size={24} />
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-xl font-black">{name}</h4>
                  <p className="text-sm font-semibold text-white/75">{service}</p>
                  <p className="mt-2 text-sm font-black">{format_booking_time(next_booking)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href="/bookings"
                  className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-indigo-600"
                >
                  View Details
                </Link>
                <Link
                  href="/bookings"
                  className="rounded-2xl bg-black/15 px-4 py-3 text-center text-sm font-black text-white"
                >
                  Reschedule
                </Link>
              </div>
            </>
          ) : (
            <p className="py-8 text-center text-sm font-semibold text-white/80">
              No upcoming bookings scheduled.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
