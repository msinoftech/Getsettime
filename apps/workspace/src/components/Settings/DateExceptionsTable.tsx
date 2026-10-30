"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LuFilter as Filter,
  LuPencil as Pencil,
  LuSquarePen as SquarePen,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuUsers as Users,
} from "react-icons/lu";
import { format, parseISO } from "date-fns";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import type { date_exception } from "@/src/types/date_exceptions";
import ScreenGate from "@/src/components/ScreenGate";

type provider_option = {
  id: string;
  name: string;
};

const weekday = (date: Date) => format(date, "EEEE");

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
    <div className="flex items-center max-[1301px]:justify-end gap-3">
      
      <div className="flex h-11 w-10 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-center shadow-sm">
        <span className="bg-indigo-600 px-1 py-0.5 text-[10px] font-bold tracking-wide text-white">
          {month}
        </span>
        <span className="flex flex-1 items-center justify-center text-sm font-bold text-slate-800">
          {day}
        </span>
      </div>

      <ScreenGate minWidth={1024}>
      <div>
        <p className="text-sm font-semibold text-slate-700 lg:text-slate-900">{full}</p>
        <p className="text-sm text-slate-500">{weekday}</p>
      </div>
      </ScreenGate>
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
    <div className="relative">
      <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
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
              className="w-full h-12 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
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
        <div className="overflow-hidden bg-white min-[1301px]:p-0">
          
          {/* Mobile view */}
          <ScreenGate maxWidth={1023}>
            <div className="space-y-4">
              {filtered.map((ex) => {
                const appliesLabel = ex.provider_id
                  ? providerNameById.get(ex.provider_id) || "Provider"
                  : "All Providers";

                const timeRange =
                  ex.start_time && ex.end_time
                    ? `${formatDisplayTime(ex.start_time)} - ${formatDisplayTime(ex.end_time)}`
                    : null;

                return (
                  <div key={ex.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <DateBadge dateStr={ex.exception_date} />
                        <div className="min-w-0">
                          <p className="truncate text-md font-semibold text-slate-900">
                            {ex.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1">
                            {ex.repeat_yearly ? (
                              <p className="mt-0.5 text-sm text-slate-500">
                                Repeats yearly
                              </p>
                            ) : null}

                            <p className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-50 px-2 py-1 rounded-full">{weekday(new Date(ex.exception_date))}</p>
                          </div>
                        </div>
                      </div>
                      
                      <ScreenGate minWidth={640}>
                      {/* mobile */}
                      <div>
                        <span className="inline-flex items-center gap-1.5 text-right text-sm font-medium text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {appliesLabel}
                        </span>

                        <div className="text-center">
                          {ex.availability_type === "closed" ? (
                            <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                              Closed
                            </span>
                          ) : ex.availability_type === "unavailable" ? (
                            <>
                              <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                Unavailable
                              </span>

                              {timeRange ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  {timeRange}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Available
                              </span>

                              {timeRange ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  {timeRange}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                      </ScreenGate>

                      <div>
                        {/* Type */}
                          <span
                            className={
                              ex.exception_category === "holiday"
                                ? "inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-red-50 text-red-700 border-red-200 w-fit"
                                : "inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-orange-50 text-orange-700 border-orange-200 w-fit"
                            }
                          >
                            {ex.exception_category === "holiday" ? "Holiday" : "Custom"}
                          </span>

                          {/* Actions */}
                          {!readOnly ? (
                            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-2">
                              <div className="">
                                <PortalActionsMenu
                                  open={openMenuId === ex.id}
                                  estimatedHeight={44}
                                  onToggle={() =>
                                    setOpenMenuId((id) => (id === ex.id ? null : ex.id))
                                  }
                                >
                                  <button
                                    type="button"
                                    onClick={() => onEdit(ex)}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-700 transition hover:bg-indigo-50"
                                  >
                                    <SquarePen className="h-3.5 w-3.5" />
                                    Edit
                                  </button>

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
                            </div>
                          ) : null}
                      </div>
                    </div>
                      
                    <ScreenGate maxWidth={639}>
                    {/* Details */}
                    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                      {/* Applies To */}
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-medium text-slate-500">
                          Applies To
                        </span>

                        <span className="inline-flex items-center gap-1.5 text-right text-sm font-medium text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {appliesLabel}
                        </span>
                      </div>

                      {/* Availability */}
                      <div className="flex items-start justify-between gap-4">
                        <span className="pt-1 text-sm font-medium text-slate-500">
                          Availability
                        </span>

                        <div className="text-right">
                          {ex.availability_type === "closed" ? (
                            <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                              Closed
                            </span>
                          ) : ex.availability_type === "unavailable" ? (
                            <>
                              <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
                                Unavailable
                              </span>

                              {timeRange ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  {timeRange}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                Available
                              </span>

                              {timeRange ? (
                                <p className="mt-1 text-sm text-slate-500">
                                  {timeRange}
                                </p>
                              ) : null}
                            </>
                          )}
                        </div>
                      </div>
                    </div> 
                    </ScreenGate>
                  </div>
                );
              })}
            </div>
          </ScreenGate>
          
          {/* Desktop view */}
          <ScreenGate minWidth={1024}>
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-100 text-xs font-semibold tracking-wide text-slate-500">
                <tr className="text-left text-sm text-slate-900">
                  <th className="px-6 py-4 font-semibold tracking-wide text-slate-900">
                    Date
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wide text-slate-900">
                    Exception Name
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wide text-slate-900">
                    Type
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wide text-slate-900">
                    Applies To
                  </th>
                  <th className="px-6 py-4 font-semibold tracking-wide text-slate-900">
                    Availability
                  </th>
                  {!readOnly ? (
                    <th className="px-6 py-4 text-right font-semibold tracking-wide text-slate-900">
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
                      <td className="whitespace-nowrap px-5 py-4" data-label="Date">
                        <DateBadge dateStr={ex.exception_date} />
                      </td>
                      <td className="px-5 py-4" data-label="Exception Name">
                        <p className="text-sm font-semibold text-slate-900">
                          {ex.name}
                        </p>
                        {ex.repeat_yearly ? (
                          <p className="mt-0.5 text-sm text-slate-500">Repeats yearly</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4" data-label="Type">
                        <span
                          className={
                            ex.exception_category === "holiday"
                              ? "inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-red-50 text-red-700 border-red-200 w-fit"
                              : "inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-orange-50 text-orange-700 border-orange-200 w-fit"
                          }
                        >
                          {ex.exception_category === "holiday" ? "Holiday" : "Custom"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4" data-label="Applies To">
                        <span className="inline-flex items-center gap-1.5 text-sm text-slate-700">
                          <Users className="h-3.5 w-3.5 text-slate-600" />
                          {appliesLabel}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4" data-label="Availability">
                        {ex.availability_type === "closed" ? (
                          <span className="inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-red-50 text-red-700 border-red-200 w-fit">
                            Closed
                          </span>
                        ) : ex.availability_type === "unavailable" ? (
                          <div>
                            <span className="inline-flex px-3 py-1 text-xs font-medium capitalize rounded-full border bg-orange-50 text-orange-700 border-orange-200 w-fit">
                              Unavailable
                            </span>
                            {timeRange ? (
                              <p className="mt-1 text-sm text-slate-500">{timeRange}</p>
                            ) : null}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Available
                            </span>
                            {timeRange ? (
                              <p className="mt-1 text-sm text-slate-500">{timeRange}</p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      {!readOnly ? (
                        <td className="whitespace-nowrap px-5 py-4 text-right" data-label="Action">
                          <div className="relative inline-flex items-center gap-2">
                            <PortalActionsMenu
                              open={openMenuId === ex.id}
                              estimatedHeight={44}
                              onToggle={() =>
                                setOpenMenuId((id) => (id === ex.id ? null : ex.id))
                              }
                            >
                              <button
                                type="button"
                                onClick={() => onEdit(ex)}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                              >
                              <SquarePen className="h-3.5 w-3.5" />
                                Edit
                              </button>
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
          </ScreenGate>

        </div>
      )}

      {!loading && total > 0 ? (
        <div className="px-5 py-3 text-sm text-slate-500">
          Showing 1 to {total} of {total} exceptions
        </div>
      ) : null}
    </div>
  );
}
