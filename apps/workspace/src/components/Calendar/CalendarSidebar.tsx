"use client";

import Link from "next/link";
import type { RefObject } from "react";
import {
  LuArrowRight as ArrowRight,
  LuChartColumn as ChartColumn,
  LuCircleUserRound as CircleUserRound,
  LuClock3 as Clock3,
  LuInfo as Info,
  LuMapPin as MapPin,
} from "react-icons/lu";
import type { Booking } from "@/src/types/booking";
import { formatDate, formatTime } from "@/src/utils/date";
import {
  createdByDisplayLabel,
  getStatusDotClass,
} from "@/src/components/Calendar/calendar_utils";

function cn(...classes: Array<string | false | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type CalendarSidebarProps = {
  viewMode: "month" | "week" | "day";
  monthSummary: {
    total: number;
    confirmed: number;
    completed: number;
    pending: number;
    cancelled: number;
    reschedule: number;
    noShow: number;
  };
  weekSummary: {
    total: number;
    confirmed: number;
    completed: number;
    pending: number;
    cancelled: number;
    reschedule: number;
    noShow: number;
  };
  daySummary: {
    total: number;
    confirmed: number;
    completed: number;
    pending: number;
    cancelled: number;
    reschedule: number;
    noShow: number;
  };
  scheduleDate: Date;
  scheduleBookings: Booking[];
  upcomingBookings: Booking[];
  dayBookings: Booking[];
  onCreateBooking: () => void;
  loadingUpcoming?: boolean;
  selectedBooking?: Booking | null;
  onSelectBooking?: (booking: Booking) => void;
  appointmentDetailsRef?: RefObject<HTMLDivElement | null>;
};

export function CalendarSidebar({
  viewMode,
  monthSummary,
  weekSummary,
  daySummary,
  scheduleDate,
  scheduleBookings,
  upcomingBookings,
  dayBookings,
  onCreateBooking: _onCreateBooking,
  loadingUpcoming = false,
  selectedBooking = null,
  onSelectBooking,
  appointmentDetailsRef,
}: CalendarSidebarProps) {
  const summary =
    viewMode === "month"
      ? monthSummary
      : viewMode === "day"
        ? daySummary
        : weekSummary;
  const summaryTitle =
    viewMode === "month"
      ? "Month Summary"
      : viewMode === "day"
        ? "Day Summary"
        : "Week Summary";
  const scheduleTitle = scheduleDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const summaryCards = [
    {
      key: "total",
      label: "Total Appointments",
      value: summary.total,
      className: "bg-slate-50 text-slate-900",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      value: summary.confirmed,
      className: "bg-blue-50 text-blue-700",
    },
    {
      key: "completed",
      label: "Completed",
      value: summary.completed,
      className: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "pending",
      label: "Pending",
      value: summary.pending,
      className: "bg-amber-50 text-amber-700",
    },
    {
      key: "cancelled",
      label: "Cancelled",
      value: summary.cancelled,
      className: "bg-rose-50 text-rose-700",
    },
    {
      key: "reschedule",
      label: "Reschedule",
      value: summary.reschedule,
      className: "bg-indigo-50 text-indigo-700",
    },
    {
      key: "noShow",
      label: "No Show",
      value: summary.noShow,
      className: "bg-violet-50 text-violet-700",
    },
  ] as const;

  const todayKey = new Date();
  const startOfToday = new Date(
    todayKey.getFullYear(),
    todayKey.getMonth(),
    todayKey.getDate(),
  ).getTime();
  const startOfTomorrow = startOfToday + 24 * 60 * 60 * 1000;

  const getRelativeDay = (
    at: string | null,
  ): "today" | "tomorrow" | "other" => {
    if (!at) return "other";
    const date = new Date(at);
    const start = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime();
    if (start === startOfToday) return "today";
    if (start === startOfTomorrow) return "tomorrow";
    return "other";
  };

  const upcomingDateLabel = (at: string | null): string => {
    if (!at) return "No Date";
    const date = new Date(at);
    const relative = getRelativeDay(at);
    const monthDay = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (relative === "today") return `Today, ${monthDay}`;
    if (relative === "tomorrow") return `Tomorrow, ${monthDay}`;
    return formatDate(at);
  };

  const statusLabel = (status: string | null | undefined): string => {
    const value = (status ?? "pending").toLowerCase().replace(/_/g, "-");
    if (value === "no-show" || value === "noshow") return "No Show";
    return value.replace("-", " ");
  };
  const selectedBookingStatus = statusLabel(selectedBooking?.status);
  const selectedBookingName =
    selectedBooking?.invitee_name?.trim() ||
    selectedBooking?.contacts?.name?.trim() ||
    "Guest";
  const selectedBookingService =
    selectedBooking?.event_types?.title?.trim() || "Appointment";
  const selectedBookingProvider =
    selectedBooking?.service_provider_name?.trim() ||
    (selectedBooking ? createdByDisplayLabel(selectedBooking) : "—");
  const selectedBookingLocation =
    typeof selectedBooking?.location === "object" && selectedBooking?.location
      ? String((selectedBooking.location as { name?: string }).name ?? "Main Clinic")
      : "Main Clinic";
  const selectedDurationMinutes = (() => {
    if (!selectedBooking?.start_at) return 30;
    const start = new Date(selectedBooking.start_at).getTime();
    const end = selectedBooking.end_at ? new Date(selectedBooking.end_at).getTime() : 0;
    if (end > start) return Math.round((end - start) / 60000);
    return selectedBooking.event_types?.duration_minutes ?? 30;
  })();
  const selectedStatusBadgeClass = (() => {
    const value = (selectedBooking?.status ?? "pending").toLowerCase();
    if (value === "completed") return "bg-emerald-50 text-emerald-700";
    if (value === "confirmed") return "bg-blue-50 text-blue-700";
    if (value === "pending") return "bg-amber-50 text-amber-700";
    if (value === "cancelled") return "bg-rose-50 text-rose-700";
    if (value === "no_show" || value === "no-show" || value === "noshow") {
      return "bg-violet-50 text-violet-700";
    }
    if (value === "reschedule") return "bg-indigo-50 text-indigo-700";
    return "bg-slate-100 text-slate-700";
  })();

  return (
    <aside className="space-y-4">
      {viewMode !== "day" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">{summaryTitle}</h3>
            <ChartColumn className="h-4 w-4 text-slate-400" aria-hidden />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {summaryCards.map((card) => (
              <div key={card.key} className={`rounded-lg p-3 ${card.className}`}>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs font-medium text-slate-600">{card.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="truncate text-xl font-semibold text-slate-900">
            {viewMode === "day" ? "Today's Agenda" : "Upcoming Appointments"}
          </h3>
          {viewMode === "day" && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-700">
              {dayBookings.length}
            </span>
          )}
        </div>

        <div className="space-y-1">
          {loadingUpcoming &&
            [1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
            ))}

          {!loadingUpcoming &&
            (viewMode === "day" ? dayBookings : upcomingBookings).map((booking) => {
              const relative = getRelativeDay(booking.start_at);
              const customerName =
                booking.invitee_name?.trim() ||
                booking.contacts?.name?.trim() ||
                "Guest";
              const eventTitle =
                booking.event_types?.title?.trim() || "Appointment";
              const providerName =
                booking.service_provider_name?.trim() ||
                createdByDisplayLabel(booking);
              const agendaItemClassName =
                "flex w-full items-start gap-2.5 rounded-lg px-1 py-2.5 text-left transition hover:bg-slate-50";
              const agendaContent = (
                <>
                  <span
                    className={cn(
                      "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      relative === "today"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-slate-100 text-slate-500",
                    )}
                    aria-hidden
                  >
                    {relative === "today" ? (
                      <Info className="h-3.5 w-3.5" />
                    ) : (
                      <Clock3 className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    {viewMode === "day" ? (
                      <>
                        <p className="text-sm font-semibold text-blue-700">
                          {booking.start_at ? formatTime(booking.start_at) : "—"}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                          {customerName}
                        </p>
                        <p className="truncate text-xs text-slate-500">{providerName}</p>
                      </>
                    ) : (
                      <>
                        <p
                          className={cn(
                            "text-xs font-semibold",
                            relative === "today"
                              ? "text-blue-600"
                              : "text-slate-500",
                          )}
                        >
                          {upcomingDateLabel(booking.start_at)} •{" "}
                          {booking.start_at ? formatTime(booking.start_at) : "—"}
                        </p>
                        <p className="mt-0.5 truncate text-sm text-slate-900">
                          <span className="font-semibold">{customerName}</span>
                          <span className="font-normal text-slate-500">
                            {" "}
                            • {eventTitle}
                          </span>
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {providerName}
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-1 inline-flex shrink-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        getStatusDotClass(booking.status),
                      )}
                      aria-hidden
                    />
                    <span className="text-xs font-medium capitalize text-slate-600">
                      {statusLabel(booking.status)}
                    </span>
                  </div>
                </>
              );

              if (viewMode === "day" || viewMode === "week") {
                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelectBooking?.(booking)}
                    className={agendaItemClassName}
                  >
                    {agendaContent}
                  </button>
                );
              }

              return (
                <Link
                  key={booking.id}
                  href={`/bookings/${booking.id}`}
                  className={agendaItemClassName}
                >
                  {agendaContent}
                </Link>
              );
            })}

          {!loadingUpcoming &&
            (viewMode === "day" ? dayBookings : upcomingBookings).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              {viewMode === "day"
                ? "No appointments for this day"
                : "No upcoming appointments"}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3 text-center">
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {viewMode === "day"
              ? "View full agenda"
              : viewMode === "week"
                ? "View full week agenda"
                : "View all"}
            {(viewMode === "day" || viewMode === "week") && (
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            )}
          </Link>
        </div>
      </div>

      {viewMode === "month" && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-xl font-semibold text-slate-900">
            {scheduleTitle} Schedule
          </h3>
          <div className="space-y-3">
            {scheduleBookings.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                No appointments for this day
              </div>
            )}

            {scheduleBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="grid grid-cols-[72px_minmax(0,1fr)_76px] items-start gap-2 rounded-lg p-1.5 transition hover:bg-slate-50"
              >
                <p className="text-sm font-semibold text-blue-700">
                  {booking.start_at ? formatTime(booking.start_at) : "—"}
                </p>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {booking.invitee_name?.trim() ||
                      booking.contacts?.name?.trim() ||
                      "Guest"}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {booking.event_types?.title || "Appointment"}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {booking.service_provider_name?.trim() || "—"}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1.5">
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      getStatusDotClass(booking.status),
                    )}
                  />
                  <span className="text-xs font-medium text-slate-600 capitalize">
                    {(booking.status ?? "pending").replace("-", " ")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {/* <Link
            href="/bookings"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <CircleUserRound className="h-4 w-4" aria-hidden />
            View Customer Profile
          </Link> */}
        </div>
      )}

      {(viewMode === "week" || viewMode === "day") && (
        <div
          ref={appointmentDetailsRef}
          tabIndex={-1}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm outline-none focus:ring-2 focus:ring-indigo-200"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Appointment Details</h3>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${selectedStatusBadgeClass}`}
            >
              {selectedBooking ? selectedBookingStatus : "Select a booking"}
            </span>
          </div>

          {!selectedBooking && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              Click a booking in the {viewMode === "day" ? "day" : "week"} calendar to view
              details.
            </div>
          )}

          {selectedBooking && (
            <div className="space-y-3">
              <div>
                <p className="text-2xl font-semibold leading-tight text-slate-900">
                  {selectedBookingName}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <Clock3 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  {selectedBookingService}
                </p>
              </div>

              <div className="border-t border-slate-200 pt-3 text-sm">
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <p className="inline-flex items-center gap-2 text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    Time
                  </p>
                  <p className="text-right font-semibold text-slate-800">
                    {selectedBooking.start_at ? formatDate(selectedBooking.start_at) : "—"}{" "}
                    {selectedBooking.start_at ? `• ${formatTime(selectedBooking.start_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <p className="inline-flex items-center gap-2 text-slate-500">
                    <CircleUserRound className="h-3.5 w-3.5" aria-hidden />
                    Provider
                  </p>
                  <p className="text-right font-semibold text-slate-800">
                    {selectedBookingProvider}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <p className="inline-flex items-center gap-2 text-slate-500">
                    <MapPin className="h-3.5 w-3.5" aria-hidden />
                    Location
                  </p>
                  <p className="text-right font-semibold text-slate-800">
                    {selectedBookingLocation}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <p className="inline-flex items-center gap-2 text-slate-500">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden />
                    Duration
                  </p>
                  <p className="text-right font-semibold text-slate-800">
                    {selectedDurationMinutes} min
                  </p>
                </div>
                <div className="flex items-start justify-between gap-3 py-1.5">
                  <p className="inline-flex items-center gap-2 text-slate-500">
                    <Info className="h-3.5 w-3.5" aria-hidden />
                    Notes
                  </p>
                  <p className="max-w-[65%] text-right text-slate-700">
                    {(selectedBooking.metadata as { notes?: string } | null)?.notes ||
                      "No notes provided."}
                  </p>
                </div>
              </div>
              <Link
                href={`/bookings/${selectedBooking.id}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <CircleUserRound className="h-4 w-4" aria-hidden />
                View Booking
              </Link>
            </div>
          )}

          {/* <Link
            href="/bookings"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View full week agenda
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link> */}
        </div>
      )}
    </aside>
  );
}
