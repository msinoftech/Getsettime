"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LuFilter as Filter,
  LuPencil as Pencil,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuUsers as Users,
} from "react-icons/lu";
import { format, parseISO } from "date-fns";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import type { date_exception } from "@/src/types/date_exceptions";

type provider_option = {
  id: string;
  name: string;
};

export type DateExceptionsTableProps = {
  exceptions: date_exception[];
  providers: provider_option[];
  loading?: boolean;
  onAdd: () => void;
  onEdit: (exception: date_exception) => void;
  onDelete: (exception: date_exception) => void;
  /** When true, hides edit/delete actions (e.g. staff view-only) */
  readOnly?: boolean;
};

function formatDisplayTime(time: string | null): string {
  if (!time) return "";
  const match = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${minutes} ${period}`;
}

function DateBadge({ dateStr }: { dateStr: string }) {
  let date: Date;
  try {
    date = parseISO(dateStr);
  } catch {
    return <span className="text-sm text-slate-700">{dateStr}</span>;
  }
  const month = format(date, "MMM").toUpperCase();
  const day = format(date, "dd");
  const full = format(date, "MMM dd, yyyy");
  const weekday = format(date, "EEEE");

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-10 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm">
        <span className="bg-slate-100 px-1 py-0.5 text-[10px] font-bold tracking-wide text-slate-500">
          {month}
        </span>
        <span className="flex flex-1 items-center justify-center text-sm font-bold text-slate-800">
          {day}
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{full}</p>
        <p className="text-xs text-slate-500">{weekday}</p>
      </div>
    </div>
  );
}

export function DateExceptionsTable({
  exceptions,
  providers,
  loading = false,
  onAdd,
  onEdit,
  onDelete,
  readOnly = false,
}: DateExceptionsTableProps) {
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const providerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) map.set(p.id, p.name);
    return map;
  }, [providers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return exceptions;
    return exceptions.filter((ex) => ex.name.toLowerCase().includes(q));
  }, [exceptions, search]);

  const total = filtered.length;

  useEffect(() => {
    if (openMenuId === null) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-portal-actions-menu]")) {
        return;
      }
      setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [openMenuId]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Exceptions &amp; Holidays
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {readOnly
              ? "View dates when regular availability changes."
              : "Manage dates when your regular availability changes."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exceptions..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            aria-label="Filter exceptions"
            title="Filter (coming soon)"
          >
            <Filter className="h-4 w-4 text-slate-500" />
            Filter
          </button>
        </div>
      </div>

      {loading ? (
        <div className="px-5 py-12 text-center text-sm text-slate-500">
          Loading exceptions…
        </div>
      ) : total === 0 ? (
        <div className="px-5 py-12 text-center">
          <p className="text-sm text-slate-600">No exceptions yet.</p>
          {!readOnly ? (
            <button
              type="button"
              onClick={onAdd}
              className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Add your first exception
            </button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Exception Name
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Type
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Applies To
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Availability
                </th>
                {!readOnly ? (
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Action
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtered.map((ex) => {
                const appliesLabel = ex.provider_id
                  ? providerNameById.get(ex.provider_id) || "Provider"
                  : "All Providers";
                const timeRange =
                  ex.start_time && ex.end_time
                    ? `${formatDisplayTime(ex.start_time)} - ${formatDisplayTime(ex.end_time)}`
                    : null;

                return (
                  <tr key={ex.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-5 py-4">
                      <DateBadge dateStr={ex.exception_date} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {ex.name}
                      </p>
                      {ex.repeat_yearly ? (
                        <p className="mt-0.5 text-xs text-slate-500">Repeats yearly</p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={
                          ex.exception_category === "holiday"
                            ? "inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700"
                            : "inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700"
                        }
                      >
                        {ex.exception_category === "holiday" ? "Holiday" : "Custom"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        {appliesLabel}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      {ex.availability_type === "closed" ? (
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                          Closed
                        </span>
                      ) : ex.availability_type === "unavailable" ? (
                        <div>
                          <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                            Unavailable
                          </span>
                          {timeRange ? (
                            <p className="mt-1 text-xs text-slate-500">{timeRange}</p>
                          ) : null}
                        </div>
                      ) : (
                        <div>
                          <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Available
                          </span>
                          {timeRange ? (
                            <p className="mt-1 text-xs text-slate-500">{timeRange}</p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    {!readOnly ? (
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <div className="relative inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(ex)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-500" />
                            Edit
                          </button>
                          <PortalActionsMenu
                            open={openMenuId === ex.id}
                            estimatedHeight={44}
                            onToggle={() =>
                              setOpenMenuId((id) => (id === ex.id ? null : ex.id))
                            }
                          >
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenMenuId(null);
                                onDelete(ex);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </PortalActionsMenu>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 ? (
        <div className="border-t border-slate-200 px-5 py-3 text-sm text-slate-500">
          Showing 1 to {total} of {total} exceptions
        </div>
      ) : null}
    </div>
  );
}
