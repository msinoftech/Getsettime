"use client";

import { useId, useState } from "react";
import {
  LuChevronDown,
  LuChevronUp,
  LuFilter,
  LuRefreshCw,
  LuSearch,
} from "react-icons/lu";
import type { event_type_service_provider_option } from "@/src/features/event-types/EventTypeFormLayout";
import type { event_type_format } from "@/src/types/event_types";
import ScreenGate from "@/src/components/ScreenGate";

type visibility_filter_value = "all" | "private" | "public";
type status_filter_value = "" | "active" | "draft";
export type event_type_format_filter_value = "all" | event_type_format;

type EventTypeFiltersProps = {
  search: string;
  format_filter: event_type_format_filter_value;
  visibility_filter: visibility_filter_value;
  status_filter: status_filter_value;
  provider_filter: string;
  show_service_provider_filter: boolean;
  service_provider_options: event_type_service_provider_option[];
  service_provider_filter_label: (providerId: string) => string;
  result_count: number;
  on_search_change: (value: string) => void;
  on_format_filter_change: (value: event_type_format_filter_value) => void;
  on_visibility_filter_change: (value: visibility_filter_value) => void;
  on_status_filter_change: (value: status_filter_value) => void;
  on_provider_filter_change: (value: string) => void;
};

const FORMAT_TABS: ReadonlyArray<{
  value: event_type_format_filter_value;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "one_on_one", label: "One-on-one" },
  { value: "group_class", label: "Group" },
  { value: "recurring", label: "Recurring" },
];

const select_class =
  "w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 shadow-none outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200";

export function EventTypeFilters({
  search,
  format_filter,
  visibility_filter,
  status_filter,
  provider_filter,
  show_service_provider_filter,
  service_provider_options,
  service_provider_filter_label,
  result_count,
  on_search_change,
  on_format_filter_change,
  on_visibility_filter_change,
  on_status_filter_change,
  on_provider_filter_change,
}: EventTypeFiltersProps) {
  const [show_advanced, set_show_advanced] = useState(false);
  const panel_id = useId();

  const has_active_filters =
    search.trim() !== "" ||
    format_filter !== "all" ||
    visibility_filter !== "all" ||
    status_filter !== "" ||
    provider_filter !== "";

  const handle_reset = () => {
    on_search_change("");
    on_format_filter_change("all");
    on_visibility_filter_change("all");
    on_status_filter_change("");
    on_provider_filter_change("");
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="flex flex-wrap items-center gap-1 border-b border-transparent lg:border-0"
          role="tablist"
          aria-label="Event type format"
        >
          {FORMAT_TABS.map((tab) => {
            const selected = format_filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => on_format_filter_change(tab.value)}
                className={`relative px-4 py-2 text-sm font-medium transition border rounded-lg ${
                  selected
                    ? "text-indigo-600 border-indigo-300 bg-indigo-50"
                    : "text-slate-500 hover:text-slate-800 border-slate-200"
                }`}
              >
                {tab.label}
                {/* {selected ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-600" />
                ) : null} */}
              </button>
            );
          })}
        </div>

        <ScreenGate minWidth={1024}>
        <div className="w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 flex lg:max-w-xl lg:flex-1 lg:justify-end">
          <div className="relative min-h-12 w-full min-w-0 sm:flex-1">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400"
              aria-hidden
            >
              <LuSearch className="h-4 w-4 shrink-0" />
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => on_search_change(e.target.value)}
              placeholder="Search event types..."
              className="box-border h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
              aria-label="Search event types"
              autoComplete="off"
            />
          </div>

          <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => set_show_advanced((open) => !open)}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 sm:flex-initial sm:px-4"
              aria-expanded={show_advanced}
              aria-controls={panel_id}
            >
              <LuFilter className="h-4 w-4 shrink-0" aria-hidden />
              Filter
              {show_advanced ? (
                <LuChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              ) : (
                <LuChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={handle_reset}
              disabled={!has_active_filters}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-4"
            >
              <LuRefreshCw className="h-4 w-4 shrink-0" aria-hidden />
              Reset
            </button>
          </div>
        </div>
        </ScreenGate>
      </div>

      {show_advanced ? (
        <div id={panel_id} className="mt-4 hidden border-t border-slate-100 pt-4 md:block">
          <div className="mb-4 flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <LuFilter className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Advanced Filters</h3>
              <p className="text-sm text-slate-500">
                Refine event types by status, visibility, and service provider.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-3">
            <div className="min-w-0">
              <label
                htmlFor="event-type-status-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Status
              </label>
              <div className="relative">
                <select
                  id="event-type-status-filter"
                  value={status_filter}
                  onChange={(e) =>
                    on_status_filter_change(e.target.value as status_filter_value)
                  }
                  className={select_class}
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            <div className="min-w-0">
              <label
                htmlFor="event-type-visibility-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Visibility
              </label>
              <div className="relative">
                <select
                  id="event-type-visibility-filter"
                  value={visibility_filter}
                  onChange={(e) =>
                    on_visibility_filter_change(e.target.value as visibility_filter_value)
                  }
                  className={select_class}
                  aria-label="Filter by visibility"
                >
                  <option value="all">All visibility</option>
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            {show_service_provider_filter ? (
              <div className="min-w-0">
                <label
                  htmlFor="event-type-provider-filter"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  Service provider
                </label>
                <div className="relative">
                  <select
                    id="event-type-provider-filter"
                    value={provider_filter}
                    onChange={(e) => on_provider_filter_change(e.target.value)}
                    className={select_class}
                    aria-label="Filter by service provider"
                  >
                    <option value="">All providers</option>
                    {service_provider_options.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {service_provider_filter_label(sp.id)}
                      </option>
                    ))}
                  </select>
                  <LuChevronDown
                    className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3">
            <span className="inline-flex items-center rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-600">
              Results: {result_count}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
