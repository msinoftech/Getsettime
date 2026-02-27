'use client';

import React from 'react';
import { BOOKING_STATUSES } from '@/src/types/booking';
import type { EventType } from '@/src/types/booking-entities';

interface BookingFiltersProps {
  filter: string;
  dateFilter: string;
  statusFilter: string;
  eventTypeFilter: string;
  sortFilter: string;
  eventTypes: EventType[];
  onFilterChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
  onClearDateFilter: () => void;
  onStatusFilterChange: (value: string) => void;
  onEventTypeFilterChange: (value: string) => void;
  onSortFilterChange: (value: string) => void;
}

export function BookingFilters({
  filter,
  dateFilter,
  statusFilter,
  eventTypeFilter,
  sortFilter,
  eventTypes,
  onFilterChange,
  onDateFilterChange,
  onClearDateFilter,
  onStatusFilterChange,
  onEventTypeFilterChange,
  onSortFilterChange,
}: BookingFiltersProps) {
  return (
    <div className="flex flex-col gap-4 mt-4">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <label
            htmlFor="search-filter"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Search
          </label>
          <input
            id="search-filter"
            type="text"
            placeholder="Search bookings..."
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Filter bookings"
          />
        </div>

        <div className="w-full md:w-1/2">
          <label
            htmlFor="date-filter"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Filter by Date
          </label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => onDateFilterChange(e.target.value)}
              className="w-full pl-10 pr-10 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Filter by date"
            />
            {dateFilter && (
              <button
                onClick={onClearDateFilter}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                aria-label="Clear date filter"
                title="Clear date filter"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/2">
          <label
            htmlFor="status-filter"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Filter by Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {BOOKING_STATUSES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/2">
          <label
            htmlFor="event-type-filter"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Filter by Event Type
          </label>
          <select
            id="event-type-filter"
            value={eventTypeFilter}
            onChange={(e) => onEventTypeFilterChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

        <div className="w-full md:w-1/2">
          <label
            htmlFor="sort-filter"
            className="block text-sm font-medium text-slate-700 mb-2"
          >
            Sort by
          </label>
          <select
            id="sort-filter"
            value={sortFilter}
            onChange={(e) => onSortFilterChange(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Sort bookings"
          >
            <option value="start_at">Date / Time</option>
            <option value="latest">Latest</option>
          </select>
        </div>
      </div>
    </div>
  );
}
