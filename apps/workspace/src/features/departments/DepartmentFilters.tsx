"use client";

import { useId, useState, type ReactNode } from "react";
import {
  LuChevronDown,
  LuChevronUp,
  LuFilter,
  LuRefreshCw,
  LuSearch,
  LuSlidersHorizontal,
} from "react-icons/lu";

export type department_status_filter = "all" | "active" | "private" | "draft";

export type department_filter_option = {
  id: string;
  label: string;
};

type DepartmentFiltersProps = {
  leading?: ReactNode;
  search: string;
  status_filter: department_status_filter;
  service_filter: string;
  doctor_filter: string;
  service_options: department_filter_option[];
  doctor_options: department_filter_option[];
  show_service_filter: boolean;
  show_doctor_filter: boolean;
  result_count: number;
  on_search_change: (value: string) => void;
  on_status_filter_change: (value: department_status_filter) => void;
  on_service_filter_change: (value: string) => void;
  on_doctor_filter_change: (value: string) => void;
};

const select_class =
  "w-full min-w-0 cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm text-slate-900 shadow-none outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-200";

export function DepartmentFilters({
  leading = null,
  search,
  status_filter,
  service_filter,
  doctor_filter,
  service_options,
  doctor_options,
  show_service_filter,
  show_doctor_filter,
  result_count,
  on_search_change,
  on_status_filter_change,
  on_service_filter_change,
  on_doctor_filter_change,
}: DepartmentFiltersProps) {
  const [show_advanced, set_show_advanced] = useState(false);
  const panel_id = useId();

  const has_active_filters =
    search.trim() !== "" ||
    status_filter !== "all" ||
    service_filter !== "" ||
    doctor_filter !== "";

  const handle_reset = () => {
    on_search_change("");
    on_status_filter_change("all");
    on_service_filter_change("");
    on_doctor_filter_change("");
  };

  return (
    <div className="w-full min-w-0">
      <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {leading ? <div className="min-w-0 shrink-0">{leading}</div> : null}
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 lg:max-w-3xl lg:flex-1 lg:justify-end">
          <div className="relative min-h-11 w-full min-w-0 sm:w-1/2 sm:flex-none">
            <input
              type="search"
              value={search}
              onChange={(e) => on_search_change(e.target.value)}
              placeholder="Search departments..."
              className="box-border h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-200"
              aria-label="Search departments"
              autoComplete="off"
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400"
              aria-hidden
            >
              <LuSearch className="h-4 w-4 shrink-0" />
            </div>
          </div>

          <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <button
              type="button"
              onClick={() => set_show_advanced((open) => !open)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 sm:flex-initial sm:px-4"
              aria-expanded={show_advanced}
              aria-controls={panel_id}
            >
              <LuSlidersHorizontal className="h-4 w-4 shrink-0" aria-hidden />
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
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-4"
            >
              <LuRefreshCw className="h-4 w-4 shrink-0" aria-hidden />
              Reset
            </button>
          </div>
        </div>
      </div>

      {show_advanced ? (
        <div id={panel_id} className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-4 flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <LuFilter className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Advanced Filters
              </h3>
              <p className="text-sm text-slate-500">
                Refine departments by status, linked services, and consultants.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div className="min-w-0">
              <label
                htmlFor="department-status-filter"
                className="mb-1.5 block text-xs font-medium text-slate-500"
              >
                Status
              </label>
              <div className="relative">
                <select
                  id="department-status-filter"
                  value={status_filter}
                  onChange={(e) =>
                    on_status_filter_change(
                      e.target.value as department_status_filter
                    )
                  }
                  className={select_class}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Public</option>
                  <option value="private">Private</option>
                  <option value="draft">Draft</option>
                </select>
                <LuChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>

            {show_service_filter ? (
              <div className="min-w-0">
                <label
                  htmlFor="department-service-filter"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  Services
                </label>
                <div className="relative">
                  <select
                    id="department-service-filter"
                    value={service_filter}
                    onChange={(e) => on_service_filter_change(e.target.value)}
                    className={select_class}
                    aria-label="Filter by service"
                  >
                    <option value="">All services</option>
                    {service_options.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.label}
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

            {show_doctor_filter ? (
              <div className="min-w-0">
                <label
                  htmlFor="department-doctor-filter"
                  className="mb-1.5 block text-xs font-medium text-slate-500"
                >
                  Consultants
                </label>
                <div className="relative">
                  <select
                    id="department-doctor-filter"
                    value={doctor_filter}
                    onChange={(e) => on_doctor_filter_change(e.target.value)}
                    className={select_class}
                    aria-label="Filter by consultant"
                  >
                    <option value="">All Consultants</option>
                    {doctor_options.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.label}
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
            <span className="inline-flex items-center rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
              Results: {result_count}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
