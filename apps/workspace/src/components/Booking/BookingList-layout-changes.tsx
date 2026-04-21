"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  SquarePen,
  Trash2,
  Eye,
  UserRound,
  BriefcaseMedical,
  ChevronDown,
  User2,
  SlidersHorizontal,
} from "lucide-react";

type BookingStatus = "confirmed" | "pending" | "cancelled";

type Booking = {
  id: number;
  name: string;
  bookedDate: string;
  type: string;
  duration: string;
  serviceProvider: string;
  createdBy: string;
  status: BookingStatus;
  createdAt: string;
};

const initialBookings: Booking[] = [
  {
    id: 1,
    name: "Kuldeep",
    bookedDate: "Apr 17, 2026 - 10:00 AM",
    type: "30mins-chat",
    duration: "30mins",
    serviceProvider: "Kuldeep Singh",
    createdBy: "Workspace Admin",
    status: "confirmed",
    createdAt: "Apr 14, 2026 05:15 PM",
  },
  {
    id: 2,
    name: "kuldeep",
    bookedDate: "Apr 3, 2026 - 10:10 AM",
    type: "Quick call",
    duration: "70mins",
    serviceProvider: "Kuldeep Singh",
    createdBy: "Kuldeep Singh",
    status: "confirmed",
    createdAt: "Apr 2, 2026 02:32 PM",
  },
];

const statusOptions = ["All Status", "confirmed", "pending", "cancelled"];
const eventTypeOptions = ["All Event Types", "30mins-chat", "Quick call"];
const sortOptions = ["Date / Time", "Newest First", "Oldest First", "A-Z", "Z-A"];

