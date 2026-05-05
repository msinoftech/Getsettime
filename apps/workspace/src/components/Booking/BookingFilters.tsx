"use client";

import React, { useId, useState } from "react";
import {
  LuChevronDown,
  LuChevronUp,
  LuFilter,
  LuRefreshCw,
  LuSearch,
  LuSlidersHorizontal,
  LuX,
} from "react-icons/lu";
import { BOOKING_STATUSES } from "@/src/types/booking";
import { BOOKING_SORT_OPTIONS } from "@app/db";
import type { EventType, ServiceProvider } from "@/src/types/booking-entities";
import { capitalize_booking_display_label, getServiceProviderName } from "@/src/utils/booking";

interface BookingFiltersProps {
  filter: string;
  dateFilter: string;
  statusFilter: string;
  eventTypeFilter: string;
  providerFilter: string;
  sortFilter: string;
  eventTypes: EventType[] | undefined;
  serviceProviders: ServiceProvider[] | undefined;
  /** Count of rows matching the current query (e.g. pagination total). */
  resultCount: number;
  onFilterChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
  onClearDateFilter: () => void;
  onStatusFilterChange: (value: string) => void;
  onEventTypeFilterChange: (value: string) => void;
  onProviderFilterChange: (value: string) => void;
  onSortFilterChange: (value: string) => void;
  onResetFilters?: () => void;
}

const inputBase =
  "box-border w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 pl-11 text-sm font-normal leading-normal text-slate-900 shadow-none outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200";
const selectClass =
  "w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 shadow-none outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200";

const BOOKING_SORT_OPTIONS_WORKSPACE = BOOKING_SORT_OPTIONS.map((opt) =>
  opt.value === "new"
    ? { ...opt, label: "New / Reschedule alerts" }
    : opt.value === "service_provider"
      ? { ...opt, label: "Service provider (then date)" }
      : opt
);

export function BookingFilters({
  filter,
  dateFilter,
  statusFilter,
  eventTypeFilter,
  providerFilter,
  sortFilter,
  eventTypes,
  serviceProviders,
  resultCount,
  onFilterChange,
  onDateFilterChange,
  onClearDateFilter,
  onStatusFilterChange,
  onEventTypeFilterChange,
  onProviderFilterChange,
  onSortFilterChange,
  onResetFilters,
}: BookingFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const panelId = useId();
  const eventTypesList = eventTypes ?? [];
  const providersList = serviceProviders ?? [];
  const sortedProviders = [...providersList].sort((a, b) =>
    capitalize_booking_display_label(
      getServiceProviderName(a.id, providersList)
    ).localeCompare(
      capitalize_booking_display_label(getServiceProviderName(b.id, providersList)),
      undefined,
      { sensitivity: "base" }
    )
  );

  const hasActiveFilters =
    filter.trim() !== "" ||
    dateFilter !== "" ||
    statusFilter !== "" ||
    eventTypeFilter !== "" ||
    providerFilter !== "" ||
    sortFilter !== "start_at";

  const handleReset = () => {
    onFilterChange("");
    onDateFilterChange("");
    onClearDateFilter();
    onStatusFilterChange("");
    onEventTypeFilterChange("");
    onProviderFilterChange("");
    onSortFilterChange("start_at");
    onResetFilters?.();
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
        <div className="relative min-h-12 w-full min-w-0 sm:min-w-[12rem] sm:flex-1">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400"
            aria-hidden
          >
            <LuSearch className="h-4 w-4 shrink-0" />
          </div>
          <input
            id="search-filter"
            type="search"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="Search client, provider, creator…"
            className={inputBase}
            aria-label="Search bookings by client, provider, or creator"
            autoComplete="off"
          />
        </div>

        <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
          <button
            type="button"
            onClick={() => setShowAdvanced((o) => !o)}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 sm:h-11 sm:flex-initial sm:px-4"
            aria-expanded={showAdvanced}
            aria-controls={panelId}
          >
            <LuSlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
            Filters
            {showAdvanced ? (
              <LuChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            ) : (
              <LuChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:flex-initial sm:px-4"
          >
            <LuRefreshCw className="h-4 w-4 shrink-0" aria-hidden />
            Reset
          </button>
        </div>
      </div>

      {showAdvanced && (
        <div
          id={panelId}
          className="mt-4 border-t border-slate-100 pt-4"
        >
          <div className="mb-4 flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <LuFilter className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Advanced Filters
              </h3>
              <p className="text-sm text-slate-500">
                Refine bookings by status, event type, service provider, and sorting.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0">
              <label
                htmlFor="status-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Status
              </label>
              <div className="relative">
                <select
                  id="status-filter"
                  value={statusFilter}
                  onChange={(e) => onStatusFilterChange(e.target.value)}
                  className={selectClass}
                  aria-label="Filter by status"
                >
                  <option value="">All Status</option>
                  {BOOKING_STATUSES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="event-type-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Event type
              </label>
              <div className="relative">
                <select
                  id="event-type-filter"
                  value={eventTypeFilter}
                  onChange={(e) => onEventTypeFilterChange(e.target.value)}
                  className={selectClass}
                  aria-label="Filter by event type"
                >
                  <option value="">All Event Types</option>
                  {[...eventTypesList]
                    .sort(
                      (a, b) =>
                        (a.duration_minutes ?? Infinity) -
                        (b.duration_minutes ?? Infinity)
                    )
                    .map((eventType) => (
                      <option key={eventType.id} value={eventType.id}>
                        {eventType.title}
                      </option>
                    ))}
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="provider-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Service provider
              </label>
              <div className="relative">
                <select
                  id="provider-filter"
                  value={providerFilter}
                  onChange={(e) => onProviderFilterChange(e.target.value)}
                  className={selectClass}
                  aria-label="Filter by service provider"
                >
                  <option value="">All service providers</option>
                  {sortedProviders.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {capitalize_booking_display_label(
                        getServiceProviderName(sp.id, providersList)
                      )}
                    </option>
                  ))}
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="sort-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Date / time
              </label>
              <div className="relative">
                <select
                  id="sort-filter"
                  value={sortFilter}
                  onChange={(e) => onSortFilterChange(e.target.value)}
                  className={selectClass}
                  aria-label="Sort by date and time"
                >
                  {BOOKING_SORT_OPTIONS_WORKSPACE.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            <div className="relative z-[1] min-w-0">
              <label
                htmlFor="date-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Specific date
              </label>
              <div className="grid w-full min-w-0 grid-cols-[1fr_auto] items-center gap-2">
                <input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => onDateFilterChange(e.target.value)}
                  className="box-border h-11 min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 [color-scheme:light] focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-datetime-edit-text]:p-0 [&::-webkit-datetime-edit]:m-0 [&::-webkit-datetime-edit]:p-0"
                  aria-label="Filter by a specific date"
                />
                {dateFilter ? (
                  <button
                    type="button"
                    onClick={onClearDateFilter}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                    aria-label="Clear date filter"
                  >
                    <LuX className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <span className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-sm font-medium text-violet-700">
              Results: {resultCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
