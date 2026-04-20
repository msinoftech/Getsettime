"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LuCheck as Check,
  LuPlus as Plus,
  LuSearch as Search,
  LuStethoscope as Stethoscope,
  LuBuilding2 as Building2,
  LuSparkles as Sparkles,
  LuBriefcaseMedical as BriefcaseMedical,
  LuUserPlus as UserPlus,
  LuCircleAlert as AlertCircle,
  LuLayers3 as Layers3,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuPower as Power,
  LuPowerOff as PowerOff,
  LuX as X,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { DepartmentSkeleton } from "@/src/components/ui/DepartmentSkeleton";
import { useServiceProviders } from "@/src/hooks/useBookingLookups";
import type { ServiceProvider } from "@/src/types/booking-entities";

type DepartmentStatus = "active" | "inactive";

interface DepartmentService {
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
  status: DepartmentStatus;
  flag: boolean;
  meta_data: {
    services?: DepartmentService[];
    service_providers?: DepartmentServiceProviderMeta[];
  } | null;
  created_at: string;
}

function serviceProviderDisplayName(p: ServiceProvider): string {
  return (
    p.raw_user_meta_data?.full_name ||
    p.raw_user_meta_data?.name ||
    p.email ||
    "Unknown"
  );
}

const DELETE_CONFIRM_MESSAGE =
  "Do you want to delete it? If you delete it then you need to again assign doctors. If you just want to hide this department, you can also deactivate it and it will hide from the booking form; you can activate it again anytime in the future.";