export default function BookingsManagementPage() {
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedEventType, setSelectedEventType] = useState("All Event Types");
  const [selectedSort, setSelectedSort] = useState("Date / Time");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const bookings = useMemo(() => {
    let filtered = [...initialBookings];

    if (search.trim()) {
      filtered = filtered.filter(
        (booking) =>
          booking.name.toLowerCase().includes(search.toLowerCase()) ||
          booking.serviceProvider.toLowerCase().includes(search.toLowerCase()) ||
          booking.createdBy.toLowerCase().includes(search.toLowerCase()) ||
          booking.type.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (selectedStatus !== "All Status") {
      filtered = filtered.filter((booking) => booking.status === selectedStatus);
    }

    if (selectedEventType !== "All Event Types") {
      filtered = filtered.filter((booking) => booking.type === selectedEventType);
    }

    if (selectedSort === "A-Z") {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === "Z-A") {
      filtered.sort((a, b) => b.name.localeCompare(a.name));
    } else if (selectedSort === "Newest First") {
      filtered.reverse();
    }

    return filtered;
  }, [search, selectedStatus, selectedEventType, selectedSort]);

  const stats = useMemo(() => {
    const total = initialBookings.length;
    const confirmed = initialBookings.filter((b) => b.status === "confirmed").length;
    const pending = initialBookings.filter((b) => b.status === "pending").length;
    const cancelled = initialBookings.filter((b) => b.status === "cancelled").length;

    return { total, confirmed, pending, cancelled };
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStatus !== "All Status") count++;
    if (selectedEventType !== "All Event Types") count++;
    if (selectedSort !== "Date / Time") count++;
    return count;
  }, [selectedStatus, selectedEventType, selectedSort]);

  const resetFilters = () => {
    setSearch("");
    setSelectedStatus("All Status");
    setSelectedEventType("All Event Types");
    setSelectedSort("Date / Time");
    setShowAdvancedFilters(false);
  };

  const getStatusClasses = (status: BookingStatus) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200";
      case "cancelled":
        return "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200";
      default:
        return "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header */}
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

            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:scale-[1.01] hover:shadow-xl hover:shadow-indigo-500/25">
              <Plus className="h-4 w-4" />
              New Booking
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 gap-4 px-5 py-5 md:grid-cols-2 xl:grid-cols-4 md:px-7">
            <StatsCard
              title="Total Bookings"
              value={stats.total}
              icon={<CalendarDays className="h-5 w-5" />}
              iconWrap="bg-indigo-50 text-indigo-600"
            />
            <StatsCard
              title="Confirmed"
              value={stats.confirmed}
              icon={<CheckCircle2 className="h-5 w-5" />}
              iconWrap="bg-emerald-50 text-emerald-600"
            />
            <StatsCard
              title="Pending"
              value={stats.pending}
              icon={<Clock3 className="h-5 w-5" />}
              iconWrap="bg-amber-50 text-amber-600"
            />
            <StatsCard
              title="Cancelled"
              value={stats.cancelled}
              icon={<RefreshCcw className="h-5 w-5" />}
              iconWrap="bg-rose-50 text-rose-600"
            />
          </div>
        </div>

        {/* Search + collapsible filters */}
        <div className="rounded-[24px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search client, provider, creator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    showAdvancedFilters ? "rotate-180" : ""
                  }`}
                />
              </button>

              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            </div>
          </div>

          {showAdvancedFilters && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Filter className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Advanced Filters</h2>
                  <p className="text-xs text-slate-500">
                    Refine bookings by status, event type, and sorting.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <SelectField
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  options={statusOptions}
                />

                <SelectField
                  value={selectedEventType}
                  onChange={setSelectedEventType}
                  options={eventTypeOptions}
                />

                <SelectField
                  value={selectedSort}
                  onChange={setSelectedSort}
                  options={sortOptions}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <FilterChip label={`Results: ${bookings.length}`} active />
                {selectedStatus !== "All Status" && <FilterChip label={selectedStatus} />}
                {selectedEventType !== "All Event Types" && <FilterChip label={selectedEventType} />}
                {selectedSort !== "Date / Time" && <FilterChip label={selectedSort} />}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/90 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur lg:block">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">All Bookings</h2>
            <p className="text-sm text-slate-500">
              Clean overview of your scheduled appointments and actions.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/80">
                <tr className="text-left text-sm text-slate-600">
                  <th className="px-6 py-4 font-semibold">Client</th>
                  <th className="px-6 py-4 font-semibold">Booked Date / Time</th>
                  <th className="px-6 py-4 font-semibold">Event Type</th>
                  <th className="px-6 py-4 font-semibold">Service Provider</th>
                  <th className="px-6 py-4 font-semibold">Created By</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Created At</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.length > 0 ? (
                  bookings.map((booking, index) => (
                    <tr
                      key={booking.id}
                      className={`transition hover:bg-slate-50/70 ${
                        index !== bookings.length - 1 ? "border-b border-slate-100" : ""
                      }`}
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600">
                            <UserRound className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{booking.name}</div>
                            <div className="text-xs text-slate-500">Client Booking</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-700">{booking.bookedDate}</td>

                      <td className="px-6 py-5">
                        <div className="inline-flex flex-col">
                          <span className="font-medium text-slate-800">{booking.type}</span>
                          <span className="text-xs text-slate-500">{booking.duration}</span>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                          <BriefcaseMedical className="h-3.5 w-3.5" />
                          {booking.serviceProvider}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                          <User2 className="h-3.5 w-3.5" />
                          {booking.createdBy}
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClasses(
                            booking.status
                          )}`}
                        >
                          {booking.status}
                        </span>
                      </td>

                      <td className="px-6 py-5 text-sm text-slate-600">{booking.createdAt}</td>

                      <td className="px-6 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <ActionButton icon={<Eye className="h-4 w-4" />} label="View" variant="view" />
                          <ActionButton
                            icon={<SquarePen className="h-4 w-4" />}
                            label="Edit"
                            variant="edit"
                          />
                          <ActionButton
                            icon={<Trash2 className="h-4 w-4" />}
                            label="Delete"
                            variant="delete"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                          <CalendarDays className="h-7 w-7" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No bookings found</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Try adjusting your filters or create a new booking.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
            <span>
              Showing <span className="font-semibold text-slate-800">{bookings.length}</span> of{" "}
              <span className="font-semibold text-slate-800">{initialBookings.length}</span> bookings
            </span>
            <span>Premium admin booking overview</span>
          </div>
        </div>

        {/* Mobile / Tablet Cards */}
        <div className="space-y-4 lg:hidden">
          {bookings.length > 0 ? (
            bookings.map((booking) => (
              <div
                key={booking.id}
                className="rounded-[26px] border border-slate-200/70 bg-white/90 p-4 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{booking.name}</h3>
                      <p className="text-xs text-slate-500">{booking.serviceProvider}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${getStatusClasses(
                      booking.status
                    )}`}
                  >
                    {booking.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-3 text-sm sm:grid-cols-2">
                  <InfoItem label="Booked Date / Time" value={booking.bookedDate} />
                  <InfoItem label="Event Type" value={`${booking.type} (${booking.duration})`} />
                  <InfoItem label="Service Provider" value={booking.serviceProvider} />
                  <InfoItem label="Created By" value={booking.createdBy} />
                  <InfoItem label="Created At" value={booking.createdAt} />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton icon={<Eye className="h-4 w-4" />} label="View" variant="view" />
                  <ActionButton icon={<SquarePen className="h-4 w-4" />} label="Edit" variant="edit" />
                  <ActionButton
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Delete"
                    variant="delete"
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[26px] border border-slate-200/70 bg-white/90 p-8 text-center shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)]">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-500">
                <CalendarDays className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">No bookings found</h3>
              <p className="mt-1 text-sm text-slate-500">
                Try adjusting your filters or create a new booking.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

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
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconWrap}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 pr-10 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  );
}

function FilterChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
        active
          ? "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200"
          : "bg-slate-100 text-slate-600"
      }`}
    >
      {label}
    </span>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-medium text-slate-700">{value}</p>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  variant: "view" | "edit" | "delete";
}) {
  const styles = {
    view: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    edit: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    delete: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  };

  return (
    <button
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${styles[variant]}`}
    >
      {icon}
      {label}
    </button>
  );
}