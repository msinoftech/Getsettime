"use client";

import { useMemo, useState, useCallback } from "react";

/**
 * Default matrix; toggles are client-only until persisted or wired to RBAC.
 * Column order: Workspace admin, Manager, Service provider, Staff, Customer.
 */
type permission_row = {
  resource: string;
  action: string;
  /** granted[0]=workspace_admin … granted[4]=customer */
  granted: [boolean, boolean, boolean, boolean, boolean];
};

const ROLE_HEADERS = [
  "Workspace Admin",
  "Manager",
  "Service provider / Doctors",
  "Staff",
  "Customer",
] as const;

const INITIAL_PERMISSION_ROWS: permission_row[] = [
  { resource: "Event Type", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Event Type", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Event Type", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Bookings", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Bookings", action: "Edit", granted: [true, true, true, true, true] },
  { resource: "Bookings", action: "Delete", granted: [true, true, true, true, false] },
  { resource: "Availability / Timesheet", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Availability / Timesheet", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Availability / Timesheet", action: "Delete", granted: [true, true, true, true, false] },
  { resource: "Intake form", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Intake form", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Intake form", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Departments", action: "Add", granted: [true, false, false, false, false] },
  { resource: "Departments", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Departments", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Services", action: "Add", granted: [true, false, false, false, false] },
  { resource: "Services", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Services", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Notifications", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Notifications", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Notifications", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Integrations", action: "Add", granted: [true, false, false, false, false] },
  { resource: "Integrations", action: "Edit", granted: [true, false, false, false, false] },
  { resource: "Integrations", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Team members", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Team members", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Team members", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Contacts", action: "Add", granted: [true, true, true, true, false] },
  { resource: "Contacts", action: "Edit", granted: [true, true, true, true, false] },
  { resource: "Contacts", action: "Delete", granted: [true, false, false, false, false] },
  { resource: "Settings", action: "Update", granted: [true, false, false, false, false] },
];

function clone_initial_rows(): permission_row[] {
  return INITIAL_PERMISSION_ROWS.map((r) => ({
    ...r,
    granted: [...r.granted] as [boolean, boolean, boolean, boolean, boolean],
  }));
}

/** Stable order: first appearance of each resource in `rows`. */
function group_rows_by_resource(rows: permission_row[]): { resource: string; row_indices: number[] }[] {
  const order: string[] = [];
  const by_resource = new Map<string, number[]>();
  rows.forEach((r, index) => {
    if (!by_resource.has(r.resource)) {
      order.push(r.resource);
      by_resource.set(r.resource, []);
    }
    by_resource.get(r.resource)!.push(index);
  });
  return order.map((resource) => ({
    resource,
    row_indices: by_resource.get(resource)!,
  }));
}

function ToggleCell({
  allowed,
  row_index,
  col_index,
  resource,
  action,
  on_toggle,
}: {
  allowed: boolean;
  row_index: number;
  col_index: number;
  resource: string;
  action: string;
  on_toggle: (row_index: number, col_index: number) => void;
}) {
  const label = `${ROLE_HEADERS[col_index]} — ${resource} — ${action}: ${allowed ? "allowed" : "not allowed"}. Click to toggle.`;
  return (
    <td className="px-3 py-3 text-center">
      <button
        type="button"
        onClick={() => on_toggle(row_index, col_index)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          allowed
            ? "border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "border-slate-200 bg-slate-100 text-slate-400 hover:border-slate-300 hover:bg-slate-200"
        }`}
        aria-pressed={allowed}
        aria-label={label}
      >
        {allowed ? (
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span className="text-lg font-light leading-none text-slate-400" aria-hidden>
            —
          </span>
        )}
      </button>
    </td>
  );
}

/** Accordion section: Action column + role headers (permission name is the accordion title). */
function AccordionSectionTableHead() {
  return (
    <thead className="[&_th]:bg-slate-100">
      <tr className="border-b border-slate-200 shadow-sm">
        <th
          scope="col"
          className="sticky top-0 left-0 z-20 border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800"
        >
          Action
        </th>
        {ROLE_HEADERS.map((label) => (
          <th
            key={label}
            scope="col"
            className="sticky top-0 z-20 border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-800"
          >
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export default function RolesPermissionsPage() {
  const [rows, set_rows] = useState<permission_row[]>(clone_initial_rows);
  const [accordion_open, set_accordion_open] = useState<Record<string, boolean>>({});

  const grouped = useMemo(() => group_rows_by_resource(rows), [rows]);

  const toggle_cell = useCallback((row_index: number, col_index: number) => {
    set_rows((prev) =>
      prev.map((r, ri) => {
        if (ri !== row_index) return r;
        const next = [...r.granted] as [boolean, boolean, boolean, boolean, boolean];
        next[col_index] = !next[col_index];
        return { ...r, granted: next };
      }),
    );
  }, []);

  const toggle_accordion = useCallback((resource: string) => {
    set_accordion_open((prev) => ({ ...prev, [resource]: !prev[resource] }));
  }, []);

  const expand_all_accordions = useCallback(() => {
    const next: Record<string, boolean> = {};
    grouped.forEach((g) => {
      next[g.resource] = true;
    });
    set_accordion_open(next);
  }, [grouped]);

  const collapse_all_accordions = useCallback(() => {
    set_accordion_open({});
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1200px]">
        <header className="mb-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h1 className="text-2xl font-semibold text-slate-900">Roles &amp; permissions</h1>
            <div className="flex shrink-0 flex-wrap gap-2 self-end sm:self-auto sm:justify-end">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={expand_all_accordions}
              >
                Expand all
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                onClick={collapse_all_accordions}
              >
                Collapse all
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-600">
            Click a cell to allow or deny the action for that role. Changes stay in this session only; enforcement is not active yet.
          </p>
        </header>

        <div className="space-y-3">
            {grouped.map(({ resource, row_indices }, section_index) => {
              const is_open = accordion_open[resource] === true;
              const acc_id = `roles-acc-${section_index}`;
              return (
                <section
                  key={resource}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    id={`${acc_id}-trigger`}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-base font-semibold text-slate-900 hover:bg-slate-50"
                    aria-expanded={is_open}
                    aria-controls={`${acc_id}-panel`}
                    onClick={() => toggle_accordion(resource)}
                  >
                    <span>{resource}</span>
                    <svg
                      className={`h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                        is_open ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {is_open && (
                    <div
                      id={`${acc_id}-panel`}
                      role="region"
                      aria-labelledby={`${acc_id}-trigger`}
                      className="border-t border-slate-200"
                    >
                      <div className="max-h-[min(70vh,480px)] overflow-auto">
                        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                          <AccordionSectionTableHead />
                          <tbody>
                            {row_indices.map((row_index) => {
                              const row = rows[row_index];
                              return (
                                <tr
                                  key={`${row.resource}-${row.action}`}
                                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80"
                                >
                                  <th
                                    scope="row"
                                    className="sticky left-0 z-10 border-r border-slate-100 bg-white px-4 py-3 text-left font-medium text-slate-700"
                                  >
                                    {row.action}
                                  </th>
                                  {row.granted.map((allowed, col_index) => (
                                    <ToggleCell
                                      key={col_index}
                                      allowed={allowed}
                                      row_index={row_index}
                                      col_index={col_index}
                                      resource={row.resource}
                                      action={row.action}
                                      on_toggle={toggle_cell}
                                    />
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      </div>
    </div>
  );
}
