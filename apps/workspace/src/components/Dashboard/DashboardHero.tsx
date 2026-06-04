"use client";

import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { PublicBookingLinkMenu } from "./PublicBookingLinkMenu";
import { PublicBookingPreviewCard } from "./PublicBookingPreviewCard";
import type { Booking } from "@/src/types/booking";
import { formatBookingLimitLabel, isUnlimitedBookingLimit } from "@app/db/subscription";

function format_booking_time(booking: Booking): string {
  if (!booking.start_at) return "—";
  const d = new Date(booking.start_at);
  const day = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t}`;
}

function format_booking_date(start_at: string | null | undefined): string {
  if (!start_at) return "—";
  const d = new Date(start_at);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function format_booking_clock_time(start_at: string | null | undefined): string {
  if (!start_at) return "—";
  const d = new Date(start_at);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function format_starts_in_label(start_at: string | null): string | null {
  if (!start_at) return null;
  const diff_ms = new Date(start_at).getTime() - Date.now();
  if (diff_ms <= 0) return "Starts now";

  const total_mins = Math.floor(diff_ms / 60000);
  const days = Math.floor(total_mins / (24 * 60));
  const hours = Math.floor((total_mins % (24 * 60)) / 60);
  const mins = total_mins % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);

  if (parts.length === 0) return "Starts now";
  return `Starts in ${parts.join(" ")}`;
}

function FreePlanUsageSkeleton() {
  return (
    <div
      className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm"
      aria-hidden
    >
      <div className="h-3 w-28 animate-pulse rounded bg-white/25" />
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="h-7 w-48 max-w-[70%] animate-pulse rounded bg-white/25 md:h-8" />
        <div className="h-6 w-24 shrink-0 animate-pulse rounded bg-white/20" />
      </div>
      <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-white/20" />
    </div>
  );
}

function NextAppointmentSkeleton() {
  return (
    <div
      className="rounded-[32px] border border-white/30 bg-white p-6 text-slate-900 shadow-2xl"
      aria-hidden
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-slate-200" />
      </div>
      <div className="min-w-0">
        <div className="h-8 max-w-[240px] w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-5 max-w-[160px] w-1/2 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="mt-5 space-y-3">
        <div className="rounded-2xl bg-slate-100 px-5 py-4">
          <div className="h-3 w-10 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-8 w-40 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="rounded-2xl bg-slate-100 px-5 py-4">
          <div className="h-3 w-10 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-8 w-28 animate-pulse rounded bg-slate-200" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
      </div>
    </div>
  );
}

function format_time_left_badge(start_at: string | null): string | null {
  if (!start_at) return null;
  const diff_ms = new Date(start_at).getTime() - Date.now();
  if (diff_ms <= 0) return "Live";
  const total_mins = Math.floor(diff_ms / 60000);
  const days = Math.floor(total_mins / (24 * 60));
  const hours = Math.floor((total_mins % (24 * 60)) / 60);
  const mins = total_mins % 60;
  if (days > 0) return `${days}d left`;
  if (hours > 0) return `${hours}h left`;
  return `${Math.max(1, mins)}m left`;
}

export default function DashboardHero({
  next_booking,
  next_loading,
  onCreateBooking,
  free_plan_usage,
  free_plan_usage_loading = false,
}: {
  next_booking: Booking | null;
  next_loading: boolean;
  onCreateBooking: () => void;
  free_plan_usage: { used: number; limit: number } | null;
  free_plan_usage_loading?: boolean;
}) {
  const name =
    next_booking?.invitee_name?.trim() ||
    next_booking?.contacts?.name?.trim() ||
    "Guest";
  const service = next_booking?.event_types?.title?.trim() || "Appointment";
  const starts_label = next_loading
    ? "Loading…"
    : format_starts_in_label(next_booking?.start_at ?? null) ?? "No upcoming booking";
  const left_badge =
    !next_loading && next_booking
      ? format_time_left_badge(next_booking.start_at ?? null) ?? "Upcoming"
      : "Upcoming";

  const show_next_appointment = !next_loading && Boolean(next_booking);
  const usage_percent = free_plan_usage
    ? isUnlimitedBookingLimit(free_plan_usage.limit)
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            free_plan_usage.limit > 0
              ? Math.round((free_plan_usage.used / free_plan_usage.limit) * 100)
              : 0,
          ),
        )
    : 0;
  const remaining_bookings = free_plan_usage
    ? isUnlimitedBookingLimit(free_plan_usage.limit)
      ? null
      : Math.max(0, free_plan_usage.limit - free_plan_usage.used)
    : 0;

  return (
    <section
      aria-label="dashboard-hero"
      className="relative z-20 overflow-visible rounded-[34px] bg-gradient-to-br from-[#4d46e8] via-[#5046f8] to-[#7c3aed] p-5 text-white shadow-2xl shadow-indigo-500/25 md:p-7"
    >
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black backdrop-blur">
            <DashboardIcon name="activity" size={14} /> Real-time command center
          </div>

          <div>
            <h3 className="max-w-2xl text-2xl font-black tracking-tight md:text-3xl lg:text-4xl">
              Manage appointments at your fingertips.
            </h3>
            <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-white/80 md:text-base">
              Share your booking page with customers so they can book appointments anytime.
            </p>
          </div>

          {free_plan_usage_loading ? (
            <FreePlanUsageSkeleton />
          ) : free_plan_usage ? (
            <div className="rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/70">
                Free plan usage
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-lg font-black md:text-2xl">
                  {isUnlimitedBookingLimit(free_plan_usage.limit) ? (
                    <>{free_plan_usage.used} Bookings Used (Unlimited)</>
                  ) : (
                    <>
                      {free_plan_usage.used} / {formatBookingLimitLabel(free_plan_usage.limit)} Bookings
                      Used
                    </>
                  )}
                </p>
                {remaining_bookings !== null && (
                  <p className="shrink-0 text-lg font-black text-white/80">
                    {remaining_bookings} remaining
                  </p>
                )}
              </div>
              {!isUnlimitedBookingLimit(free_plan_usage.limit) && (
                <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white transition-all duration-500"
                    style={{ width: `${usage_percent}%` }}
                  />
                </div>
              )}
            </div>
          ) : null}

          <div className="relative z-30 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onCreateBooking}
              className="flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-indigo-600 shadow-lg transition duration-300 hover:-translate-y-0.5 hover:bg-indigo-50"
            >
              <DashboardIcon name="plus" size={17} /> Create Booking
            </button>
            <Link
              href="/calendar"
              className="flex items-center gap-2 rounded-2xl bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/25"
            >
              View Calendar <DashboardIcon name="arrow" size={17} />
            </Link>
            <PublicBookingLinkMenu />
          </div>
        </div>

        {next_loading ? (
          <NextAppointmentSkeleton />
        ) : show_next_appointment && next_booking ? (
          <div className="rounded-[32px] border border-white/30 bg-white p-6 text-slate-900 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-500">Next Appointment</p>
              <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                {left_badge}
              </span>
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-[30px] font-black leading-none text-slate-950">{name}</h4>
              <p className="mt-1 text-base font-bold text-slate-500">{service}</p>
              {/* <p className="mt-1 text-xs font-semibold text-slate-400">{starts_label}</p> */}
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-100 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Date</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {format_booking_date(next_booking.start_at)}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-100 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Time</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {format_booking_clock_time(next_booking.start_at)}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Link
                href={`/bookings/${next_booking.id}`}
                className="rounded-2xl bg-indigo-600 px-4 py-3 text-center text-xl font-black text-white"
              >
                View
              </Link>
              <Link
                href={`/bookings/${next_booking.id}`}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-xl font-black text-slate-700"
              >
                Reschedule
              </Link>
            </div>
          </div>
        ) : (
          <PublicBookingPreviewCard />
        )}
      </div>
    </section>
  );
}
