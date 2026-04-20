"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuLayoutGrid as LayoutGrid,
  LuPlus as Plus,
  LuSearch as Search,
  LuStethoscope as Stethoscope,
  LuUserRound as UserRound,
  LuX as X,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuPower as Power,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { ServiceSkeleton } from "@/src/components/ui/ServiceSkeleton";
import { useServiceProviders } from "@/src/hooks/useBookingLookups";
import type { ServiceProvider } from "@/src/types/booking-entities";

type ServiceStatus = "active" | "inactive";
type StatusFilter = "all" | "active" | "inactive";

interface ServiceProviderMeta {
  id: string;
  name: string;
}

interface DepartmentServiceProviderMeta {
  id: string;
  name: string;
}

interface Department {
  id: number;
  workspace_id: number;
  name: string;
  description: string | null;
  status: ServiceStatus;
  flag: boolean;
  meta_data: {
    services?: { id: string; name: string }[];
    service_providers?: DepartmentServiceProviderMeta[];
  } | null;
  created_at: string;
}

interface Service {
  id: string;
  workspace_id: number;
  name: string;
  description: string | null;
  price: number | null;
  duration: number;
  status: ServiceStatus;
  flag: boolean;
  department_id: number | null;
  departments?: { name: string } | { name: string }[] | null;
  meta_data: { service_providers?: ServiceProviderMeta[] } | null;
  created_at: string;
  updated_at: string;
}

interface DoctorRow {
  id: string;
  name: string;
  role: string;
  avatar: string;
}

const DURATION_OPTIONS: number[] = [15, 20, 30, 40, 45, 60];

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function providerDisplayName(p: ServiceProvider): string {
  return (
    p.raw_user_meta_data?.full_name?.trim() ||
    p.raw_user_meta_data?.name?.trim() ||
    p.email ||
    "Unknown"
  );
}

function providerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].replace(/^Dr\.?$/i, "");
  if (parts.length === 1) return (first || parts[0]).slice(0, 2).toUpperCase();
  const primary = first || parts[1] || "";
  const secondary = parts[parts.length - 1] || "";
  const a = primary.charAt(0);
  const b = secondary.charAt(0);
  return (a + b).toUpperCase() || parts[0].slice(0, 2).toUpperCase();
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ServicesPage() {
  const { data: serviceProviders } = useServiceProviders();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(
    null
  );

  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [serviceSearch, setServiceSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [showBookingImpact, setShowBookingImpact] = useState(false);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [newServicePrice, setNewServicePrice] = useState("");

  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServiceDuration, setEditServiceDuration] = useState(30);
  const [editServicePrice, setEditServicePrice] = useState("");

  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchDepartments = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return [] as Department[];
    const response = await fetch("/api/departments", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [] as Department[];
    const data = await response.json();
    return (data.departments ?? []) as Department[];
  }, [getAuthToken]);

  const fetchServices = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return [] as Service[];
    const response = await fetch("/api/services", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [] as Service[];
    const data = await response.json();
    return (data.services ?? []) as Service[];
  }, [getAuthToken]);

  const loadAll = useCallback(
    async (opts?: { silent?: boolean; selectId?: number | null }) => {
      if (!opts?.silent) setInitialLoading(true);
      try {
        const [depts, svcs] = await Promise.all([
          fetchDepartments(),
          fetchServices(),
        ]);
        setDepartments(depts);
        setServices(svcs);
        setSelectedDepartmentId((prev) => {
          if (opts && "selectId" in opts) {
            return opts.selectId ?? depts[0]?.id ?? null;
          }
          if (prev !== null && depts.some((d) => d.id === prev)) return prev;
          return depts[0]?.id ?? null;
        });
      } catch (err) {
        console.error("Error loading services page:", err);
      } finally {
        if (!opts?.silent) setInitialLoading(false);
      }
    },
    [fetchDepartments, fetchServices]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const callServicesApi = useCallback(
    async (
      method: "POST" | "PUT" | "DELETE",
      body?: Record<string, unknown>,
      query?: string
    ) => {
      const token = await getAuthToken();
      if (!token) {
        setAlertMessage("Not authenticated");
        return null;
      }
      const url = query ? `/api/services?${query}` : "/api/services";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        setAlertMessage(err?.error || `Request failed (${response.status})`);
        return null;
      }
      return response.json().catch(() => ({}));
    },
    [getAuthToken]
  );

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const servicesForDepartment = useCallback(
    (departmentId: number | null) => {
      if (departmentId == null) return [] as Service[];
      return services.filter((s) => Number(s.department_id) === departmentId);
    },
    [services]
  );

  const allDepartmentServices = useMemo(
    () => servicesForDepartment(selectedDepartmentId),
    [servicesForDepartment, selectedDepartmentId]
  );

  const doctorsForDepartment = useCallback(
    (department: Department | null): DoctorRow[] => {
      if (!department) return [];
      const assigned = department.meta_data?.service_providers ?? [];
      const assignedIds = new Set(assigned.map((p) => p.id));
      return serviceProviders
        .filter((sp) => assignedIds.has(sp.id))
        .map((sp) => {
          const name = providerDisplayName(sp);
          return {
            id: sp.id,
            name,
            role: "Doctor",
            avatar: providerInitials(name),
          };
        });
    },
    [serviceProviders]
  );

  const departmentDoctors = useMemo(
    () => doctorsForDepartment(selectedDepartment),
    [doctorsForDepartment, selectedDepartment]
  );

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    return allDepartmentServices.filter((service) => {
      const matchesSearch =
        term === "" || service.name.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.status === "active") ||
        (statusFilter === "inactive" && service.status === "inactive");
      return matchesSearch && matchesStatus;
    });
  }, [allDepartmentServices, serviceSearch, statusFilter]);

  const filteredDoctors = useMemo(() => {
    const term = doctorSearch.trim().toLowerCase();
    if (term === "") return departmentDoctors;
    return departmentDoctors.filter((d) =>
      d.name.toLowerCase().includes(term)
    );
  }, [departmentDoctors, doctorSearch]);

  const activeServicesCount = useMemo(
    () => allDepartmentServices.filter((s) => s.status === "active").length,
    [allDepartmentServices]
  );

  const totalAssignments = useMemo(
    () =>
      allDepartmentServices.reduce(
        (sum, s) => sum + (s.meta_data?.service_providers?.length ?? 0),
        0
      ),
    [allDepartmentServices]
  );

  const getDepartmentServiceCount = useCallback(
    (departmentId: number) => servicesForDepartment(departmentId).length,
    [servicesForDepartment]
  );

  const getDepartmentDoctorCount = useCallback(
    (department: Department) =>
      doctorsForDepartment(department).length,
    [doctorsForDepartment]
  );

  const isDoctorAssignedToService = useCallback(
    (service: Service, doctorId: string) =>
      (service.meta_data?.service_providers ?? []).some((p) => p.id === doctorId),
    []
  );

  const resetAddForm = () => {
    setNewServiceName("");
    setNewServiceDuration(30);
    setNewServicePrice("");
  };

  const resetEditForm = () => {
    setEditServiceId(null);
    setEditServiceName("");
    setEditServiceDuration(30);
    setEditServicePrice("");
  };

  const handleSelectDepartment = (departmentId: number) => {
    setSelectedDepartmentId(departmentId);
    setServiceSearch("");
    setDoctorSearch("");
    setStatusFilter("all");
    setShowStatusMenu(false);
  };

  const handleAddService = async () => {
    const name = newServiceName.trim();
    if (!name || selectedDepartmentId == null) return;

    const duplicate = allDepartmentServices.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("A service with this name already exists in this department.");
      return;
    }

    setBusyAction(true);
    const price = parsePriceInput(newServicePrice);
    const data = await callServicesApi("POST", {
      name,
      duration: newServiceDuration,
      price,
      department_id: selectedDepartmentId,
      status: "active",
    });
    setBusyAction(false);

    if (data?.service) {
      setServices((prev) => [data.service as Service, ...prev]);
      resetAddForm();
      setShowAddServiceModal(false);
    }
  };

  const openEditService = (service: Service) => {
    setEditServiceId(service.id);
    setEditServiceName(service.name);
    setEditServiceDuration(service.duration ?? 30);
    setEditServicePrice(service.price != null ? String(service.price) : "");
    setShowEditServiceModal(true);
  };

  const handleSaveEditedService = async () => {
    if (!editServiceId) return;
    const name = editServiceName.trim();
    if (!name) return;

    const duplicate = allDepartmentServices.some(
      (s) =>
        s.id !== editServiceId &&
        s.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("Another service in this department already has this name.");
      return;
    }

    setBusyAction(true);
    const data = await callServicesApi("PUT", {
      id: editServiceId,
      name,
      duration: editServiceDuration,
      price: parsePriceInput(editServicePrice),
    });
    setBusyAction(false);

    if (data?.service) {
      setServices((prev) =>
        prev.map((s) => (s.id === editServiceId ? (data.service as Service) : s))
      );
      resetEditForm();
      setShowEditServiceModal(false);
    }
  };

  const handleToggleServiceStatus = async (service: Service) => {
    const nextStatus: ServiceStatus =
      service.status === "active" ? "inactive" : "active";

    setBusyAction(true);
    const data = await callServicesApi("PUT", {
      id: service.id,
      status: nextStatus,
    });
    setBusyAction(false);

    if (data?.service) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? (data.service as Service) : s))
      );
    }
  };

  const handleDeleteServiceConfirm = async () => {
    if (!serviceToDelete) return;
    const id = serviceToDelete.id;
    setBusyAction(true);
    const data = await callServicesApi("DELETE", undefined, `id=${id}`);
    setBusyAction(false);

    if (data) {
      setServices((prev) => prev.filter((s) => s.id !== id));
      setServiceToDelete(null);
    }
  };

  const handleToggleAssignment = async (service: Service, doctor: DoctorRow) => {
    if (service.status !== "active") return;

    const current = service.meta_data?.service_providers ?? [];
    const exists = current.some((p) => p.id === doctor.id);
    const nextProviders: ServiceProviderMeta[] = exists
      ? current.filter((p) => p.id !== doctor.id)
      : [...current, { id: doctor.id, name: doctor.name }];

    setBusyAction(true);
    const data = await callServicesApi("PUT", {
      id: service.id,
      meta_data: { service_providers: nextProviders },
    });
    setBusyAction(false);

    if (data?.service) {
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? (data.service as Service) : s))
      );
    }
  };

  const persistServiceProviders = async (
    service: Service,
    nextProviders: ServiceProviderMeta[]
  ): Promise<Service | null> => {
    const data = await callServicesApi("PUT", {
      id: service.id,
      meta_data: { service_providers: nextProviders },
    });
    return (data?.service as Service) ?? null;
  };

  const handleAssignAllForDoctor = async (doctor: DoctorRow) => {
    const targets = allDepartmentServices.filter((service) => {
      if (service.status !== "active") return false;
      const providers = service.meta_data?.service_providers ?? [];
      return !providers.some((p) => p.id === doctor.id);
    });

    if (targets.length === 0) return;

    setBusyAction(true);
    const updated: Service[] = [];
    for (const service of targets) {
      const current = service.meta_data?.service_providers ?? [];
      const next: ServiceProviderMeta[] = [
        ...current,
        { id: doctor.id, name: doctor.name },
      ];
      const saved = await persistServiceProviders(service, next);
      if (saved) updated.push(saved);
    }
    setBusyAction(false);

    if (updated.length > 0) {
      const byId = new Map(updated.map((s) => [s.id, s]));
      setServices((prev) => prev.map((s) => byId.get(s.id) ?? s));
    }
  };

  const handleClearAllForDoctor = async (doctor: DoctorRow) => {
    const targets = allDepartmentServices.filter((service) =>
      (service.meta_data?.service_providers ?? []).some((p) => p.id === doctor.id)
    );

    if (targets.length === 0) return;

    setBusyAction(true);
    const updated: Service[] = [];
    for (const service of targets) {
      const current = service.meta_data?.service_providers ?? [];
      const next = current.filter((p) => p.id !== doctor.id);
      const saved = await persistServiceProviders(service, next);
      if (saved) updated.push(saved);
    }
    setBusyAction(false);

    if (updated.length > 0) {
      const byId = new Map(updated.map((s) => [s.id, s]));
      setServices((prev) => prev.map((s) => byId.get(s.id) ?? s));
    }
  };

  const statusLabel =
    statusFilter === "all"
      ? "All statuses"
      : statusFilter === "active"
        ? "Active only"
        : "Inactive only";

  if (initialLoading) {
    return <ServiceSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        {/* Top header */}
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                Department Service Management
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
                Services under department with doctor assignment
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 md:text-base">
                Manage department services, assigned doctors, and exact doctor-service access from one admin screen.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setShowBookingImpact(true)}
                disabled={!selectedDepartment}
                className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LayoutGrid className="h-4 w-4" />
                View booking impact
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!selectedDepartment) return;
                  resetAddForm();
                  setShowAddServiceModal(true);
                }}
                disabled={!selectedDepartment}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add service
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left Sidebar: Departments */}
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Departments</h2>
              <p className="mt-1 text-sm text-slate-500">
                Select one department to manage services and doctor mapping.
              </p>
            </div>

            <div className="space-y-3">
              {departments.map((department) => {
                const active = department.id === selectedDepartmentId;
                const doctorCount = getDepartmentDoctorCount(department);
                const svcCount = getDepartmentServiceCount(department.id);
                return (
                  <button
                    key={department.id}
                    type="button"
                    onClick={() => handleSelectDepartment(department.id)}
                    className={classNames(
                      "w-full rounded-2xl border p-4 text-left transition",
                      active
                        ? "border-indigo-500 bg-indigo-50 shadow-[0_0_0_3px_rgba(99,102,241,0.08)]"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p
                            className={classNames(
                              "truncate text-base font-semibold",
                              active ? "text-indigo-700" : "text-slate-900"
                            )}
                          >
                            {department.name}
                          </p>
                          {department.status === "inactive" && (
                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                            {doctorCount} doctor{doctorCount !== 1 ? "s" : ""}
                          </span>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {svcCount} service{svcCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      {active && (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-200 bg-white text-indigo-600">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {departments.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No departments yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Create a department first to add services.
                  </p>
                </div>
              )}
            </div>
          </aside>

          {/* Right Main */}
          <main className="space-y-4">
            {/* Stats row */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-500">Selected department</p>
                    <h3 className="truncate text-lg font-semibold text-slate-900">
                      {selectedDepartment?.name ?? "No department selected"}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Active services</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {activeServicesCount}
                </h3>
                <p className="mt-1 text-sm text-emerald-600">Bookable for customers</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-sm text-slate-500">Doctor-service assignments</p>
                <h3 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  {totalAssignments}
                </h3>
                <p className="mt-1 text-sm text-slate-500">Total mapped combinations</p>
              </div>
            </div>

            <div className="grid gap-4 2xl:grid-cols-1">
              {/* Department services panel */}
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Department services
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Only services under{" "}
                      {selectedDepartment?.name ?? "the selected department"} are shown here.
                    </p>
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStatusMenu((prev) => !prev)}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {statusLabel}
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    {showStatusMenu && (
                      <div className="absolute right-0 top-12 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                        {(["all", "active", "inactive"] as StatusFilter[]).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setStatusFilter(status);
                              setShowStatusMenu(false);
                            }}
                            className={classNames(
                              "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm",
                              statusFilter === status
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span className="capitalize">{status}</span>
                            {statusFilter === status && <Check className="h-4 w-4" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Search services..."
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredServices.length === 0 && (
                    <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        No services found
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {allDepartmentServices.length === 0
                          ? "Add the first service for this department."
                          : "Try changing the search or status filter."}
                      </p>
                    </div>
                  )}

                  {filteredServices.map((service) => {
                    const doctorsOnService =
                      service.meta_data?.service_providers?.length ?? 0;
                    return (
                      <div
                        key={service.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {service.name}
                            </p>
                          </div>

                          <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                            {doctorsOnService} doctor{doctorsOnService !== 1 ? "s" : ""}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                            {service.duration} min
                          </span>
                          {service.price != null && (
                            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 whitespace-nowrap">
                              {formatCurrency(service.price)}
                            </span>
                          )}
                          <span
                            className={classNames(
                              "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
                              service.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            )}
                          >
                            {service.status === "active" ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-nowrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleServiceStatus(service)}
                            disabled={busyAction}
                            className={classNames(
                              "inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                              service.status === "active"
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            )}
                          >
                            <Power className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {service.status === "active" ? "Set inactive" : "Set active"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditService(service)}
                            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50"
                          >
                            <Pencil className="h-3 w-3 shrink-0" />
                            <span className="truncate">Edit</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setServiceToDelete(service)}
                            disabled={busyAction}
                            className="inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Doctor-service assignment matrix */}
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      Doctor-service assignment matrix
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Assign exact services to each doctor under{" "}
                      {selectedDepartment?.name ?? "the selected department"}.
                    </p>
                  </div>

                  <div className="relative w-full lg:w-72">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={doctorSearch}
                      onChange={(e) => setDoctorSearch(e.target.value)}
                      placeholder="Search doctors..."
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {filteredServices.length === 0 || filteredDoctors.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-semibold text-slate-700">
                      {filteredDoctors.length === 0
                        ? "No doctors assigned to this department yet"
                        : "No services to map against"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {filteredDoctors.length === 0
                        ? "Assign doctors to this department first on the Departments page."
                        : "Add a service to this department to start mapping doctors."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] border-collapse">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="sticky left-0 z-20 min-w-[250px] border-b border-slate-200 bg-slate-50 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Doctors
                            </th>

                            {filteredServices.map((service) => (
                              <th
                                key={service.id}
                                className="min-w-[140px] border-b border-slate-200 px-3 py-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                              >
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400">
                                    Service
                                  </p>
                                  <p className="text-sm normal-case tracking-normal text-slate-700">
                                    {service.name}
                                  </p>
                                  <span
                                    className={classNames(
                                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                      service.status === "active"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-slate-200 text-slate-600"
                                    )}
                                  >
                                    {service.status === "active" ? "Active" : "Inactive"}
                                  </span>
                                </div>
                              </th>
                            ))}

                            <th className="min-w-[180px] border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                              Quick actions
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {filteredDoctors.map((doctor) => {
                            const assignedCount = filteredServices.filter((service) =>
                              isDoctorAssignedToService(service, doctor.id)
                            ).length;

                            return (
                              <tr
                                key={doctor.id}
                                className="odd:bg-white even:bg-slate-50/50"
                              >
                                <td className="sticky left-0 z-10 border-b border-slate-200 bg-inherit px-4 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-sm font-semibold text-indigo-700">
                                      {doctor.avatar}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {doctor.name}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {doctor.role}
                                      </p>
                                      <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                                        <UserRound className="h-3 w-3" />
                                        {assignedCount} assigned
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                {filteredServices.map((service) => {
                                  const checked = isDoctorAssignedToService(
                                    service,
                                    doctor.id
                                  );
                                  const disabled =
                                    busyAction || service.status !== "active";

                                  return (
                                    <td
                                      key={service.id}
                                      className="border-b border-slate-200 px-3 py-4 text-center"
                                    >
                                      <button
                                        type="button"
                                        disabled={disabled}
                                        onClick={() =>
                                          handleToggleAssignment(service, doctor)
                                        }
                                        className={classNames(
                                          "mx-auto flex h-10 w-10 items-center justify-center rounded-xl border transition",
                                          service.status !== "active"
                                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                                            : checked
                                              ? "border-indigo-500 bg-indigo-600 text-white shadow-sm"
                                              : "border-slate-300 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-500",
                                          busyAction && "opacity-60"
                                        )}
                                        aria-label={`${
                                          checked ? "Remove" : "Assign"
                                        } ${service.name} for ${doctor.name}`}
                                      >
                                        {checked ? (
                                          <Check className="h-4 w-4" />
                                        ) : (
                                          <Plus className="h-4 w-4" />
                                        )}
                                      </button>
                                    </td>
                                  );
                                })}

                                <td className="border-b border-slate-200 px-4 py-4 align-middle">
                                  <div className="flex flex-col gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignAllForDoctor(doctor)}
                                      disabled={busyAction}
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Assign all active
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleClearAllForDoctor(doctor)}
                                      disabled={busyAction}
                                      className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Clear all
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Rules */}
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Rule 1
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      A doctor can only be assigned to services inside the selected department.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Rule 2
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      Only active services should be visible in customer booking by default.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Rule 3
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      If no doctor is assigned to a service, mark it unavailable for booking.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>

      {/* Add service modal */}
      {showAddServiceModal && selectedDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-600">Add service</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  New service for {selectedDepartment.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddServiceModal(false);
                  resetAddForm();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Service name
                </label>
                <input
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g. Cardiac Screening"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Duration
                  </label>
                  <select
                    value={newServiceDuration}
                    onChange={(e) =>
                      setNewServiceDuration(parseInt(e.target.value, 10))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      placeholder="0.00"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddServiceModal(false);
                  resetAddForm();
                }}
                className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddService}
                disabled={busyAction || !newServiceName.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {busyAction ? "Saving..." : "Save service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit service modal */}
      {showEditServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-600">Edit service</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  Update service details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditServiceModal(false);
                  resetEditForm();
                }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Service name
                </label>
                <input
                  value={editServiceName}
                  onChange={(e) => setEditServiceName(e.target.value)}
                  placeholder="Service name"
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Duration
                  </label>
                  <select
                    value={editServiceDuration}
                    onChange={(e) =>
                      setEditServiceDuration(parseInt(e.target.value, 10))
                    }
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  >
                    {DURATION_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                    {!DURATION_OPTIONS.includes(editServiceDuration) && (
                      <option value={editServiceDuration}>
                        {editServiceDuration} min
                      </option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editServicePrice}
                      onChange={(e) => setEditServicePrice(e.target.value)}
                      placeholder="0.00"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditServiceModal(false);
                  resetEditForm();
                }}
                className="inline-flex h-11 items-center rounded-2xl border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedService}
                disabled={busyAction || !editServiceName.trim()}
                className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {busyAction ? "Saving..." : "Update service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking impact modal */}
      {showBookingImpact && selectedDepartment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-600">Booking impact</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  Booking visibility for {selectedDepartment.name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Review which services are bookable based on active status and assigned doctors.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingImpact(false)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Service
                      </th>
                      <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Status
                      </th>
                      <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Assigned doctors
                      </th>
                      <th className="border-b border-slate-200 px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Booking result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDepartmentServices.map((service) => {
                      const assigned = service.meta_data?.service_providers ?? [];
                      const isBookable = service.status === "active" && assigned.length > 0;
                      return (
                        <tr key={service.id} className="odd:bg-white even:bg-slate-50/50">
                          <td className="border-b border-slate-200 px-4 py-4 align-top">
                            <p className="text-sm font-semibold text-slate-900">
                              {service.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {service.duration} min • {formatCurrency(service.price)}
                            </p>
                          </td>
                          <td className="border-b border-slate-200 px-4 py-4 align-top">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                service.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-slate-200 text-slate-600"
                              )}
                            >
                              {service.status === "active" ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="border-b border-slate-200 px-4 py-4 align-top">
                            {assigned.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {assigned.map((doctor) => (
                                  <span
                                    key={doctor.id}
                                    className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                                  >
                                    {doctor.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">
                                No doctors assigned
                              </span>
                            )}
                          </td>
                          <td className="border-b border-slate-200 px-4 py-4 align-top">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                isBookable
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {isBookable ? "Visible in booking" : "Hidden / unavailable"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {allDepartmentServices.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-4 py-6 text-center text-sm text-slate-500"
                        >
                          No services under this department yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Bookable
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Active service with at least one assigned doctor.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Hidden
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Inactive service stays hidden from customer booking.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Unavailable
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Active service without doctors is not bookable.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {serviceToDelete && (
        <ConfirmModal
          title="Delete service"
          message={`"${serviceToDelete.name}" will be removed from this department and hidden from customer booking. You can restore it later by re-adding the same service.`}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteServiceConfirm}
          onCancel={() => setServiceToDelete(null)}
          loading={busyAction}
        />
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </div>
  );
}
