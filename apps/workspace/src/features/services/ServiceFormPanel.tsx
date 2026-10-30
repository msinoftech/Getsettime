"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuInfo as Info,
  LuX as X,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { currencySymbol } from "@/src/constants/currency";
import {
  PanelSection,
  classNames,
} from "@/src/features/departments/DepartmentPanelPrimitives";
import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";
import {
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_DURATION_OPTIONS,
  SERVICE_VISIBILITY_OPTIONS,
  parse_service_price_input,
  resolve_assigned_doctor_ids,
  service_visibility_from_status,
  type service_department_option,
  type service_doctor_assign_mode,
  type service_doctor_row,
  type service_name_record,
  type service_record,
  type service_visibility_status,
} from "@/src/features/services/service_records";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";

export type service_form_saved_result = {
  service: service_record;
  /** False when the service was created but consultant assignments failed to sync. */
  assignments_synced: boolean;
};

export type ServiceFormPanelProps = {
  mode: "add" | "edit";
  /** Service being edited. Required when `mode` is `"edit"`. */
  service?: service_record | null;
  /** Department options offered by the add form. */
  departments: readonly service_department_option[];
  /** Services already in scope, used for duplicate-name checks. */
  existing_services: readonly service_name_record[];
  /** Department pre-selected when the add form opens. */
  initial_department_id?: number | null;
  /**
   * Pins the department to `initial_department_id` and renders it read-only, for
   * flows that create a service inside an already chosen department.
   */
  lock_department?: boolean;
  /** Eligible consultant pool for a department, see `useServiceDepartmentDoctors`. */
  resolve_department_doctors: (
    departmentId: number | null
  ) => service_doctor_row[];
  /** True while the consultant pool is still loading. */
  doctors_loading?: boolean;
  /** Rendered as an inline banner; hosts using a modal can omit it. */
  error_message?: string | null;
  on_error: (message: string) => void;
  on_cancel: () => void;
  on_saved: (result: service_form_saved_result) => void | Promise<void>;
};

const PANEL_FIELD_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";
const PANEL_SELECT_CLASS =
  "w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

async function get_access_token(): Promise<string | null> {
  const { session } = await getWorkspaceSession();
  return session?.access_token ?? null;
}

