"use client";

import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";

type TimelineBadge = {
  label: string;
  className: string;
};

function badge_for_booking(booking: Booking): TimelineBadge {
  const raw = String(booking.status ?? "").toLowerCase();
  if (raw === "cancelled") {
    return { label: "Cancelled", className: "bg-rose-100 text-rose-700" };
  }
  if (raw === "pending") {
    return { label: "Pending", className: "bg-amber-100 text-amber-700" };
  }
  const now = Date.now();
  const start_ms = booking.start_at ? new Date(booking.start_at).getTime() : 0;
  const dur =
    booking.event_types?.duration_minutes != null
      ? booking.event_types.duration_minutes * 60_000
      : 30 * 60_000;
  const end_ms =
    booking.end_at != null
      ? new Date(booking.end_at).getTime()
      : start_ms + dur;
  if (start_ms && now >= start_ms && now < end_ms && raw !== "completed") {
    return { label: "Active", className: "bg-emerald-100 text-emerald-700" };
  }
  if (start_ms && now < start_ms) {
    return { label: "Upcoming", className: "bg-indigo-100 text-indigo-700" };
  }
  return { label: "Completed", className: "bg-slate-100 text-slate-700" };
}

export default function TodayTimeline({
  bookings,
  loading,
}: {
  bookings: Booking[];
  loading: boolean;
}) {
  const count = bookings.length;

  return (
    <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60 md:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-slate-900">Today Timeline</h3>
          <p className="text-sm font-semibold text-slate-500">
            Active and upcoming appointment flow
          </p>
        </div>
        <span className="rounded-2xl bg-indigo-50 px-4 py-2 text-sm font-black text-indigo-600">
          {loading ? "…" : `${count} Event${count !== 1 ? "s" : ""}`}
        </span>
      </div>
      {loading ? (
        <div className="py-16 text-center text-sm font-semibold text-slate-500">Loading…</div>
      ) : count === 0 ? (
        <div className="py-14 text-center text-sm font-semibold text-slate-500">
          No bookings scheduled for today.
        </div>
      ) : (
        <div className="relative space-y-4 pl-4 before:absolute before:left-[27px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-indigo-100">
          {bookings.map((item) => {
            const badge = badge_for_booking(item);
            const time_label = item.start_at
              ? new Date(item.start_at).toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "—";
            const guest =
              item.invitee_name?.trim() || item.contacts?.name?.trim() || "Guest";
            const service = item.event_types?.title ?? "Appointment";
            return (
              <div
                key={item.id}
                className="relative flex gap-4 rounded-[24px] bg-slate-50 p-4 transition hover:bg-indigo-50/70"
              >
                <div
                  className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
                    badge.label === "Active"
                      ? "bg-emerald-500 text-white"
                      : "bg-indigo-500 text-white"
                  }`}
                >
                  <DashboardIcon
                    name={badge.label === "Active" ? "activity" : "clock"}
                    size={14}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-indigo-600">{time_label}</p>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <h4 className="mt-1 truncate font-black text-slate-900">{guest}</h4>
                  <p className="text-sm font-semibold text-slate-500">{service}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
