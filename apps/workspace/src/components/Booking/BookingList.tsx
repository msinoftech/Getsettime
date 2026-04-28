"use client";

import Link from "next/link";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  LuCalendarDays as CalendarDays,
  LuCircleCheckBig as CheckCircle2,
  LuClock3 as Clock3,
  LuRefreshCcw as RefreshCcw,
  LuPlus as Plus,
  LuEye as Eye,
  LuSquarePen as SquarePen,
  LuTrash2 as Trash2,
  LuUserRound as UserRound,
} from "react-icons/lu";
import { type Booking } from "@/src/types/booking";
import { supabase } from "@/lib/supabaseClient";
import { useEventTypes, useServiceProviders } from "@/src/hooks/useBookingLookups";
import { formatDate, formatTime } from "@/src/utils/date";
import {
  getServiceProviderName,
  getDisplayName,
  capitalize_booking_display_label,
} from "@/src/utils/booking";
import BookingForm from "./BookingForm";
import MultiStepBookingForm from "./MultiStepBookingForm";
import { BookingFilters } from "./BookingFilters";
import { BookingTableRow, type DisplayBooking } from "./BookingTableRow";
import { StatusBadge } from "./StatusBadge";
import { Pagination } from "@app/ui";
import { BookingTableSkeleton } from "./BookingTableSkeleton";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

interface BookingListProps {
  bookings?: Booking[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ITEMS_PER_PAGE = 20;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

const BookingList = ({ bookings: initialBookings }: BookingListProps) => {
  const { data: eventTypes } = useEventTypes();
  const { data: serviceProviders, workspaceOwner } = useServiceProviders();

  const [bookings, setBookings] = useState<Booking[]>(initialBookings || []);
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [sortFilter, setSortFilter] = useState("start_at");
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [showMultiStepForm, setShowMultiStepForm] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ message: string } | null>(null);
  const [showBookingUpdatedSuccess, setShowBookingUpdatedSuccess] =
    useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
  const [allBookingsStats, setAllBookingsStats] = useState<{
    total: number;
    confirmed: number;
    pending: number;
    cancelled: number;
  } | null>(null);
  const initialFetchDone = useRef(false);

  const debouncedFilter = useDebouncedValue(filter, 300);
  const debouncedDate = useDebouncedValue(dateFilter, 300);
  const debouncedStatus = useDebouncedValue(statusFilter, 300);
  const debouncedEventType = useDebouncedValue(eventTypeFilter, 300);
  const debouncedSort = useDebouncedValue(sortFilter, 300);

  const fetchBookings = useCallback(
    async (
      page: number,
      search: string,
      date: string,
      status: string,
      eventTypeId: string,
      sort: string
    ) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });
      if (search.trim()) params.append("search", search.trim());
      if (date.trim()) params.append("date", date.trim());
      if (status.trim()) params.append("status", status.trim());
      if (eventTypeId.trim()) params.append("event_type_id", eventTypeId.trim());
      if (sort.trim()) params.append("sort", sort.trim());

