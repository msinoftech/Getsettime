'use client';

import React from 'react';
import { BOOKING_STATUSES } from '@/src/types/booking';
import { BOOKING_SORT_OPTIONS } from '@app/db';
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
  onResetFilters?: () => void;
}

const inputBase =
  'w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none';
const selectBase =
  'w-full px-3 py-2 rounded-md border border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none';

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
  onResetFilters,
}: BookingFiltersProps) {
  const hasActiveFilters =
    filter.trim() !== '' ||
    dateFilter !== '' ||
    statusFilter !== '' ||
    eventTypeFilter !== '' ||
    sortFilter !== 'start_at';

  const handleReset = () => {
    onFilterChange('');
    onDateFilterChange('');
    onClearDateFilter();
    onStatusFilterChange('');
    onEventTypeFilterChange('');
    onSortFilterChange('start_at');
    onResetFilters?.();
  };

  return (
    <div className="space-y-6">
      {/* Filter Card */}
      <div className="bg-white border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
            {/* Search by name */}
            <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
              <input
                id="search-filter"
                type="text"
                placeholder="Search by name..."
                value={filter}
                onChange={(e) => onFilterChange(e.target.value)}
                className={`pl-7 ${inputBase}`}
                aria-label="Search bookings by name"
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
            </div>

            {/* Date / Calendar filter */}
            <div className="relative min-w-0">
              <input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => onDateFilterChange(e.target.value)}
                className={`${inputBase} ${dateFilter ? 'pr-10' : ''}`}
                aria-label="Filter by date"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={onClearDateFilter}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Clear date filter"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Status */}
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className={`min-w-0 ${selectBase}`}
              aria-label="Filter by status"
            >
              <option value="">All Status</option>
              {BOOKING_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>

            {/* Event Type */}
            <select
              id="event-type-filter"
              value={eventTypeFilter}
              onChange={(e) => onEventTypeFilterChange(e.target.value)}
              className={`min-w-0 ${selectBase}`}
              aria-label="Filter by event type"
            >
              <option value="">All Event Types</option>
              {[...eventTypes]
                .sort((a, b) => (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity))
                .map((eventType) => (
                <option key={eventType.id} value={eventType.id}>
                  {eventType.title}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              id="sort-filter"
              value={sortFilter}
              onChange={(e) => onSortFilterChange(e.target.value)}
              className={`min-w-0 ${selectBase}`}
              aria-label="Sort bookings"
            >
              {BOOKING_SORT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="w-full text-sm text-gray-500 hover:text-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-gray-500 sm:w-auto lg:shrink-0"
            disabled={!hasActiveFilters}
          >
            Reset Filters
          </button>
        </div>
      </div>
    </div>
  );
}
