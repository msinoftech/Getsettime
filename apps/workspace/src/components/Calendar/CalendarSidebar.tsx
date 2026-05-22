"use client";

import Link from "next/link";
import {
  LuCalendarDays as CalendarDays,
  LuClock3 as Clock3,
  LuPlus as Plus,
  LuEye as Eye,
  LuRefreshCw as RefreshCw,
  LuBell as Bell,
  LuUserRound as UserRound,
  LuClipboardList as ClipboardList,
  LuSlidersHorizontal as SlidersHorizontal,
} from "react-icons/lu";
import type { Booking } from "@/src/types/booking";
import { formatDate, formatTime } from "@/src/utils/date";
import {
  createdByDisplayLabel,
  getStatusPillClass,
} from "@/src/components/Calendar/calendar_utils";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarSidebarProps = {
  upcomingBookings: Booking[];
  onCreateBooking: () => void;
  loadingUpcoming?: boolean;
};

export function CalendarSidebar({
  upcomingBookings,
  onCreateBooking,
  loadingUpcoming = false,
}: CalendarSidebarProps) {
  return (
    <aside className="space-y-4">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Quick Actions
            </h3>
            <p className="text-sm text-slate-500">
              Most useful admin shortcuts
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          <Link
            href="/availability"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            Availability Management
          </Link>

          <Link
            href="/bookings"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            View All Bookings
          </Link>

          <button
            type="button"
            onClick={onCreateBooking}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create Booking
          </button>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
            <Clock3 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Upcoming Bookings
            </h3>
            <p className="text-sm text-slate-500">Quick appointment summary</p>
          </div>
        </div>

        <div className="space-y-3">
          {loadingUpcoming && (
            <>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-36 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </>
          )}

          {!loadingUpcoming && upcomingBookings.length > 0 &&
            upcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {booking.invitee_name?.trim() ||
                        booking.contacts?.name?.trim() ||
                        "Guest"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {booking.event_types?.title || "Appointment"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold capitalize",
                      getStatusPillClass(booking.status),
                    )}
                  >
                    {booking.status?.replace("-", " ") || "pending"}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Date:</span>{" "}
                    {booking.start_at ? formatDate(booking.start_at) : "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Time:</span>{" "}
                    {booking.start_at ? formatTime(booking.start_at) : "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">
                      Created by:
                    </span>{" "}
                    {createdByDisplayLabel(booking)}
                  </p>
                </div>

                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    View
                  </Link>
                  <Link
                    href={`/bookings/${booking.id}`}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Reschedule
                  </Link>
                </div>
              </div>
            ))}

          {!loadingUpcoming && upcomingBookings.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-700">
                No upcoming bookings found
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try a different search or filter.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3 text-white">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Admin Notice</h3>
            <p className="text-sm text-slate-300">Clean and useful workflow</p>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-200">
          I kept only the most useful buttons for this page: Today, Sync,
          Availability, Create Booking, All Bookings, Reports, and Export. I removed
          extra clutter so the page stays aligned with your Service and Department
          screens.
        </p>

        <div className="mt-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-200" aria-hidden />
            <p className="text-sm text-slate-100">
              Best next step: open a right-side booking details drawer on booking
              card click with view, follow-up, reschedule, cancel, and notes
              actions.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