      try {
        setLoading(true);
        const response = await fetch(`/api/bookings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const result = await response.json();
          setBookings(result.data || []);
          if (result.pagination) setPagination(result.pagination);
        }
      } catch (error) {
        console.error("Error fetching bookings:", error);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const fetchWorkspaceBookingStats = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    try {
      const response = await fetch("/api/bookings/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAllBookingsStats({
          total: data.total ?? 0,
          confirmed: data.confirmed ?? 0,
          pending: data.pending ?? 0,
          cancelled: data.cancelled ?? 0,
        });
      }
    } catch (error) {
      console.error("Error fetching workspace booking stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaceBookingStats();
  }, [fetchWorkspaceBookingStats]);

  // When filters change, reset to page 1
  useEffect(() => {
    if (!initialFetchDone.current) return;
    setCurrentPage(1);
  }, [debouncedFilter, debouncedDate, debouncedStatus, debouncedEventType, debouncedSort]);

  // Fetch when page or filters change
  useEffect(() => {
    fetchBookings(
      currentPage,
      debouncedFilter,
      debouncedDate,
      debouncedStatus,
      debouncedEventType,
      debouncedSort
    );
    initialFetchDone.current = true;
  }, [
    currentPage,
    debouncedFilter,
    debouncedDate,
    debouncedStatus,
    debouncedEventType,
    debouncedSort,
    fetchBookings,
  ]);

  const handleDeleteClick = useCallback((id: string) => {
    setDeleteConfirmModal({ id });
  }, []);

  const handleDeleteConfirm = useCallback(
    async () => {
      if (!deleteConfirmModal) return;
      const id = deleteConfirmModal.id;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleteConfirmModal(null);
        setAlertModal({ message: "Not authenticated" });
        return;
      }

      try {
        const response = await fetch(`/api/bookings?id=${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          setDeleteConfirmModal(null);
          await fetchBookings(
            currentPage,
            debouncedFilter,
            debouncedDate,
            debouncedStatus,
            debouncedEventType,
            debouncedSort
          );
          await fetchWorkspaceBookingStats();
        } else {
          const errorData = await response.json();
          setDeleteConfirmModal(null);
          setAlertModal({ message: errorData.error || "Failed to delete booking" });
        }
      } catch (error) {
        console.error("Error deleting booking:", error);
        setDeleteConfirmModal(null);
        setAlertModal({ message: "An error occurred while deleting the booking" });
      }
    },
    [
      deleteConfirmModal,
      currentPage,
      debouncedFilter,
      debouncedDate,
      debouncedStatus,
      debouncedEventType,
      debouncedSort,
      fetchBookings,
      fetchWorkspaceBookingStats,
    ]
  );

  const markBookingAsViewed = useCallback(async (bookingId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    try {
      await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: bookingId,
          is_viewed: true,
          is_reschedule_viewed: true,
        }),
      });

      setBookings((prev) =>
        debouncedSort === 'new'
          ? prev.filter((b) => b.id !== bookingId)
          : prev.map((b) =>
              b.id === bookingId
                ? { ...b, is_viewed: true, is_reschedule_viewed: true }
                : b
            )
      );

      window.dispatchEvent(new Event('bookings-viewed-update'));
    } catch (error) {
      console.error('Error marking booking as viewed:', error);
    }
  }, [debouncedSort]);

  const handleEdit = useCallback(
    (booking: Booking) => {
      const needsRescheduleAck =
        booking.is_reschedule_viewed === false &&
        String(booking.status ?? '').toLowerCase() === 'reschedule';
      if (!booking.is_viewed || needsRescheduleAck) {
        markBookingAsViewed(booking.id);
      }
      setEditingBooking(booking);
      setShowForm(true);
    },
    [markBookingAsViewed]
  );

  const handleCreate = useCallback(() => {
    setEditingBooking(null);
    setShowMultiStepForm(true);
  }, []);

  const handleFormSave = useCallback(async () => {
    setShowForm(false);
    setEditingBooking(null);
    await fetchBookings(
      currentPage,
      debouncedFilter,
      debouncedDate,
      debouncedStatus,
      debouncedEventType,
      debouncedSort
    );
    await fetchWorkspaceBookingStats();
    setShowBookingUpdatedSuccess(true);
    window.dispatchEvent(new Event('bookings-viewed-update'));
  }, [
    currentPage,
    debouncedFilter,
    debouncedDate,
    debouncedStatus,
    debouncedEventType,
    debouncedSort,
    fetchBookings,
    fetchWorkspaceBookingStats,
  ]);

  useEffect(() => {
    if (!showBookingUpdatedSuccess) return;
    const t = window.setTimeout(() => {
      setShowBookingUpdatedSuccess(false);
    }, 6000);
    return () => window.clearTimeout(t);
  }, [showBookingUpdatedSuccess]);

  const handleFormCancel = useCallback(() => {
    setShowForm(false);
    setShowMultiStepForm(false);
    setEditingBooking(null);
  }, []);

  const handleMultiStepFormSave = useCallback(async () => {
    setShowMultiStepForm(false);
    await fetchBookings(
      currentPage,
      debouncedFilter,
      debouncedDate,
      debouncedStatus,
      debouncedEventType,
      debouncedSort
    );
    await fetchWorkspaceBookingStats();
    window.dispatchEvent(new Event('bookings-viewed-update'));
  }, [
    currentPage,
    debouncedFilter,
    debouncedDate,
    debouncedStatus,
    debouncedEventType,
    debouncedSort,
    fetchBookings,
    fetchWorkspaceBookingStats,
  ]);

  /** When navigating to `/bookings/[id]`, keep the same viewed / reschedule-ack behavior as the old modal close. */
  const handleBeforeViewBooking = useCallback(
    (b: Pick<DisplayBooking, "id" | "is_viewed" | "is_reschedule_viewed" | "status">) => {
      const needsRescheduleAck =
        b.is_reschedule_viewed === false && b.status.toLowerCase() === "reschedule";
      if (!b.is_viewed || needsRescheduleAck) {
        markBookingAsViewed(b.id);
      }
    },
    [markBookingAsViewed]
  );

  const displayBookings = useMemo<DisplayBooking[]>(
    () =>
      bookings.map((booking) => {
        const creatorName =
          booking.creator?.name && booking.creator.name.trim()
            ? booking.creator.name.trim()
            : null;
        const guestName =
          (booking.invitee_name && booking.invitee_name.trim()) ||
          (booking.contacts?.name && booking.contacts.name.trim()) ||
          "Guest";
        const created_by: DisplayBooking["created_by"] = creatorName
          ? { name: creatorName, type: "admin" }
          : { name: guestName, type: "guest" };

        return {
          id: booking.id,
          name: getDisplayName(booking),
          date: formatDate(booking.start_at),
          time: formatTime(booking.start_at),
          type: booking.event_types?.title || "N/A",
          event_type_duration_minutes:
            booking.event_types?.duration_minutes ?? null,
          status: booking.status || "Pending",
          service_provider_id: booking.service_provider_id,
          service_provider_name: getServiceProviderName(
            booking.service_provider_id,
            serviceProviders
          ),
          created_at: booking.created_at
            ? `${formatDate(booking.created_at)} ${formatTime(booking.created_at)}`
            : "N/A",
          created_by,
          is_viewed: booking.is_viewed ?? true,
          is_reschedule_viewed: booking.is_reschedule_viewed ?? true,
        };
      }),
    [bookings, serviceProviders]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleResetFilters = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 md:p-6">
      <section className="mx-auto max-w-7xl space-y-5">
        {/* Hero header card */}
        <div className="overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex flex-col gap-5 border-b border-slate-100 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                <CalendarDays className="h-3.5 w-3.5" />
                Booking Management
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Bookings
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                View, manage, and track all scheduled appointments in one place.
              </p>
            </div>

            <button
              onClick={() => (showMultiStepForm ? handleMultiStepFormSave() : handleCreate())}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.01] hover:shadow-xl hover:shadow-indigo-500/25"
            >
              <Plus className="h-4 w-4" />
              {showMultiStepForm ? 'Cancel' : 'New Booking'}
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 md:px-7 xl:grid-cols-4">
            <StatsCard
              title="Total Bookings"
              value={allBookingsStats?.total ?? 0}
              icon={<CalendarDays className="h-5 w-5" />}
              iconWrap="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Confirmed"
              value={allBookingsStats?.confirmed ?? 0}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconWrap="bg-emerald-50 text-emerald-600"
            />
            <StatsCard
              title="Pending"
              value={allBookingsStats?.pending ?? 0}
              icon={<Clock3 className="h-5 w-5" />}
              iconWrap="bg-amber-50 text-amber-600"
            />
            <StatsCard
              title="Cancelled"
              value={allBookingsStats?.cancelled ?? 0}
              icon={<RefreshCcw className="h-5 w-5" />}
              iconWrap="bg-rose-50 text-rose-600"
            />
          </div>
        </div>

        {showBookingUpdatedSuccess && (
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
            role="status"
            aria-live="polite"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                Success
              </span>
              <span className="text-sm font-medium text-green-900">
                Booking has been updated
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowBookingUpdatedSuccess(false)}
              className="shrink-0 rounded-md p-1 text-green-700 transition hover:bg-green-100 hover:text-green-900"
              aria-label="Dismiss success message"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {showMultiStepForm && (
          <div
            className="fixed inset-0 z-999 overflow-y-auto bg-gray-50 m-0 bg-opacity-50"
            onClick={handleMultiStepFormSave}
          >
            <div
              className="w-full mx-auto h-full relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={handleMultiStepFormSave}
                className="cursor-pointer fixed z-10 top-2 right-2 text-slate-500 hover:text-slate-700 rounded-full transition-colors"
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
                onSave={handleMultiStepFormSave}
                onCancel={handleFormCancel}
              />
            </div>
          </div>
        )}

        {/* Filters card */}
        <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur">
          <BookingFilters
            filter={filter}
            dateFilter={dateFilter}
            statusFilter={statusFilter}
            eventTypeFilter={eventTypeFilter}
            sortFilter={sortFilter}
            eventTypes={eventTypes}
            resultCount={pagination.total}
            onFilterChange={setFilter}
            onDateFilterChange={setDateFilter}
            onClearDateFilter={() => setDateFilter("")}
            onStatusFilterChange={setStatusFilter}
            onEventTypeFilterChange={setEventTypeFilter}
            onSortFilterChange={setSortFilter}
            onResetFilters={handleResetFilters}
          />
        </div>

        {showForm && (
          <div
            className={`fixed inset-0 z-40 flex m-0 justify-end transition-opacity duration-200 ${
              showForm ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <div
              className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
                showForm ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden="true"
              onClick={handleFormCancel}
            />
            <section
              className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${
                showForm ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Edit Your Booking
                  </h3>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Make changes to your scheduled Bookings anytime.
                  </p>
                </div>
                <button
                  className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close booking form"
                  onClick={handleFormCancel}
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="h-[calc(100%-4rem)] overflow-y-auto p-6">
                <BookingForm
                  booking={editingBooking}
                  onSave={handleFormSave}
                  onCancel={handleFormCancel}
                />
              </div>
            </section>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur lg:block">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">All Bookings</h2>
            <p className="text-sm text-slate-500">
              Clean overview of your scheduled appointments and actions.
            </p>
          </div>

          {loading ? (
            <BookingTableSkeleton />
          ) : bookings.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto max-w-md">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                  <CalendarDays className="h-7 w-7" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  No bookings found
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Try adjusting your filters or create a new booking.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/80">
                  <tr className="text-left text-sm text-slate-600">
                    <th className="px-6 py-4 font-semibold">Client</th>
                    <th className="px-6 py-4 font-semibold">Booked Date / Time</th>
                    <th className="px-6 py-4 font-semibold">Service Provider</th>
                    <th className="px-6 py-4 font-semibold">Created At / Status</th>
                    <th className="px-6 py-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayBookings.map((displayBooking, index) => {
                    const actualBooking = bookings.find(
                      (b) => b.id === displayBooking.id
                    );
                    return (
                      <BookingTableRow
                        key={displayBooking.id}
                        displayBooking={displayBooking}
                        workspace_owner={workspaceOwner}
                        isLast={index === displayBookings.length - 1}
                        onView={() => handleBeforeViewBooking(displayBooking)}
                        onEdit={() =>
                          actualBooking && handleEdit(actualBooking)
                        }
                        onDelete={() => handleDeleteClick(displayBooking.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mobile / tablet cards */}
        <div className="space-y-4 lg:hidden">
          {loading ? (
            <BookingTableSkeleton />
          ) : displayBookings.length === 0 ? (
            <div className="rounded-[26px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <CalendarDays className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                No bookings found
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your filters or create a new booking.
              </p>
            </div>
          ) : (
            displayBookings.map((displayBooking) => {
              const actualBooking = bookings.find(
                (b) => b.id === displayBooking.id
              );
              return (
                <div
                  key={displayBooking.id}
                  className="rounded-[26px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {displayBooking.name}
                          </h3>
                          {!displayBooking.is_viewed && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              New
                            </span>
                          )}
                          {!displayBooking.is_reschedule_viewed &&
                            displayBooking.status.toLowerCase() === 'reschedule' && (
                              <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                                Reschedule
                              </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500">
                          {displayBooking.service_provider_name || 'Client Booking'}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={displayBooking.status} />
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                    <InfoItem
                      label="Booked Date / Time"
                      value={`${displayBooking.date} - ${displayBooking.time}`}
                      subtext={
                        displayBooking.event_type_duration_minutes
                          ? `${displayBooking.type} (${displayBooking.event_type_duration_minutes} mins)`
                          : displayBooking.type
                      }
                    />
                    <InfoItem
                      label="Service Provider"
                      value={displayBooking.service_provider_name || 'N/A'}
                    />
                    <InfoItem
                      label="Created At"
                      value={displayBooking.created_at}
                      subtext={`By ${capitalize_booking_display_label(
                        displayBooking.created_by.name
                      )} (${
                        displayBooking.created_by.type === 'guest'
                          ? 'Guest'
                          : 'Admin'
                      })`}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/bookings/${displayBooking.id}`}
                      onClick={() => handleBeforeViewBooking(displayBooking)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                    <button
                      onClick={() => actualBooking && handleEdit(actualBooking)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                    >
                      <SquarePen className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(displayBooking.id)}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={handlePageChange}
          loading={loading}
          itemLabel="bookings"
        />

        {deleteConfirmModal && (
          <ConfirmModal
            title="Delete Booking"
            message="Are you sure you want to delete this booking? This action cannot be undone."
            confirmLabel="Delete"
            variant="danger"
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteConfirmModal(null)}
          />
        )}

        {alertModal && (
          <AlertModal message={alertModal.message} onClose={() => setAlertModal(null)} />
        )}
      </section>
    </div>
  );
};

function StatsCard({
  title,
  value,
  icon,
  iconWrap,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  iconWrap: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconWrap}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-medium text-slate-700">{value}</p>
      {subtext && (
        <p className="text-xs text-slate-500">{subtext}</p>
      )}
    </div>
  );
}

export default BookingList;
