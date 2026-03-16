"use client";

import React, { useState, useEffect, useCallback } from 'react';
import type { Booking } from '@/src/types/booking';
import { type Workspace, BOOKING_STATUSES, BOOKING_SORT_OPTIONS } from '@app/db';
import { BookingTableSkeleton } from '@/src/components/Booking/BookingTableSkeleton';

interface BookingListProps {
  workspaces: Workspace[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface EventType {
  id: string;
  title: string;
}

const BookingList = ({ workspaces }: BookingListProps) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('');
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [sortFilter, setSortFilter] = useState('start_at');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const itemsPerPage = 10;

  // Debounce filter input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(filter);
      setCurrentPage(1); // Reset to first page when filter changes
    }, 500);

    return () => clearTimeout(timer);
  }, [filter]);

  // Extract unique event types from bookings
  useEffect(() => {
    if (bookings.length > 0) {
      const uniqueEventTypes = bookings.reduce((acc: EventType[], booking) => {
        if (booking.event_types && booking.event_type_id) {
          const exists = acc.some(et => et.id === booking.event_type_id);
          if (!exists) {
            acc.push({
              id: booking.event_type_id,
              title: booking.event_types.title
            });
          }
        }
        return acc;
      }, []);
      setEventTypes(uniqueEventTypes);
    }
  }, [bookings]);

  // Fetch bookings from API
  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sort: sortFilter,
      });

      if (debouncedFilter) {
        params.append('filter', debouncedFilter);
      }

      if (dateFilter.trim()) {
        params.append('date', dateFilter.trim());
      }

      if (statusFilter.trim()) {
        params.append('status', statusFilter.trim());
      }

      if (eventTypeFilter.trim()) {
        params.append('event_type_id', eventTypeFilter.trim());
      }

      if (workspaceFilter.trim()) {
        params.append('workspace_id', workspaceFilter.trim());
      }

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        setBookings(data.bookings || []);
        setPagination(data.pagination || {
          page: currentPage,
          limit: itemsPerPage,
          total: 0,
          totalPages: 0,
        });
      } else {
        console.error('Error fetching bookings:', data.error);
        setBookings([]);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortFilter, debouncedFilter, dateFilter, statusFilter, eventTypeFilter, workspaceFilter, itemsPerPage]);

  // Fetch bookings when dependencies change
  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Get workspace name by ID
  const getWorkspaceName = (workspaceId: string | null): string => {
    if (!workspaceId) return 'N/A';
    const workspace = workspaces.find(w => String(w.id) === String(workspaceId));
    return workspace?.name || 'N/A';
  };

  // Format date and time from timestamptz
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const formatTime = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Transform bookings for display
  const displayBookings = bookings.map((booking) => ({
    id: booking.id,
    name: booking.invitee_name || 'N/A',
    dateTime: `${formatDate(booking.start_at)} - ${formatTime(booking.start_at)}`,
    type: booking.event_types?.title || 'N/A',
    workspace: getWorkspaceName(booking.workspace_id),
    status: booking.status || 'Pending',
    created_at: booking.created_at
      ? `${formatDate(booking.created_at)} ${formatTime(booking.created_at)}`
      : 'N/A',
    is_viewed: booking.is_viewed ?? true,
  }));

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value);
  };

  const handleDateFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDateFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleClearDateFilter = () => {
    setDateFilter('');
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleEventTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEventTypeFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleWorkspaceFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setWorkspaceFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSortFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortFilter(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-800">All Bookings</h2>
      </header>

      {/* Search and Filters */}
      <div className="bg-white shadow-sm border border-slate-100/50 px-3 py-3 sm:px-4 sm:py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left side: main filters */}
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 lg:gap-3">
            {/* Search Filter */}
            <div className="w-full sm:flex-1 sm:min-w-[220px]">
              <input
                id="search-filter"
                type="text"
                placeholder="Search by name, email, or workspace..."
                value={filter}
                onChange={handleFilterChange}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter bookings"
              />
            </div>

            {/* Date Filter */}
            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <div className="relative">
                <input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={handleDateFilterChange}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  aria-label="Filter by date"
                />
                {dateFilter && (
                  <button
                    onClick={handleClearDateFilter}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label="Clear date filter"
                    title="Clear date filter"
                    type="button"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            {/* Status Filter */}
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <select
                id="status-filter"
                value={statusFilter}
                onChange={handleStatusFilterChange}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by status"
              >
                <option value="">All Status</option>
                {BOOKING_STATUSES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Event Type Filter */}
            <div className="w-full sm:w-auto sm:min-w-[170px]">
              <select
                id="event-type-filter"
                value={eventTypeFilter}
                onChange={handleEventTypeFilterChange}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by event type"
              >
                <option value="">All Event Types</option>
                {eventTypes.map((eventType) => (
                  <option key={eventType.id} value={eventType.id}>
                    {eventType.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Workspace Filter */}
            <div className="w-full sm:w-auto sm:min-w-[170px]">
              <select
                id="workspace-filter"
                value={workspaceFilter}
                onChange={handleWorkspaceFilterChange}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Filter by workspace"
              >
                <option value="">All Workspaces</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Filter */}
            <div className="w-full sm:w-auto sm:min-w-[150px]">
              <select
                id="sort-filter"
                value={sortFilter}
                onChange={handleSortFilterChange}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label="Sort bookings"
              >
                {BOOKING_SORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </div>

      <div className="overflow-hidden">
        {loading ? (
          <BookingTableSkeleton />
        ) : bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No bookings found</p>
            {debouncedFilter && (
              <p className="text-sm">Try adjusting your search criteria</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="border border-slate-200">
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Booked Date / Time</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Workspace</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-700 tracking-wider">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayBookings.map((displayBooking) => {
                  const status = displayBooking.status?.toLowerCase();
                  return (
                    <tr key={displayBooking.id} className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Name">
                        <span className="font-medium text-slate-900">
                          {displayBooking.name}
                          {!displayBooking.is_viewed && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              New
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Date-Time">
                        <span className="text-slate-700">{displayBooking.dateTime}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Type">
                        <span className="text-sm text-slate-500">{displayBooking.type}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Workspace">
                        <span className="text-sm text-slate-700">{displayBooking.workspace}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Status">
                        <span
                          className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                            status === 'confirmed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : status === 'emergency'
                              ? 'bg-orange-100 text-orange-700'
                              : status === 'completed'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {displayBooking.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap align-middle text-sm" data-label="Created At">
                        <span className="text-slate-600">{displayBooking.created_at}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination.total > 0 && (
        <div className="flex justify-between flex-wrap items-center gap-4">
          <div className="text-sm text-slate-600">
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, pagination.total)} of {pagination.total} bookings
          </div>
          <div className="flex justify-center flex-wrap gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                currentPage === 1 || loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              aria-label="Previous page"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, index) => {
              let pageNum: number;
              if (pagination.totalPages <= 10) {
                pageNum = index + 1;
              } else if (currentPage <= 5) {
                pageNum = index + 1;
              } else if (currentPage >= pagination.totalPages - 4) {
                pageNum = pagination.totalPages - 9 + index;
              } else {
                pageNum = currentPage - 5 + index;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  aria-label={`Go to page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === pagination.totalPages || loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                currentPage === pagination.totalPages || loading
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default BookingList;