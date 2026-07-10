"use client";

import {
  LuBuilding2 as Building2,
  LuChevronDown as ChevronDown,
  LuMapPin as MapPin,
  LuRefreshCw as RefreshCw,
  LuShieldCheck as ShieldCheck,
  LuUserRound as UserRound,
  LuUserRoundPen as UserRoundPen,
  LuWrench as Wrench,
} from "react-icons/lu";

export type CalendarStatusFilterOption =
  | "all"
  | "confirmed"
  | "pending"
  | "cancelled"
  | "completed"
  | "reschedule"
  | "no_show";

type CalendarFiltersBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: CalendarStatusFilterOption;
  onStatusFilterChange: (value: CalendarStatusFilterOption) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (value: string) => void;
  serviceFilter: string;
  onServiceFilterChange: (value: string) => void;
  providerFilter: string;
  onProviderFilterChange: (value: string) => void;
  departmentOptions: Array<{ value: string; label: string }>;
  serviceOptions: Array<{ value: string; label: string }>;
  providerOptions: Array<{ value: string; label: string }>;
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
};

export function CalendarFiltersBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  departmentFilter,
  onDepartmentFilterChange,
  serviceFilter,
  onServiceFilterChange,
  providerFilter,
  onProviderFilterChange,
  departmentOptions,
  serviceOptions,
  providerOptions,
  monthLabel: _monthLabel,
  onPreviousMonth: _onPreviousMonth,
  onNextMonth: _onNextMonth,
}: CalendarFiltersBarProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Building2 className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={departmentFilter}
            onChange={(e) => onDepartmentFilterChange(e.target.value)}
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">All Departments</option>
            {departmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative min-w-[150px] flex-1">
        <UserRoundPen className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={serviceFilter}
            onChange={(e) => onServiceFilterChange(e.target.value)}
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">All Services</option>
            {serviceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative min-w-[150px] flex-1">
          <UserRound className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={providerFilter}
            onChange={(e) => onProviderFilterChange(e.target.value)}
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">All Providers</option>
            {providerOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative min-w-[150px] flex-1">
          <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as CalendarStatusFilterOption)
            }
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
            <option value="reschedule">Reschedule</option>
            <option value="no_show">No Show</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <div className="relative min-w-[150px] flex-1">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <select
            className="h-9 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-8 text-xs font-semibold text-slate-700 outline-none"
            defaultValue="all-locations"
          >
            <option value="all-locations">All Locations</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>

        <button
          type="button"
          onClick={() => {
            onSearchChange("");
            onStatusFilterChange("all");
            onDepartmentFilterChange("all");
            onServiceFilterChange("all");
            onProviderFilterChange("all");
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Clear all
        </button>
      </div>
    </div>
  );
}
