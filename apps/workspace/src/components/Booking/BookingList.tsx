"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { type Booking } from "@/src/types/booking";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { useEventTypes, useDepartments, useServices, useServiceProviders } from "@/src/hooks/useBookingLookups";
import { formatDate, formatTime } from "@/src/utils/date";
import { getServiceProviderName, getDisplayName } from "@/src/utils/booking";
import { normalizeIntakeForm } from "@/src/utils/intakeForm";
import BookingForm from "./BookingForm";
import MultiStepBookingForm from "./MultiStepBookingForm";
import { BookingFilters } from "./BookingFilters";
import { BookingTableRow, type DisplayBooking } from "./BookingTableRow";
import { BookingDetailsModal } from "./BookingDetailsModal";
import { Pagination } from "@app/ui";
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
  const { settings } = useWorkspaceSettings();
  const { data: eventTypes } = useEventTypes();
  const { data: departments } = useDepartments();
  const { data: serviceProviders } = useServiceProviders();
  const { data: services } = useServices();

  const intakeFormSettings = useMemo(
    () => normalizeIntakeForm(settings?.intake_form),
    [settings?.intake_form]
  );

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
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ id: string } | null>(null);
  const [alertModal, setAlertModal] = useState<{ message: string } | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
  });
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
    ]
  );

  const handleEdit = useCallback((booking: Booking) => {
    setEditingBooking(booking);
    setShowForm(true);
  }, []);

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
  }, [
    currentPage,
    debouncedFilter,
    debouncedDate,
    debouncedStatus,
    debouncedEventType,
    debouncedSort,
    fetchBookings,
  ]);

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
  }, [
    currentPage,
    debouncedFilter,
    debouncedDate,
    debouncedStatus,
    debouncedEventType,
    debouncedSort,
    fetchBookings,
  ]);

  const handleViewBooking = useCallback((booking: Booking) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  }, []);

  const displayBookings = useMemo<DisplayBooking[]>(
    () =>
      bookings.map((booking) => ({
        id: booking.id,
        name: getDisplayName(booking),
        date: formatDate(booking.start_at),
        time: formatTime(booking.start_at),
        type: booking.event_types?.title || "N/A",
        status: booking.status || "Pending",
        service_provider_name: getServiceProviderName(
          booking.service_provider_id,
          serviceProviders
        ),
        created_at: booking.created_at
          ? `${formatDate(booking.created_at)} ${formatTime(booking.created_at)}`
          : "N/A",
      })),
    [bookings, serviceProviders]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">Bookings</h3>
          <p className="text-xs text-slate-500">
            View and manage all your scheduled appointments in one place.
          </p>
        </div>
        <button
          onClick={() => (showMultiStepForm ? handleFormCancel() : handleCreate())}
          className="cursor-pointer text-sm font-bold text-indigo-600 transition"
        >
          {showMultiStepForm ? "Cancel" : "+ New Booking"}
        </button>
      </header>

      {showMultiStepForm && (
        <div
          className="fixed inset-0 z-999 overflow-y-auto bg-gray-50 m-0 bg-opacity-50"
          onClick={handleFormCancel}
        >
          <div
            className="w-full mx-auto h-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleFormCancel}
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

      <BookingFilters
        filter={filter}
        dateFilter={dateFilter}
        statusFilter={statusFilter}
        eventTypeFilter={eventTypeFilter}
        sortFilter={sortFilter}
        eventTypes={eventTypes}
        onFilterChange={setFilter}
        onDateFilterChange={setDateFilter}
        onClearDateFilter={() => setDateFilter("")}
        onStatusFilterChange={setStatusFilter}
        onEventTypeFilterChange={setEventTypeFilter}
        onSortFilterChange={setSortFilter}
      />

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

      <div className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            Loading bookings...
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No bookings found</p>
            <p className="text-sm">
              Click &quot;New Booking&quot; to create your first booking
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="border border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Booked Date / Time
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Service Provider
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">
                    Created At
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-slate-700 tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayBookings.map((displayBooking) => {
                  const actualBooking = bookings.find(
                    (b) => b.id === displayBooking.id
                  );
                  return (
                    <BookingTableRow
                      key={displayBooking.id}
                      displayBooking={displayBooking}
                      onView={() =>
                        actualBooking && handleViewBooking(actualBooking)
                      }
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

      <Pagination
        currentPage={currentPage}
        totalPages={pagination.totalPages}
        totalItems={pagination.total}
        itemsPerPage={ITEMS_PER_PAGE}
        onPageChange={handlePageChange}
        loading={loading}
        itemLabel="bookings"
      />

      {isModalOpen && selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          onClose={() => setIsModalOpen(false)}
          intakeFormSettings={intakeFormSettings}
          services={services}
          departments={departments}
          serviceProviders={serviceProviders}
        />
      )}

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
  );
};

export default BookingList;