export default function DepartmentsPage() {
  const { data: serviceProviders } = useServiceProviders();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(
    null
  );

  const [departmentName, setDepartmentName] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(
    null
  );
  const [editDepartmentName, setEditDepartmentName] = useState("");

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"all" | "assigned" | "unassigned">(
    "all"
  );
  const [departmentFilter, setDepartmentFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [suggestions, setSuggestions] = useState<string[]>([]);
  // When suggestions exist, the custom-name input is hidden behind an "Other" chip.
  // When there are no suggestions, the input is always visible.
  const [showCustomInput, setShowCustomInput] = useState(false);
  const customInputRef = useRef<HTMLInputElement>(null);

  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchDepartments = useCallback(
    async (opts?: { selectId?: number | null; silent?: boolean }) => {
      if (!opts?.silent) setInitialLoading(true);
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch("/api/departments", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) return;

        const data = await response.json();
        const list: Department[] = data.departments || [];
        setDepartments(list);

        setSelectedDepartmentId((prev) => {
          if (opts && "selectId" in opts) {
            return opts.selectId ?? list[0]?.id ?? null;
          }
          if (prev !== null && list.some((d) => d.id === prev)) return prev;
          return list[0]?.id ?? null;
        });
      } catch (error) {
        console.error("Error fetching departments:", error);
      } finally {
        if (!opts?.silent) setInitialLoading(false);
      }
    },
    [getAuthToken]
  );

  const fetchSuggestions = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;

      const workspaceRes = await fetch("/api/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!workspaceRes.ok) return;

      const workspaceData = await workspaceRes.json();
      // `admin_professions_id` on `professions` stores the originating
      // `professions_list.id` and is the catalog key used by the Quick
      // Suggestions endpoint below.
      const adminProfessionsId: number | null =
        workspaceData?.workspace?.admin_professions_id ?? null;
      if (!adminProfessionsId) {
        setSuggestions([]);
        return;
      }

      const catalogRes = await fetch(
        `/api/catalog/departments?profession_id=${adminProfessionsId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!catalogRes.ok) return;

      const catalogData = await catalogRes.json();
      const names: string[] = Array.isArray(catalogData?.departments)
        ? catalogData.departments
        : [];
      setSuggestions(names);
    } catch (error) {
      console.error("Error fetching department suggestions:", error);
    }
  }, [getAuthToken]);

  useEffect(() => {
    fetchDepartments();
    fetchSuggestions();
  }, [fetchDepartments, fetchSuggestions]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const providerAssignments = useMemo(() => {
    const map = new Map<string, number[]>();
    departments.forEach((d) => {
      const providers = d.meta_data?.service_providers ?? [];
      providers.forEach((p) => {
        const prev = map.get(p.id) ?? [];
        if (!prev.includes(d.id)) {
          map.set(p.id, [...prev, d.id]);
        }
      });
    });
    return map;
  }, [departments]);

  type DoctorRow = {
    id: string;
    name: string;
    role: string;
    assignedDepartmentIds: number[];
  };

  const doctors = useMemo<DoctorRow[]>(() => {
    return serviceProviders.map((sp) => ({
      id: sp.id,
      name: serviceProviderDisplayName(sp),
      role: "Doctor",
      assignedDepartmentIds: providerAssignments.get(sp.id) ?? [],
    }));
  }, [serviceProviders, providerAssignments]);

  const filteredDoctors = useMemo(() => {
    if (!selectedDepartmentId) return doctors;
    const term = search.trim().toLowerCase();
    return doctors.filter((doctor) => {
      const matchesSearch = term === "" || doctor.name.toLowerCase().includes(term);
      const isAssignedToCurrent = doctor.assignedDepartmentIds.includes(
        selectedDepartmentId
      );
      if (viewMode === "assigned") return matchesSearch && isAssignedToCurrent;
      if (viewMode === "unassigned") return matchesSearch && !isAssignedToCurrent;
      return matchesSearch;
    });
  }, [doctors, search, selectedDepartmentId, viewMode]);

  const assignedDoctors = useMemo(() => {
    if (!selectedDepartmentId) return [];
    return doctors.filter((d) =>
      d.assignedDepartmentIds.includes(selectedDepartmentId)
    );
  }, [doctors, selectedDepartmentId]);

  const availableDoctors = useMemo(() => {
    if (!selectedDepartmentId) return doctors;
    return doctors.filter(
      (d) => !d.assignedDepartmentIds.includes(selectedDepartmentId)
    );
  }, [doctors, selectedDepartmentId]);

  const visibleAssignedDoctors = useMemo(() => {
    if (!selectedDepartmentId) return [];
    return filteredDoctors.filter((d) =>
      d.assignedDepartmentIds.includes(selectedDepartmentId)
    );
  }, [filteredDoctors, selectedDepartmentId]);

  const visibleAvailableDoctors = useMemo(() => {
    if (!selectedDepartmentId) return filteredDoctors;
    return filteredDoctors.filter(
      (d) => !d.assignedDepartmentIds.includes(selectedDepartmentId)
    );
  }, [filteredDoctors, selectedDepartmentId]);

  const totalAssignments = useMemo(
    () =>
      doctors.reduce(
        (sum, doctor) => sum + doctor.assignedDepartmentIds.length,
        0
      ),
    [doctors]
  );

  const unassignedDoctorsCount = useMemo(
    () => doctors.filter((d) => d.assignedDepartmentIds.length === 0).length,
    [doctors]
  );

  const activeDepartmentsCount = useMemo(
    () => departments.filter((d) => d.status === "active").length,
    [departments]
  );

  const inactiveDepartmentsCount = useMemo(
    () => departments.filter((d) => d.status === "inactive").length,
    [departments]
  );

  const filteredDepartments = useMemo(() => {
    if (departmentFilter === "active") {
      return departments.filter((d) => d.status === "active");
    }
    if (departmentFilter === "inactive") {
      return departments.filter((d) => d.status === "inactive");
    }
    return departments;
  }, [departments, departmentFilter]);

  const suggestionAlreadyExists = useCallback(
    (name: string) =>
      departments.some((d) => d.name.toLowerCase() === name.toLowerCase()),
    [departments]
  );

  const getDepartmentName = useCallback(
    (id: number) => departments.find((d) => d.id === id)?.name ?? "",
    [departments]
  );

  const getDepartmentStatus = useCallback(
    (id: number): DepartmentStatus =>
      departments.find((d) => d.id === id)?.status ?? "inactive",
    [departments]
  );

  const getDepartmentDoctorCount = useCallback(
    (departmentId: number) =>
      doctors.filter((doctor) =>
        doctor.assignedDepartmentIds.includes(departmentId)
      ).length,
    [doctors]
  );

  const callApi = useCallback(
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
      const url = query ? `/api/departments?${query}` : "/api/departments";
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

  const createDepartment = useCallback(
    async (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;

      const existing = departments.find(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        setSelectedDepartmentId(existing.id);
        setDepartmentName("");
        setShowCustomInput(false);
        return;
      }

      setBusyAction(true);
      const data = await callApi("POST", { name, status: "active" });
      setBusyAction(false);

      if (data?.department?.id != null) {
        await fetchDepartments({ selectId: data.department.id, silent: true });
      }
      setDepartmentName("");
      setShowCustomInput(false);
    },
    [callApi, departments, fetchDepartments]
  );

  const handleAddDepartment = () => createDepartment(departmentName);

  const addSuggestedDepartment = (name: string) => createDepartment(name);

  const startEditDepartment = (department: Department) => {
    setEditingDepartmentId(department.id);
    setEditDepartmentName(department.name);
  };

  const cancelEditDepartment = () => {
    setEditingDepartmentId(null);
    setEditDepartmentName("");
  };

  const saveDepartmentEdit = async (departmentId: number) => {
    const trimmedName = editDepartmentName.trim();
    if (!trimmedName) return;

    const duplicate = departments.find(
      (d) =>
        d.id !== departmentId &&
        d.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("Another department with this name already exists.");
      return;
    }

    setBusyAction(true);
    const data = await callApi("PUT", { id: departmentId, name: trimmedName });
    setBusyAction(false);

    if (data?.department) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === departmentId ? { ...d, ...data.department } : d))
      );
      cancelEditDepartment();
    }
  };

  const toggleDepartmentStatus = async (department: Department) => {
    const nextStatus: DepartmentStatus =
      department.status === "active" ? "inactive" : "active";

    setBusyAction(true);
    const data = await callApi("PUT", { id: department.id, status: nextStatus });
    setBusyAction(false);

    if (data?.department) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === department.id ? { ...d, ...data.department } : d))
      );
    }
  };

  const handleDeleteDepartmentClick = (id: number) => setDeleteConfirmId(id);

  const handleDeleteDepartmentConfirm = async () => {
    if (!deleteConfirmId) return;

    if (departments.length <= 1) {
      setDeleteConfirmId(null);
      setAlertMessage("You must keep at least one department.");
      return;
    }

    setBusyAction(true);
    const data = await callApi(
      "DELETE",
      undefined,
      `id=${deleteConfirmId}`
    );
    setBusyAction(false);

    if (data) {
      const removedId = deleteConfirmId;
      setDeleteConfirmId(null);
      await fetchDepartments({
        selectId:
          removedId === selectedDepartmentId
            ? departments.find((d) => d.id !== removedId)?.id ?? null
            : selectedDepartmentId,
        silent: true,
      });
    } else {
      setDeleteConfirmId(null);
    }
  };

  const assignDoctor = async (doctor: DoctorRow) => {
    if (!selectedDepartment || selectedDepartment.status === "inactive") return;
    if (doctor.assignedDepartmentIds.includes(selectedDepartment.id)) return;

    const current =
      selectedDepartment.meta_data?.service_providers ?? [];
    const nextProviders: DepartmentServiceProviderMeta[] = [
      ...current,
      { id: doctor.id, name: doctor.name },
    ];

    setBusyAction(true);
    const data = await callApi("PUT", {
      id: selectedDepartment.id,
      meta_data: { service_providers: nextProviders },
    });
    setBusyAction(false);

    if (data?.department) {
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === selectedDepartment.id ? { ...d, ...data.department } : d
        )
      );
    }
  };

  const unassignDoctor = async (doctor: DoctorRow) => {
    if (!selectedDepartment) return;
    const current =
      selectedDepartment.meta_data?.service_providers ?? [];
    const nextProviders = current.filter((p) => p.id !== doctor.id);

    setBusyAction(true);
    const data = await callApi("PUT", {
      id: selectedDepartment.id,
      meta_data: { service_providers: nextProviders },
    });
    setBusyAction(false);

    if (data?.department) {
      setDepartments((prev) =>
        prev.map((d) =>
          d.id === selectedDepartment.id ? { ...d, ...data.department } : d
        )
      );
    }
  };

  const DoctorCard = ({
    doctor,
    assigned,
  }: {
    doctor: DoctorRow;
    assigned: boolean;
  }) => {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                assigned
                  ? "bg-indigo-50 text-indigo-600"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <Stethoscope className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {doctor.name}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {doctor.role}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {doctor.assignedDepartmentIds.length > 0 ? (
                  doctor.assignedDepartmentIds.map((depId) => {
                    const departmentStatus = getDepartmentStatus(depId);

                    return (
                      <span
                        key={depId}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                          depId === selectedDepartmentId
                            ? "bg-indigo-100 text-indigo-700"
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        {getDepartmentName(depId)}
                        {departmentStatus === "inactive" ? " • Inactive" : ""}
                      </span>
                    );
                  })
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    No department assigned
                  </span>
                )}
              </div>
            </div>
          </div>

          {assigned ? (
            <button
              type="button"
              onClick={() => unassignDoctor(doctor)}
              disabled={busyAction}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => assignDoctor(doctor)}
              disabled={
                busyAction || selectedDepartment?.status === "inactive"
              }
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Assign
            </button>
          )}
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return <DepartmentSkeleton />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 xl:px-8">
        <div className="space-y-6">
          {/* Top Header */}
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 opacity-[0.07]" />
              <div className="relative flex flex-col gap-5 p-5 md:p-7 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Professional Department Workspace
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                    Department &amp; Doctor Assignment
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                    Manage departments, assign doctors to multiple specialties,
                    and keep your clinic structure organized with a clear and
                    powerful admin experience.
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                  <div className="relative min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search doctor name..."
                      className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Departments</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {departments.length}
                  </p>
                </div>
                <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Active</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {activeDepartmentsCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <Power className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Inactive</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {inactiveDepartmentsCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-3 text-slate-600">
                  <PowerOff className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Assignments</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {totalAssignments}
                  </p>
                </div>
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-600">
                  <BriefcaseMedical className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Unassigned</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {unassignedDoctorsCount}
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                  <AlertCircle className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            {/* Left Sidebar */}
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">
                    Department List
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add, edit, activate, deactivate, and delete departments.
                  </p>
                </div>

                {suggestions.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Quick Suggestions
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((item) => {
                        const exists = suggestionAlreadyExists(item);

                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => !exists && addSuggestedDepartment(item)}
                            disabled={busyAction}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                              exists
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {exists ? "\u2713" : "+"} {item}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomInput(true);
                          setTimeout(() => customInputRef.current?.focus(), 0);
                        }}
                        disabled={busyAction}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          showCustomInput
                            ? "border border-indigo-300 bg-indigo-50 text-indigo-700"
                            : "border border-dashed border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        + Other
                      </button>
                    </div>
                  </div>
                )}

                {(suggestions.length === 0 || showCustomInput) && (
                  <div className="mt-5 flex gap-2">
                    <input
                      ref={customInputRef}
                      value={departmentName}
                      onChange={(e) => setDepartmentName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddDepartment();
                        } else if (e.key === "Escape" && suggestions.length > 0) {
                          e.preventDefault();
                          setDepartmentName("");
                          setShowCustomInput(false);
                        }
                      }}
                      placeholder="Add new department"
                      className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddDepartment}
                      disabled={busyAction || !departmentName.trim()}
                      className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Add
                    </button>
                    {suggestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setDepartmentName("");
                          setShowCustomInput(false);
                        }}
                        disabled={busyAction}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter("all")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      departmentFilter === "all"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter("active")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      departmentFilter === "active"
                        ? "bg-emerald-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter("inactive")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      departmentFilter === "inactive"
                        ? "bg-slate-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Inactive
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {filteredDepartments.map((dep) => {
                    const active = dep.id === selectedDepartmentId;
                    const count = getDepartmentDoctorCount(dep.id);
                    const isEditing = editingDepartmentId === dep.id;

                    return (
                      <div
                        key={dep.id}
                        className={`rounded-2xl border p-3 transition ${
                          active
                            ? "border-indigo-500 bg-indigo-50 shadow-sm"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedDepartmentId(dep.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <p
                                className={`truncate text-sm font-semibold ${
                                  active ? "text-indigo-700" : "text-slate-900"
                                }`}
                              >
                                {dep.name}
                              </p>

                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  dep.status === "active"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-600"
                                }`}
                              >
                                {dep.status}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {count} doctor{count !== 1 ? "s" : ""}
                            </p>
                          </button>

                          {active && (
                            <div className="rounded-full bg-indigo-100 p-1 text-indigo-600">
                              <Check className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="mt-3 space-y-2">
                            <input
                              value={editDepartmentName}
                              onChange={(e) =>
                                setEditDepartmentName(e.target.value)
                              }
                              placeholder="Enter department name"
                              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                            />

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => saveDepartmentEdit(dep.id)}
                                disabled={busyAction || !editDepartmentName.trim()}
                                className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Check className="h-3.5 w-3.5" />
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={cancelEditDepartment}
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditDepartment(dep)}
                              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleDepartmentStatus(dep)}
                              disabled={busyAction}
                              className={`inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                dep.status === "active"
                                  ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              }`}
                            >
                              {dep.status === "active" ? (
                                <>
                                  <PowerOff className="h-3.5 w-3.5" />
                                  Inactivate
                                </>
                              ) : (
                                <>
                                  <Power className="h-3.5 w-3.5" />
                                  Activate
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteDepartmentClick(dep.id)}
                              disabled={busyAction || departments.length === 1}
                              className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {filteredDepartments.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                      <p className="text-sm font-semibold text-slate-700">
                        No departments found
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try switching filter or add a new department.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="space-y-6">
              {/* Department Overview */}
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      <Layers3 className="h-3.5 w-3.5" />
                      Selected Department
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-slate-900">
                        {selectedDepartment?.name ?? "No department selected"}
                      </h2>

                      {selectedDepartment && (
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                            selectedDepartment.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {selectedDepartment.status}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-slate-500">
                      View doctors assigned to this department and quickly add new ones.
                    </p>

                    {selectedDepartment?.status === "inactive" && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                        <AlertCircle className="h-4 w-4" />
                        This department is inactive. New doctor assignment is disabled.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Assigned
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {assignedDoctors.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Available
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {availableDoctors.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Coverage
                      </p>
                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {doctors.length === 0
                          ? "0%"
                          : `${Math.round(
                              (assignedDoctors.length / doctors.length) * 100
                            )}%`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setViewMode("all")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "all"
                        ? "bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("assigned")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "assigned"
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Assigned Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("unassigned")}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      viewMode === "unassigned"
                        ? "bg-amber-500 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Unassigned Only
                  </button>
                </div>
              </div>

              {/* Panels */}
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Assigned */}
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Assigned Doctors
                      </h3>
                      <p className="text-sm text-slate-500">
                        Doctors currently in {selectedDepartment?.name ?? "—"}
                      </p>
                    </div>

                    <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                      {visibleAssignedDoctors.length}
                    </span>
                  </div>

                  <div className="max-h-[620px] space-y-4 overflow-y-auto p-5">
                    {visibleAssignedDoctors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          No assigned doctors found
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Assigned doctors will appear here for this department.
                        </p>
                      </div>
                    ) : (
                      visibleAssignedDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          assigned={true}
                        />
                      ))
                    )}
                  </div>
                </div>

                {/* Available */}
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        Available Doctors
                      </h3>
                      <p className="text-sm text-slate-500">
                        Doctors available for assignment
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {visibleAvailableDoctors.length}
                    </span>
                  </div>

                  <div className="max-h-[620px] space-y-4 overflow-y-auto p-5">
                    {visibleAvailableDoctors.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                        <p className="text-sm font-semibold text-slate-700">
                          No available doctors found
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          All matching doctors are already assigned.
                        </p>
                      </div>
                    ) : (
                      visibleAvailableDoctors.map((doctor) => (
                        <DoctorCard
                          key={doctor.id}
                          doctor={doctor}
                          assigned={false}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Notice */}
              <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Better clinic control with multi-department assignment
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      This structure helps workspace admins manage doctors faster,
                      avoid confusion during booking, and maintain cleaner service allocation.
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm">
                    <UserPlus className="h-4 w-4" />
                    Smart Assignment Enabled
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete department"
          message={DELETE_CONFIRM_MESSAGE}
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteDepartmentConfirm}
          onCancel={() => setDeleteConfirmId(null)}
          loading={busyAction}
        />
      )}

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </div>
  );
}