export function ServiceFormPanel({
  mode,
  service = null,
  departments,
  existing_services,
  initial_department_id = null,
  lock_department = false,
  resolve_department_doctors,
  doctors_loading = false,
  error_message = null,
  on_error,
  on_cancel,
  on_saved,
}: ServiceFormPanelProps) {
  const is_edit = mode === "edit";
  const { general, workspaceAdminProfessionsId } = useWorkspaceSettings();

  const currency =
    typeof (general as { currency?: string | null } | undefined)?.currency ===
      "string" && (general as { currency?: string }).currency
      ? (general as { currency: string }).currency
      : "USD";
  const currency_sign = currencySymbol(currency);
  const admin_professions_id = workspaceAdminProfessionsId ?? null;

  const [name, set_name] = useState(() => (is_edit ? (service?.name ?? "") : ""));
  const [description, set_description] = useState(() =>
    is_edit ? (service?.description ?? "").slice(0, SERVICE_DESCRIPTION_MAX_LENGTH) : ""
  );
  const [duration, set_duration] = useState(() =>
    is_edit ? (service?.duration ?? 30) : 30
  );
  const [price, set_price] = useState(() =>
    is_edit && service?.price != null ? String(service.price) : ""
  );
  const [department_id, set_department_id] = useState<number | null>(() => {
    if (is_edit) return service?.department_id ?? null;
    return initial_department_id;
  });
  const [status, set_status] = useState<service_visibility_status>(() =>
    is_edit && service ? service_visibility_from_status(service.status) : "active"
  );

  const [assign_mode, set_assign_mode] = useState<service_doctor_assign_mode>(
    () => {
      if (!is_edit || !service) return "specific";
      const pool = resolve_department_doctors(service.department_id);
      const assigned_in_pool = (service.meta_data?.service_providers ?? [])
        .map((provider) => provider.id)
        .filter((id) => pool.some((doctor) => doctor.id === id));
      const all_selected =
        pool.length > 0 &&
        pool.every((doctor) => assigned_in_pool.includes(doctor.id));
      return all_selected ? "all" : "specific";
    }
  );
  const [assigned_doctor_ids, set_assigned_doctor_ids] = useState<string[]>(
    () => {
      if (!is_edit || !service) return [];
      const pool = resolve_department_doctors(service.department_id);
      return (service.meta_data?.service_providers ?? [])
        .map((provider) => provider.id)
        .filter((id) => pool.some((doctor) => doctor.id === id));
    }
  );
  const [assigned_menu_open, set_assigned_menu_open] = useState(false);
  const [suggestions, set_suggestions] = useState<string[]>([]);
  const [saving, set_saving] = useState(false);

  const selected_department = useMemo(
    () => departments.find((department) => department.id === department_id) ?? null,
    [departments, department_id]
  );

  const doctor_pool = useMemo(
    () => resolve_department_doctors(department_id),
    [resolve_department_doctors, department_id]
  );

  useEffect(() => {
    if (assign_mode !== "all") return;
    set_assigned_doctor_ids(doctor_pool.map((doctor) => doctor.id));
  }, [assign_mode, doctor_pool]);

  const department_name = selected_department?.name?.trim() ?? "";

  useEffect(() => {
    if (is_edit) return;
    if (!admin_professions_id || !department_name) {
      set_suggestions([]);
      return;
    }

    let cancelled = false;
    const load_suggestions = async () => {
      const token = await get_access_token();
      if (!token || cancelled) return;
      try {
        const res = await fetch(
          `/api/catalog/services?profession_id=${admin_professions_id}&department=${encodeURIComponent(
            department_name
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          set_suggestions(
            Array.isArray(data?.services) ? (data.services as string[]) : []
          );
        }
      } catch (error) {
        console.error("Error loading service suggestions:", error);
      }
    };

    void load_suggestions();
    return () => {
      cancelled = true;
    };
  }, [is_edit, admin_professions_id, department_name]);

  const existing_names_in_department = useMemo(() => {
    if (department_id == null) return new Set<string>();
    return new Set(
      existing_services
        .filter((item) => Number(item.department_id) === department_id)
        .map((item) => item.name.toLowerCase())
    );
  }, [existing_services, department_id]);

  /** Sibling names that would collide; a service without a department checks globally. */
  const conflicting_names = useMemo(() => {
    return new Set(
      existing_services
        .filter((item) => {
          if (item.id === service?.id) return false;
          if (department_id == null) return is_edit;
          return Number(item.department_id) === department_id;
        })
        .map((item) => item.name.toLowerCase())
    );
  }, [existing_services, department_id, is_edit, service?.id]);

  const call_services_api = useCallback(
    async (method: "POST" | "PUT", body: Record<string, unknown>) => {
      const token = await get_access_token();
      if (!token) {
        on_error("Not authenticated");
        return null;
      }
      const response = await fetch("/api/services", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        on_error(err?.error || `Request failed (${response.status})`);
        return null;
      }
      return (await response.json().catch(() => ({}))) as {
        service?: service_record;
      };
    },
    [on_error]
  );

  const sync_doctor_assignments = useCallback(
    async (serviceId: string, doctorIds: string[]) => {
      const token = await get_access_token();
      if (!token) {
        on_error("Not authenticated");
        return false;
      }

      const currentRes = await fetch(
        `/api/user-services?service_id=${encodeURIComponent(serviceId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!currentRes.ok) {
        const err = await currentRes.json().catch(() => null);
        on_error(err?.error || `Request failed (${currentRes.status})`);
        return false;
      }
      const currentData = await currentRes.json().catch(() => ({}));
      const currentIds = new Set<string>(
        ((currentData.assignments ?? []) as { user_id: string }[]).map(
          (assignment) => assignment.user_id
        )
      );
      const nextIds = new Set(doctorIds);

      for (const userId of nextIds) {
        if (currentIds.has(userId)) continue;
        const post = await fetch("/api/user-services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId, service_id: serviceId }),
        });
        if (!post.ok) {
          const err = await post.json().catch(() => null);
          on_error(err?.error || `Request failed (${post.status})`);
          return false;
        }
      }

      for (const userId of currentIds) {
        if (nextIds.has(userId)) continue;
        const del = await fetch(
          `/api/user-services?user_id=${encodeURIComponent(userId)}&service_id=${encodeURIComponent(serviceId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!del.ok) {
          const err = await del.json().catch(() => null);
          on_error(err?.error || `Request failed (${del.status})`);
          return false;
        }
      }

      return true;
    },
    [on_error]
  );

  const handle_save = async () => {
    const trimmed_name = name.trim();
    if (!trimmed_name) {
      on_error("Service name is required.");
      return;
    }
    if (!is_edit && department_id == null) {
      on_error("Please select a department.");
      return;
    }
    if (is_edit && !service) return;

    if (conflicting_names.has(trimmed_name.toLowerCase())) {
      on_error(
        is_edit
          ? "Another service in this department already has this name."
          : "A service with this name already exists in this department."
      );
      return;
    }

    const assigned_ids = resolve_assigned_doctor_ids(
      assign_mode,
      assigned_doctor_ids,
      doctor_pool
    );
    if (
      assign_mode === "specific" &&
      doctor_pool.length > 0 &&
      assigned_ids.length === 0
    ) {
      on_error("Please select at least one consultant for this service.");
      return;
    }

    set_saving(true);
    try {
      const data = is_edit
        ? await call_services_api("PUT", {
            id: service!.id,
            name: trimmed_name,
            description: description.trim() || null,
            duration,
            price: parse_service_price_input(price),
            status,
          })
        : await call_services_api("POST", {
            name: trimmed_name,
            description: description.trim() || null,
            duration,
            price: parse_service_price_input(price),
            department_id,
            status,
          });

      if (!data?.service) {
        on_error(
          is_edit ? "Failed to update service." : "Failed to create service."
        );
        return;
      }
      const saved_service = data.service;

      const assignments_synced = await sync_doctor_assignments(
        saved_service.id,
        assigned_ids
      );
      if (is_edit && !assignments_synced) return;

      await on_saved({ service: saved_service, assignments_synced });
    } finally {
      set_saving(false);
    }
  };

  const visibility_option =
    SERVICE_VISIBILITY_OPTIONS.find((option) => option.value === status) ??
    SERVICE_VISIBILITY_OPTIONS[0];
  const VisibilityIcon = visibility_option.Icon;
  const department_is_read_only = is_edit || lock_department;
  const save_disabled =
    saving || !name.trim() || (!is_edit && department_id == null);

  return (
    <>
      <div className="relative ml-auto flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl pb-[60px] lg:pb-0">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">
            {is_edit ? "Edit Service" : "Add Service"}
          </h2>
          <button
            type="button"
            onClick={on_cancel}
            className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-scroll pb-16 lg:pb-0 overscroll-contain">
          <div className="flex flex-col">
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {error_message ? (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error_message}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <PanelSection number={1} title="Basic Details">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Service name<span className="text-red-500">*</span>
                      </span>
                      <input
                        value={name}
                        onChange={(e) => set_name(e.target.value)}
                        placeholder={is_edit ? "Service name" : "e.g. Cardiac Screening"}
                        className={PANEL_FIELD_CLASS}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Department<span className="text-red-500">*</span>
                      </span>
                      {department_is_read_only ? (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                          {selected_department?.name ?? "—"}
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={department_id ?? ""}
                            onChange={(e) => {
                              const next =
                                e.target.value === ""
                                  ? null
                                  : parseInt(e.target.value, 10);
                              set_department_id(
                                next != null && Number.isFinite(next) ? next : null
                              );
                              set_assigned_doctor_ids([]);
                              set_assigned_menu_open(false);
                            }}
                            className={PANEL_SELECT_CLASS}
                          >
                            <option value="" disabled>
                              Select department
                            </option>
                            {departments.map((department) => (
                              <option key={department.id} value={department.id}>
                                {department.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                            aria-hidden
                          />
                        </div>
                      )}
                    </label>
                  </div>

                  {is_edit ? null : suggestions.length > 0 ? (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Quick Suggestions
                      </span>
                      <p className="mb-2 mt-1 text-xs text-slate-500">
                        Click a suggestion to fill the service name. Already added
                        services are marked.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((item) => {
                          const already_added = existing_names_in_department.has(
                            item.toLowerCase()
                          );
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => {
                                if (already_added) return;
                                set_name(item);
                              }}
                              disabled={saving || already_added}
                              className={classNames(
                                "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                                already_added
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : name === item
                                    ? "border border-indigo-300 bg-indigo-50 text-indigo-700"
                                    : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                              )}
                            >
                              {already_added ? "✓" : "+"} {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                      {selected_department
                        ? "No service suggestions available for this department yet."
                        : "Select a department to see matching service suggestions."}
                    </p>
                  )}

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Short description
                    </span>
                    <div className="relative">
                      <textarea
                        value={description}
                        onChange={(e) =>
                          set_description(
                            e.target.value.slice(0, SERVICE_DESCRIPTION_MAX_LENGTH)
                          )
                        }
                        placeholder="Brief summary of this service"
                        rows={3}
                        maxLength={SERVICE_DESCRIPTION_MAX_LENGTH}
                        className={classNames(PANEL_FIELD_CLASS, "resize-none pb-7")}
                      />
                      <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-slate-400">
                        {description.length}/{SERVICE_DESCRIPTION_MAX_LENGTH}
                      </span>
                    </div>
                  </label>
                </PanelSection>

                <PanelSection number={2} title="Scheduling">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Duration<span className="text-red-500">*</span>
                      </span>
                      <div className="relative">
                        <select
                          value={duration}
                          onChange={(e) =>
                            set_duration(parseInt(e.target.value, 10))
                          }
                          className={PANEL_SELECT_CLASS}
                        >
                          {SERVICE_DURATION_OPTIONS.map((minutes) => (
                            <option key={minutes} value={minutes}>
                              {minutes} mins
                            </option>
                          ))}
                          {!SERVICE_DURATION_OPTIONS.includes(duration) && (
                            <option value={duration}>{duration} mins</option>
                          )}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                          aria-hidden
                        />
                      </div>
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Price ({currency})
                      </span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                          {currency_sign}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={price}
                          onChange={(e) => set_price(e.target.value)}
                          placeholder="0.00"
                          className={classNames(PANEL_FIELD_CLASS, "pl-8")}
                        />
                      </div>
                    </label>
                  </div>
                </PanelSection>

                <PanelSection number={3} title="Consultant Assignment">
                  <div>
                    <p className="mb-2 text-sm text-slate-500">
                      Department consultants (eligible pool from selected department)
                    </p>
                    {doctor_pool.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                        {doctors_loading
                          ? "Loading consultants…"
                          : "No consultants assigned to this department yet."}
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {doctor_pool.map((doctor) => (
                          <div
                            key={doctor.id}
                            className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-2.5 py-1.5"
                          >
                            <WorkspaceUserAvatar
                              userId={doctor.id}
                              name={doctor.name}
                              avatarUrl={doctor.avatarUrl}
                              size="sm"
                            />
                            <span className="text-sm font-medium text-indigo-900">
                              {doctor.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">
                      Assign service to
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          set_assign_mode("all");
                          set_assigned_doctor_ids(
                            doctor_pool.map((doctor) => doctor.id)
                          );
                          set_assigned_menu_open(false);
                        }}
                        className={classNames(
                          "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                          assign_mode === "all"
                            ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                        )}
                      >
                        <span
                          className={classNames(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            assign_mode === "all"
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300"
                          )}
                        >
                          {assign_mode === "all" && <Check className="h-2.5 w-2.5" />}
                        </span>
                        All department consultants
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          set_assign_mode("specific");
                          set_assigned_menu_open(false);
                        }}
                        className={classNames(
                          "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                          assign_mode === "specific"
                            ? "border-indigo-500 bg-indigo-50 text-indigo-800"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                        )}
                      >
                        <span
                          className={classNames(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            assign_mode === "specific"
                              ? "border-indigo-600 bg-indigo-600 text-white"
                              : "border-slate-300"
                          )}
                        >
                          {assign_mode === "specific" && (
                            <Check className="h-2.5 w-2.5" />
                          )}
                        </span>
                        Select specific consultants
                      </button>
                    </div>
                    {assign_mode === "all" && (
                      <p className="mt-2 text-xs text-slate-500">
                        {doctor_pool.length === 0
                          ? "No department consultants available to assign."
                          : `All ${doctor_pool.length} department consultant${doctor_pool.length === 1 ? "" : "s"} will be assigned to this service.`}
                      </p>
                    )}
                  </div>

                  {assign_mode === "specific" && (
                    <div className="relative">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Assigned consultants<span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => set_assigned_menu_open((prev) => !prev)}
                        disabled={doctor_pool.length === 0}
                        className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm outline-none transition focus:border-indigo-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                          {assigned_doctor_ids.length === 0 ? (
                            <span className="text-slate-400">
                              Select consultants
                            </span>
                          ) : (
                            assigned_doctor_ids.map((id) => {
                              const doctor = doctor_pool.find(
                                (item) => item.id === id
                              );
                              if (!doctor) return null;
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800"
                                >
                                  {doctor.name}
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      set_assigned_doctor_ids((prev) =>
                                        prev.filter((x) => x !== id)
                                      );
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        set_assigned_doctor_ids((prev) =>
                                          prev.filter((x) => x !== id)
                                        );
                                      }
                                    }}
                                    className="rounded text-indigo-500 hover:text-indigo-800"
                                  >
                                    <X className="h-3 w-3" />
                                  </span>
                                </span>
                              );
                            })
                          )}
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                      </button>
                      {assigned_menu_open && (
                        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                          {doctor_pool.map((doctor) => {
                            const checked = assigned_doctor_ids.includes(doctor.id);
                            return (
                              <button
                                key={doctor.id}
                                type="button"
                                onClick={() => {
                                  set_assigned_doctor_ids((prev) =>
                                    prev.includes(doctor.id)
                                      ? prev.filter((id) => id !== doctor.id)
                                      : [...prev, doctor.id]
                                  );
                                }}
                                className={classNames(
                                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                                  checked
                                    ? "bg-indigo-50 text-indigo-800"
                                    : "text-slate-700 hover:bg-slate-50"
                                )}
                              >
                                <span
                                  className={classNames(
                                    "flex h-4 w-4 items-center justify-center rounded border",
                                    checked
                                      ? "border-indigo-600 bg-indigo-600 text-white"
                                      : "border-slate-300"
                                  )}
                                >
                                  {checked && <Check className="h-2.5 w-2.5" />}
                                </span>
                                {doctor.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-sm text-indigo-800">
                    <Info className="mt-0.5 h-4.5 w-4.5 shrink-0" />
                    <p>
                      Consultants are selected once in Department settings. Only
                      department consultants can be assigned here.
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    Only selected consultants will appear on the booking page for
                    this service.
                  </p>
                </PanelSection>

                <PanelSection number={4} title="Booking Options" isLast>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-700">Visibility</span>
                    <div className="relative min-w-[9.5rem]">
                      <VisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <select
                        value={status}
                        onChange={(e) =>
                          set_status(e.target.value as service_visibility_status)
                        }
                        aria-label="Visibility"
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                      >
                        {SERVICE_VISIBILITY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </PanelSection>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={on_cancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handle_save}
                  disabled={save_disabled}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving…" : is_edit ? "Update Service" : "Save Service"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
