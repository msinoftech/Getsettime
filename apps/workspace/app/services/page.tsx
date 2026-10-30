"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuBuilding2 as Building2,
  LuChevronDown as ChevronDown,
  LuChevronRight as ChevronRight,
  LuClock3 as Clock3,
  LuHeartPulse as HeartPulse,
  LuLayoutGrid as LayoutGrid,
  LuPlus as Plus,
  LuSearch as Search,
  LuBoxes as Boxes,
  LuSparkles as Sparkles,
  LuStethoscope as Stethoscope,
  LuUserRound as UserRound,
  LuUsers as Users,
  LuX as X,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuPower as Power,
  LuSmile as Smile,
} from "react-icons/lu";
import { Pagination, usePagination } from "@app/ui";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/src/components/ui/toast";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import {
  ServiceDepartmentTabsSkeleton,
  ServicePaginationSkeleton,
  ServiceTableRowsSkeleton,
  StatValueSkeleton,
} from "@/src/components/ui/ServiceSkeleton";
import { currencySymbol } from "@/src/constants/currency";
import { AddDepartmentPanel } from "@/src/features/departments/AddDepartmentPanel";
import { get_department_gradient } from "@/src/features/departments/department_colors";
import {
  EVENT_TYPE_FORMAT_OPTIONS,
  parse_event_type_format,
} from "@/src/features/event-types/event_type_format";
import {
  ServiceFilters,
  type service_status_filter,
} from "@/src/features/services/ServiceFilters";
import {
  ServiceFormPanel,
  type service_form_saved_result,
} from "@/src/features/services/ServiceFormPanel";
import type {
  service_doctor_row,
  service_record,
  service_status,
} from "@/src/features/services/service_records";
import { useServiceDepartmentDoctors } from "@/src/features/services/useServiceDepartmentDoctors";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import ScreenGate from "@/src/components/ScreenGate";
import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";

type DepartmentStatus = "active" | "inactive";
type ServiceStatus = service_status;
type StatusFilter = service_status_filter;

function serviceStatusLabel(status: ServiceStatus): string {
  if (status === "active") return "Public";
  if (status === "draft") return "Draft";
  if (status === "private") return "Private";
  return "Inactive";
}

function serviceStatusBadgeClass(status: ServiceStatus): string {
  if (status === "active") return "bg-emerald-50 text-emerald-600 border border-emerald-200";
  if (status === "draft") return "bg-slate-50 text-slate-600 border border-slate-200";
  return "bg-amber-50 text-amber-600 border border-amber-200";
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
    services?: { id: string; name: string }[];
    service_providers?: DepartmentServiceProviderMeta[];
    color?: string | null;
  } | null;
  created_at: string;
}

type Service = service_record;
type DoctorRow = service_doctor_row;

const SERVICES_PAGE_SIZE = 10;
const VISIBLE_DEPARTMENT_TABS = 5;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCurrency(
  value: number | null | undefined,
  symbol: string
): string {
  if (value == null) return "—";
  return `${symbol}${value.toFixed(2)}`;
}

const SERVICE_CARD_ICONS = [
  { Icon: Stethoscope, wrap: "bg-sky-50 text-sky-600" },
  { Icon: Sparkles, wrap: "bg-indigo-50 text-indigo-600" },
  { Icon: HeartPulse, wrap: "bg-orange-50 text-orange-600" },
  { Icon: Smile, wrap: "bg-indigo-50 text-indigo-600" },
  { Icon: Boxes, wrap: "bg-emerald-50 text-emerald-600" },
] as const;

function getServiceCardIcon(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % SERVICE_CARD_ICONS.length;
  }
  return SERVICE_CARD_ICONS[hash] ?? SERVICE_CARD_ICONS[0];
}

function eventTypeFormatLabel(value: unknown): string {
  const format = parse_event_type_format(value);
  return (
    EVENT_TYPE_FORMAT_OPTIONS.find((option) => option.value === format)?.label ??
    "One-to-one"
  );
}

export default function ServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const { general } = useWorkspaceSettings();
  const {
    resolve: doctorsForDepartmentId,
    department_ids_by_provider: deptIdsByProvider,
    providers: serviceProviders,
    loading: doctorPoolLoading,
    refetch: refetchUserDepartments,
  } = useServiceDepartmentDoctors();

  const currentUserRole =
    (user?.user_metadata?.role as string | undefined) ?? null;
  const isLoggedInServiceProvider = currentUserRole === "service_provider";
  const isStaffUser = currentUserRole === "staff";
  const currentUserId = user?.id ?? null;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [eventTypeFormatByServiceId, setEventTypeFormatByServiceId] = useState<
    Record<string, string>
  >({});
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(
    null
  );

  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [serviceSearch, setServiceSearch] = useState("");
  const [doctorSearch, setDoctorSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [showAddDepartmentPanel, setShowAddDepartmentPanel] = useState(false);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [showBookingImpact, setShowBookingImpact] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [showDepartmentOverflowMenu, setShowDepartmentOverflowMenu] =
    useState(false);
  const departmentOverflowTriggerRef = useRef<HTMLButtonElement>(null);
  const [departmentOverflowMenuPos, setDepartmentOverflowMenuPos] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [newFormDepartmentId, setNewFormDepartmentId] = useState<number | null>(null);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);

  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);

  const currency =
    typeof (general as { currency?: string | null } | undefined)?.currency === "string" &&
    (general as { currency?: string }).currency
      ? (general as { currency: string }).currency
      : "USD";
  const currencySign = currencySymbol(currency);

  const getAuthToken = useCallback(async () => {
    const { session } = await getWorkspaceSession();
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

  const fetchEventTypeFormatsByService = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return {} as Record<string, string>;
    const response = await fetch("/api/event-types", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return {} as Record<string, string>;
    const data = await response.json();
    const rows = (data.data ?? []) as Array<{
      service_id?: string | null;
      event_type_format?: string | null;
    }>;
    const map: Record<string, string> = {};
    for (const row of rows) {
      const serviceId = row.service_id?.trim();
      if (!serviceId || map[serviceId]) continue;
      map[serviceId] = eventTypeFormatLabel(row.event_type_format);
    }
    return map;
  }, [getAuthToken]);

  const loadAll = useCallback(
    async (opts?: { silent?: boolean; selectId?: number | null }) => {
      if (!opts?.silent) setInitialLoading(true);
      try {
        const [depts, svcs, formatMap] = await Promise.all([
          fetchDepartments(),
          fetchServices(),
          fetchEventTypeFormatsByService(),
        ]);
        setDepartments(depts);
        setServices(svcs);
        setEventTypeFormatByServiceId(formatMap);
        setSelectedDepartmentId((prev) => {
          if (opts && "selectId" in opts) {
            return opts.selectId ?? null;
          }
          if (prev === null) return null;
          if (prev !== null && depts.some((d) => d.id === prev)) return prev;
          return null;
        });
      } catch (err) {
        console.error("Error loading services page:", err);
      } finally {
        if (!opts?.silent) setInitialLoading(false);
      }
    },
    [fetchDepartments, fetchServices, fetchEventTypeFormatsByService]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!isLoggedInServiceProvider || !currentUserId) return;
    const assigned = deptIdsByProvider.get(currentUserId);
    if (!assigned || assigned.size === 0) return;
    setSelectedDepartmentId((prev) => {
      if (prev === null) return null;
      if (assigned.has(prev)) return prev;
      return null;
    });
  }, [
    isLoggedInServiceProvider,
    currentUserId,
    deptIdsByProvider,
    departments,
  ]);

  const assignedDeptIdsForCurrentProvider = useMemo(() => {
    if (!isLoggedInServiceProvider || !currentUserId) return new Set<number>();
    return deptIdsByProvider.get(currentUserId) ?? new Set<number>();
  }, [isLoggedInServiceProvider, currentUserId, deptIdsByProvider]);

  const departmentsForList = useMemo(() => {
    if (!isLoggedInServiceProvider) return departments;
    return departments.filter((d) => assignedDeptIdsForCurrentProvider.has(d.id));
  }, [departments, isLoggedInServiceProvider, assignedDeptIdsForCurrentProvider]);

  const visibleDepartmentTabs = useMemo(
    () => departmentsForList.slice(0, VISIBLE_DEPARTMENT_TABS),
    [departmentsForList]
  );

  const overflowDepartmentTabs = useMemo(
    () => departmentsForList.slice(VISIBLE_DEPARTMENT_TABS),
    [departmentsForList]
  );

  const selectedOverflowDepartment = useMemo(
    () =>
      overflowDepartmentTabs.find((d) => d.id === selectedDepartmentId) ?? null,
    [overflowDepartmentTabs, selectedDepartmentId]
  );

  const callServicesApi = useCallback(
    async (
      method: "POST" | "PUT" | "DELETE",
      body?: Record<string, unknown>,
      query?: string
    ) => {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
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
        toast.error(err?.error || `Request failed (${response.status})`);
        return null;
      }
      return response.json().catch(() => ({}));
    },
    [getAuthToken]
  );

  const refreshServiceAssignments = useCallback(async () => {
    await refetchUserDepartments();
    const svcs = await fetchServices();
    setServices(svcs);
  }, [fetchServices, refetchUserDepartments]);

  const selectedDepartment = useMemo(
    () => departments.find((d) => d.id === selectedDepartmentId) ?? null,
    [departments, selectedDepartmentId]
  );

  const scopedServices = useMemo(() => {
    if (!isLoggedInServiceProvider) return services;
    return services.filter(
      (s) =>
        s.department_id != null &&
        assignedDeptIdsForCurrentProvider.has(Number(s.department_id))
    );
  }, [services, isLoggedInServiceProvider, assignedDeptIdsForCurrentProvider]);

  const allDepartmentServices = useMemo(() => {
    if (selectedDepartmentId == null) return scopedServices;
    return scopedServices.filter(
      (s) => Number(s.department_id) === selectedDepartmentId
    );
  }, [scopedServices, selectedDepartmentId]);

  const getServiceDepartmentName = useCallback(
    (service: Service): string => {
      const rel = service.departments;
      if (Array.isArray(rel) && rel[0]?.name) return rel[0].name;
      if (rel && !Array.isArray(rel) && rel.name) return rel.name;
      const dept = departments.find(
        (d) => d.id === Number(service.department_id)
      );
      return dept?.name ?? "—";
    },
    [departments]
  );

  const getServiceDepartment = useCallback(
    (service: Service): Department | null => {
      if (service.department_id == null) return null;
      return (
        departments.find((d) => d.id === Number(service.department_id)) ?? null
      );
    },
    [departments]
  );

  const departmentDoctors = useMemo(
    () => doctorsForDepartmentId(selectedDepartmentId),
    [doctorsForDepartmentId, selectedDepartmentId]
  );

  const visibleDoctorsCount = useMemo(() => {
    if (selectedDepartment) return departmentDoctors.length;
    const ids = new Set<string>();
    for (const dept of departmentsForList) {
      for (const doctor of doctorsForDepartmentId(dept.id)) {
        ids.add(doctor.id);
      }
    }
    return ids.size;
  }, [
    selectedDepartment,
    departmentDoctors,
    departmentsForList,
    doctorsForDepartmentId,
  ]);

  const editingService = useMemo(
    () => services.find((s) => s.id === editServiceId) ?? null,
    [services, editServiceId]
  );

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    const durationMinutes =
      durationFilter === "" ? null : Number(durationFilter);
    return allDepartmentServices.filter((service) => {
      const matchesSearch =
        term === "" || service.name.toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && service.status === "active") ||
        (statusFilter === "draft" && service.status === "draft") ||
        (statusFilter === "private" &&
          (service.status === "private" || service.status === "inactive"));
      const matchesDoctor =
        doctorFilter === "" ||
        (service.meta_data?.service_providers ?? []).some(
          (p) => p.id === doctorFilter
        );
      const matchesDuration =
        durationMinutes == null ||
        !Number.isFinite(durationMinutes) ||
        Number(service.duration) === durationMinutes;
      return (
        matchesSearch && matchesStatus && matchesDoctor && matchesDuration
      );
    });
  }, [
    allDepartmentServices,
    serviceSearch,
    statusFilter,
    doctorFilter,
    durationFilter,
  ]);

  const filterDoctorOptions = useMemo(() => {
    const map = new Map<string, string>();
    const departments =
      selectedDepartment != null
        ? [selectedDepartment]
        : departmentsForList;
    for (const department of departments) {
      for (const doctor of doctorsForDepartmentId(department.id)) {
        map.set(doctor.id, doctor.name);
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    selectedDepartment,
    departmentsForList,
    doctorsForDepartmentId,
  ]);

  const filterDurationOptions = useMemo(() => {
    const unique = new Set<number>();
    for (const service of scopedServices) {
      const minutes = Number(service.duration);
      if (Number.isFinite(minutes) && minutes > 0) unique.add(minutes);
    }
    return [...unique].sort((a, b) => a - b);
  }, [scopedServices]);

  const showDoctorFilter =
    !isLoggedInServiceProvider && filterDoctorOptions.length > 0;

  const {
    paginatedItems: paginatedServices,
    currentPage: servicesPage,
    setCurrentPage: setServicesPage,
    totalPages: servicesTotalPages,
    totalItems: servicesTotalItems,
    handlePageChange: handleServicesPageChange,
  } = usePagination(filteredServices, SERVICES_PAGE_SIZE);

  useEffect(() => {
    setServicesPage(1);
  }, [
    serviceSearch,
    statusFilter,
    doctorFilter,
    durationFilter,
    selectedDepartmentId,
    setServicesPage,
  ]);

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

  const activeDepartmentsCount = useMemo(
    () => departmentsForList.filter((d) => d.status === "active").length,
    [departmentsForList]
  );

  const isDoctorAssignedToService = useCallback(
    (service: Service, doctorId: string) =>
      (service.meta_data?.service_providers ?? []).some((p) => p.id === doctorId),
    []
  );

  const handleSelectDepartment = (departmentId: number | null) => {
    setSelectedDepartmentId(departmentId);
    setShowDepartmentOverflowMenu(false);
    setServiceSearch("");
    setDoctorSearch("");
    setStatusFilter("all");
    setDoctorFilter("");
    setDurationFilter("");
    setRowMenuId(null);
  };

  const openAddServiceDrawer = () => {
    if (isStaffUser) return;
    if (departmentsForList.length === 0) return;
    setShowAddDepartmentPanel(false);
    setEditServiceId(null);
    setShowEditServiceModal(false);
    setNewFormDepartmentId(selectedDepartmentId ?? departmentsForList[0]?.id ?? null);
    setShowAddServiceModal(true);
  };

  const handleAddDepartmentCreated = useCallback(
    async (created: { id: number; name: string }) => {
      await Promise.all([
        loadAll({ silent: true, selectId: created.id }),
        refetchUserDepartments(),
      ]);
      setShowAddDepartmentPanel(false);
    },
    [loadAll, refetchUserDepartments]
  );

  const openEditService = (service: Service) => {
    if (isStaffUser) return;
    setEditServiceId(service.id);
    setShowAddDepartmentPanel(false);
    setShowAddServiceModal(false);
    setNewFormDepartmentId(null);
    setShowEditServiceModal(true);
  };

  const handleServiceSaved = async ({
    service,
    assignments_synced,
  }: service_form_saved_result) => {
    toast.success(
      showEditServiceModal
        ? `"${service.name}" updated successfully.`
        : `"${service.name}" added successfully.`
    );

    if (!assignments_synced) {
      setServices((prev) => [service, ...prev]);
      return;
    }
    await refreshServiceAssignments();
    closeServicePanel();
  };

  const handleToggleServiceStatus = async (service: Service) => {
    const nextStatus: ServiceStatus =
      service.status === "active" ? "private" : "active";

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
    const deletedName = serviceToDelete.name;
    setBusyAction(true);
    const data = await callServicesApi("DELETE", undefined, `id=${id}`);
    setBusyAction(false);

    if (data) {
      toast.success(`"${deletedName}" deleted successfully.`);
      setServices((prev) => prev.filter((s) => s.id !== id));
      setServiceToDelete(null);
    }
  };

  const handleToggleAssignment = async (service: Service, doctor: DoctorRow) => {
    if (service.status !== "active") return;

    const current = service.meta_data?.service_providers ?? [];
    const exists = current.some((p) => p.id === doctor.id);

    setBusyAction(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      if (exists) {
        const del = await fetch(
          `/api/user-services?user_id=${encodeURIComponent(doctor.id)}&service_id=${encodeURIComponent(service.id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!del.ok) {
          const err = await del.json().catch(() => null);
          toast.error(err?.error || `Request failed (${del.status})`);
          return;
        }
      } else {
        const post = await fetch("/api/user-services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: doctor.id,
            service_id: service.id,
          }),
        });
        if (!post.ok) {
          const err = await post.json().catch(() => null);
          toast.error(err?.error || `Request failed (${post.status})`);
          return;
        }
      }
      await refreshServiceAssignments();
    } finally {
      setBusyAction(false);
    }
  };

  const handleAssignAllForDoctor = async (doctor: DoctorRow) => {
    const targets = allDepartmentServices.filter((service) => {
      if (service.status !== "active") return false;
      const providers = service.meta_data?.service_providers ?? [];
      return !providers.some((p) => p.id === doctor.id);
    });

    if (targets.length === 0) return;

    setBusyAction(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      for (const service of targets) {
        const post = await fetch("/api/user-services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: doctor.id,
            service_id: service.id,
          }),
        });
        if (!post.ok) {
          const err = await post.json().catch(() => null);
          toast.error(err?.error || `Request failed (${post.status})`);
          return;
        }
      }
      await refreshServiceAssignments();
    } finally {
      setBusyAction(false);
    }
  };

  const handleClearAllForDoctor = async (doctor: DoctorRow) => {
    const targets = allDepartmentServices.filter((service) =>
      (service.meta_data?.service_providers ?? []).some((p) => p.id === doctor.id)
    );

    if (targets.length === 0) return;

    setBusyAction(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }
      for (const service of targets) {
        const del = await fetch(
          `/api/user-services?user_id=${encodeURIComponent(doctor.id)}&service_id=${encodeURIComponent(service.id)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!del.ok) {
          const err = await del.json().catch(() => null);
          toast.error(err?.error || `Request failed (${del.status})`);
          return;
        }
      }
      await refreshServiceAssignments();
    } finally {
      setBusyAction(false);
    }
  };

  const panelOpen = showAddServiceModal || showEditServiceModal;
  const panelVisible = panelOpen || panelAnimatedOpen;

  useEffect(() => {
    if (!panelOpen) {
      setPanelAnimatedOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelAnimatedOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [panelOpen]);

  useEffect(() => {
    if (!rowMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-portal-actions-menu]")) {
        return;
      }
      setRowMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId]);

  useEffect(() => {
    if (!showDepartmentOverflowMenu) {
      setDepartmentOverflowMenuPos(null);
      return;
    }

    const updatePosition = () => {
      const trigger = departmentOverflowTriggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const menuWidth = 192;
      const left = Math.min(
        Math.max(rect.left, 8),
        window.innerWidth - menuWidth - 8
      );
      setDepartmentOverflowMenuPos({
        top: rect.bottom + 4,
        left,
      });
    };

    updatePosition();

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-department-overflow-menu]")) {
        return;
      }
      setShowDepartmentOverflowMenu(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showDepartmentOverflowMenu]);

  const closeServicePanel = () => {
    setShowAddServiceModal(false);
    setShowEditServiceModal(false);
    setNewFormDepartmentId(null);
    setEditServiceId(null);
  };

  const openAddDepartmentDrawer = () => {
    if (isLoggedInServiceProvider || isStaffUser) return;
    closeServicePanel();
    setShowAddDepartmentPanel(true);
  };

  const isPageLoading = initialLoading || authLoading;
  const showRowActions = !isStaffUser;

  return (
    <>
    <div className={classNames( "transition-[margin] duration-300 ease-in-out")}>
      <div className="mx-auto space-y-5">
        {/* Top header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Services
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage services, departments, and provider-specific assignments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">

            <ScreenGate minWidth={1024}>
            <button
              type="button"
              onClick={() => setShowBookingImpact(true)}
              disabled={allDepartmentServices.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LayoutGrid className="h-4 w-4" />
              View booking impact
            </button>
            </ScreenGate>

            {!isLoggedInServiceProvider && !isStaffUser && (
              <button
                type="button"
                onClick={openAddDepartmentDrawer}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Building2 className="h-4 w-4" />
                Add Department
              </button>
            )}

            {!isStaffUser ? (
              <button
                type="button"
                onClick={openAddServiceDrawer}
                disabled={departmentsForList.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </button>
            ) : null}
          </div>
        </div>

        <ScreenGate minWidth={768}>
          {/* Stats row */}
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-slate-500">Active departments</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isPageLoading ? (
                    <StatValueSkeleton />
                  ) : (
                    activeDepartmentsCount
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Boxes className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-slate-500">Active services</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isPageLoading ? <StatValueSkeleton /> : activeServicesCount}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Users className="h-4 w-4 md:h-5 md:w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug text-slate-500">Assigned consultants</p>
                <p className="text-2xl font-bold text-slate-900">
                  {isPageLoading ? <StatValueSkeleton /> : visibleDoctorsCount}
                </p>
              </div>
            </div>
          </div>
        </ScreenGate>

        {/* All Services */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <ServiceFilters
              leading={
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    All Services
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {isPageLoading
                      ? "Services across all departments with consultant assignments."
                      : selectedDepartment
                        ? `Services under ${selectedDepartment.name} with consultant assignments.`
                        : "Services across all departments with consultant assignments."}
                  </p>
                </div>
              }
              search={serviceSearch}
              status_filter={statusFilter}
              doctor_filter={doctorFilter}
              duration_filter={durationFilter}
              doctor_options={filterDoctorOptions}
              duration_options={filterDurationOptions}
              show_doctor_filter={showDoctorFilter}
              result_count={filteredServices.length}
              on_search_change={setServiceSearch}
              on_status_filter_change={setStatusFilter}
              on_doctor_filter_change={setDoctorFilter}
              on_duration_filter_change={setDurationFilter}
            />
          </div>
          
          <ScreenGate minWidth={1024}>
            {/* Department tabs */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {isPageLoading ? (
                <ServiceDepartmentTabsSkeleton />
              ) : departmentsForList.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {isLoggedInServiceProvider
                    ? "No assigned departments yet."
                    : "No departments yet. Create a department first to add services."}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSelectDepartment(null)}
                    className={classNames(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      selectedDepartmentId === null
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    All Departments
                  </button>
                  {visibleDepartmentTabs.map((department) => {
                    const active = department.id === selectedDepartmentId;
                    return (
                      <button
                        key={department.id}
                        type="button"
                        onClick={() => handleSelectDepartment(department.id)}
                        className={classNames(
                          "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                          active
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {department.name}
                        {department.status === "inactive" ? " (Inactive)" : ""}
                      </button>
                    );
                  })}
                  {overflowDepartmentTabs.length > 0 ? (
                    <div
                      className="relative shrink-0"
                      data-department-overflow-menu
                    >
                      <button
                        ref={departmentOverflowTriggerRef}
                        type="button"
                        onClick={() =>
                          setShowDepartmentOverflowMenu((prev) => !prev)
                        }
                        aria-expanded={showDepartmentOverflowMenu}
                        aria-haspopup="listbox"
                        className={classNames(
                          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                          selectedOverflowDepartment
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <span className="max-w-[10rem] truncate">
                          {selectedOverflowDepartment
                            ? `${selectedOverflowDepartment.name}${
                                selectedOverflowDepartment.status === "inactive"
                                  ? " (Inactive)"
                                  : ""
                              }`
                            : `More (${overflowDepartmentTabs.length})`}
                        </span>
                        <ChevronDown
                          className={classNames(
                            "h-3.5 w-3.5 shrink-0 transition",
                            showDepartmentOverflowMenu && "rotate-180"
                          )}
                        />
                      </button>
                      {showDepartmentOverflowMenu &&
                      departmentOverflowMenuPos &&
                      typeof document !== "undefined"
                        ? createPortal(
                            <div
                              data-department-overflow-menu
                              role="listbox"
                              style={{
                                top: departmentOverflowMenuPos.top,
                                left: departmentOverflowMenuPos.left,
                              }}
                              className="fixed z-[80] max-h-56 min-w-[12rem] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                            >
                              {overflowDepartmentTabs.map((department) => {
                                const active =
                                  department.id === selectedDepartmentId;
                                return (
                                  <button
                                    key={department.id}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    onClick={() =>
                                      handleSelectDepartment(department.id)
                                    }
                                    className={classNames(
                                      "flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm transition",
                                      active
                                        ? "bg-indigo-50 font-medium text-indigo-800"
                                        : "text-slate-700 hover:bg-slate-50"
                                    )}
                                  >
                                    {department.name}
                                    {department.status === "inactive"
                                      ? " (Inactive)"
                                      : ""}
                                  </button>
                                );
                              })}
                            </div>,
                            document.body
                          )
                        : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScreenGate>

          {/* Services list - Desktop view */}
          <ScreenGate minWidth={1024}>
            <div className="overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-100">
                    <tr className="text-left text-sm text-slate-900">
                      <th className="px-6 py-4 font-semibold">
                        Department
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Service
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Duration
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Assigned Consultants
                      </th>
                      <th className="px-6 py-4 font-semibold">
                        Status
                      </th>
                      {showRowActions ? (
                        <th className="px-6 py-4 text-right font-semibold">
                          Action
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {isPageLoading ? (
                      <ServiceTableRowsSkeleton showActions={showRowActions} />
                    ) : (
                      <>
                        {paginatedServices.length === 0 && (
                          <tr>
                            <td colSpan={showRowActions ? 6 : 5} className="px-4 py-10 text-center">
                              <p className="text-sm font-medium text-slate-700">
                                No services found
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {allDepartmentServices.length === 0
                                  ? selectedDepartment
                                    ? "Add the first service for this department."
                                    : "Add the first service to get started."
                                  : "Try changing the search or status filter."}
                              </p>
                            </td>
                          </tr>
                        )}

                        {paginatedServices.map((service) => {
                          const assigned = service.meta_data?.service_providers ?? [];
                          const deptName = getServiceDepartmentName(service);
                          const serviceDepartment = getServiceDepartment(service);
                          return (
                            <tr key={service.id} className="cursor-pointer transition hover:bg-slate-50 border border-slate-100 last:border-b-0  border-b border-slate-100">
                              <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Department">
                                {serviceDepartment ? (
                                  <span className={classNames(
                                      "inline-flex rounded-full bg-gradient-to-br px-2.5 py-1 text-sm font-medium text-white",
                                      get_department_gradient(serviceDepartment)
                                    )}
                                  >
                                    {deptName}
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-600">
                                    {deptName}
                                  </span>
                                )}
                              </td>
                              <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Service">
                                <p className="text-sm font-semibold text-slate-900">
                                  {service.name}
                                </p>
                                {service.price != null && (
                                  <p className="mt-0.5 text-sm text-slate-600">
                                    {formatCurrency(service.price, currencySign)}
                                  </p>
                                )}
                              </td>
                              <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Duration">
                                {service.duration} min
                              </td>
                              <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Assigned Consultants">
                                {assigned.length === 0 ? (
                                  <span className="text-sm text-slate-400">
                                    Unassigned
                                  </span>
                                ) : (
                                  <div className="flex items-center max-[1301px]:justify-end gap-2.5">
                                    <div className="flex shrink-0 items-center">
                                      {assigned.slice(0, 3).map((doctor, index) => (
                                        <div
                                          key={doctor.id}
                                          className={classNames(
                                            "relative rounded-full ring-2 ring-white",
                                            index > 0 && "-ml-2"
                                          )}
                                          style={{ zIndex: assigned.length - index }}
                                        >
                                          <WorkspaceUserAvatar
                                            name={doctor.name}
                                            userId={doctor.id}
                                            size="sm"
                                          />
                                        </div>
                                      ))}
                                      {assigned.length > 3 && (
                                        <span className="relative -ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 ring-2 ring-white">
                                          +{assigned.length - 3}
                                        </span>
                                      )}
                                    </div>
                                    <p className="min-w-0 text-sm leading-snug text-slate-800">
                                      {assigned.map((doctor, index) => (
                                        <span key={doctor.id}>
                                          {doctor.name}
                                          {index < assigned.length - 1 ? "," : ""}
                                          {index < assigned.length - 1 ? (
                                            <br />
                                          ) : null}
                                        </span>
                                      ))}
                                    </p>
                                  </div>
                                )}
                              </td>
                              <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Status">
                                <span
                                  className={classNames(
                                    "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                    serviceStatusBadgeClass(service.status)
                                  )}
                                >
                                  {serviceStatusLabel(service.status)}
                                </span>
                              </td>
                              {showRowActions ? (
                                <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium align-middle border-b border-slate-100" data-label="Action">
                                  <div className="flex items-center justify-end gap-2">
                                    <PortalActionsMenu
                                      open={rowMenuId === service.id}
                                      onToggle={() =>
                                        setRowMenuId((prev) =>
                                          prev === service.id ? null : service.id
                                        )
                                      }
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openEditService(service)}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 disabled:opacity-60"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={busyAction}
                                        onClick={() => {
                                          setRowMenuId(null);
                                          handleToggleServiceStatus(service);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        <Power className="h-3.5 w-3.5" />
                                        {service.status === "active"
                                          ? "Set private"
                                          : "Set public"}
                                      </button>
                                      <button
                                        type="button"
                                        role="menuitem"
                                        disabled={busyAction}
                                        onClick={() => {
                                          setRowMenuId(null);
                                          setServiceToDelete(service);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
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
                      </>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                {isPageLoading ? (
                  <ServicePaginationSkeleton />
                ) : (
                  <Pagination
                    currentPage={servicesPage}
                    totalPages={servicesTotalPages}
                    totalItems={servicesTotalItems}
                    itemsPerPage={SERVICES_PAGE_SIZE}
                    onPageChange={handleServicesPageChange}
                    loading={busyAction}
                    itemLabel="services"
                  />
                )}
              </div>
            </div>
          </ScreenGate>

          {/* Services list - Mobile view */}
          <ScreenGate maxWidth={1023}>
            <div className="space-y-3">
              {isPageLoading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={`service-card-skeleton-${index}`}
                    className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                  />
                ))
              ) : paginatedServices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    No services found
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {allDepartmentServices.length === 0
                      ? selectedDepartment
                        ? "Add the first service for this department."
                        : "Add the first service to get started."
                      : "Try changing the search or status filter."}
                  </p>
                </div>
              ) : (
                paginatedServices.map((service) => {
                  const assigned = service.meta_data?.service_providers ?? [];
                  const deptName = getServiceDepartmentName(service);
                  const { Icon, wrap } = getServiceCardIcon(service.id || service.name);
                  const visibleAvatars = assigned.slice(0, 2);
                  const overflowCount = Math.max(0, assigned.length - visibleAvatars.length);
                  const statusLabel =
                    service.status === "active"
                      ? "Active"
                      : serviceStatusLabel(service.status);
                  const eventTypeFormat =
                    eventTypeFormatByServiceId[service.id] ?? null;

                  return (
                    <div key={service.id} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]">
                      <div className={classNames( "flex w-full items-start gap-3 text-left", showRowActions ? "cursor-pointer" :  "cursor-default" )}>
                        <div className="w-full flex justify-between">
                          <div className="flex w-full justify-between gap-2">
                            
                            <div className="flex md:flex-row flex-col justify-between gap-1.5">
                              <div className="flex gap-2">
                                <div className={classNames( "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", wrap )}>
                                  <Icon className="h-5 w-5" aria-hidden />
                                  {/* <span className={classNames( "text-sm sm:text-md font-bold", wrap )}>{service.name.charAt(0).toUpperCase()}</span> */}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-900">
                                    {service.name}
                                  </p>
                                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock3 className="h-3.5 w-3.5" aria-hidden />
                                      {service.duration} min
                                    </span>
                                  </p>
                                </div>
                              </div>
                              <ScreenGate maxWidth={639}>
                                <div className="flex items-center flex-wrap gap-2 min-w-0">
                                  <p className="text-sm text-slate-500">{deptName}</p>
                                  {eventTypeFormat ? (
                                    <>
                                      <span className={classNames( "inline-flex rounded-md px-2.5 py-0.5 text-xs", wrap )}>{eventTypeFormat}</span>
                                    </>
                                  ) : null}

                                  {assigned.length === 0 ? (
                                    <p className="text-sm text-slate-400">Unassigned</p>
                                  ) : (
                                    <div className="flex items-center gap-1.5 flex-row flex-wrap">
                                      <div className="flex items-center">
                                        {visibleAvatars.map((doctor, index) => (
                                          <div
                                            key={doctor.id}
                                            className={classNames(
                                              "relative rounded-full ring-2 ring-white",
                                              index > 0 && "-ml-2"
                                            )}
                                            style={{ zIndex: visibleAvatars.length - index }}
                                          >
                                            <WorkspaceUserAvatar
                                              name={doctor.name}
                                              userId={doctor.id}
                                              size="sm"
                                            />
                                          </div>
                                        ))}
                                        {overflowCount > 0 && (
                                          <span className="relative -ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700 ring-2 ring-white">
                                            +{overflowCount}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-slate-500">
                                        {assigned.length}{" "}
                                        {assigned.length === 1 ? "provider" : "providers"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </ScreenGate>
                            </div>

                            <ScreenGate minWidth={640}>
                              <div className="min-w-0">
                                <p className="text-sm text-slate-500">{deptName}</p>
                                {eventTypeFormat ? (
                                  <>
                                    <span className={classNames( "inline-flex rounded-md mt-2 px-2.5 py-0.5 text-xs", wrap )}>{eventTypeFormat}</span>
                                  </>
                                ) : null}

                                {assigned.length === 0 ? (
                                  <p className="text-sm text-slate-400">Unassigned</p>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-row flex-wrap">
                                    <div className="flex items-center">
                                      {visibleAvatars.map((doctor, index) => (
                                        <div
                                          key={doctor.id}
                                          className={classNames(
                                            "relative rounded-full ring-2 ring-white",
                                            index > 0 && "-ml-2"
                                          )}
                                          style={{ zIndex: visibleAvatars.length - index }}
                                        >
                                          <WorkspaceUserAvatar
                                            name={doctor.name}
                                            userId={doctor.id}
                                            size="sm"
                                          />
                                        </div>
                                      ))}
                                      {overflowCount > 0 && (
                                        <span className="relative -ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sm font-semibold text-sky-700 ring-2 ring-white">
                                          +{overflowCount}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                      {assigned.length}{" "}
                                      {assigned.length === 1 ? "provider" : "providers"}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </ScreenGate>


                            <div className="flex shrink-0 items-start gap-2">
                              <div className="flex items-center flex-col gap-1.5">
                                <span className={classNames( "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", serviceStatusBadgeClass(service.status) )}>{statusLabel}</span>
                              
                                <span className="text-sm font-bold text-slate-900">
                                  {formatCurrency(service.price, currencySign)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                {showRowActions ? (
                                  <PortalActionsMenu
                                    open={rowMenuId === `mobile-${service.id}`}
                                    onToggle={() =>
                                      setRowMenuId((prev) =>
                                        prev === `mobile-${service.id}`
                                          ? null
                                          : `mobile-${service.id}`
                                      )
                                    }
                                  >
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={busyAction}
                                      onClick={() => {
                                        setRowMenuId(null);
                                        openEditService(service);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={busyAction}
                                      onClick={() => {
                                        setRowMenuId(null);
                                        handleToggleServiceStatus(service);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                    >
                                      <Power className="h-3.5 w-3.5" />
                                      {service.status === "active"
                                        ? "Set private"
                                        : "Set public"}
                                    </button>
                                    <button
                                      type="button"
                                      role="menuitem"
                                      disabled={busyAction}
                                      onClick={() => {
                                        setRowMenuId(null);
                                        setServiceToDelete(service);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Delete
                                    </button>
                                  </PortalActionsMenu>
                                ) : null}
                              </div>

                            </div>

                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className="relative">
                {isPageLoading ? (
                  <ServicePaginationSkeleton />
                ) : (
                  <Pagination
                    currentPage={servicesPage}
                    totalPages={servicesTotalPages}
                    totalItems={servicesTotalItems}
                    itemsPerPage={SERVICES_PAGE_SIZE}
                    onPageChange={handleServicesPageChange}
                    loading={busyAction}
                    itemLabel="services"
                  />
                )}
              </div>
            </div>
          </ScreenGate>
        </section>
      </div>
    </div>

      <aside
        className={classNames(
          "fixed inset-0 z-100001 h-full flex",
          "transform transition-transform duration-300 ease-in-out will-change-transform mb-0",
          panelAnimatedOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!panelVisible}
      >
        <button
            type="button"
            aria-label="Close exception panel"
            onClick={closeServicePanel}
            className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
          />
        {panelVisible && (
          <ServiceFormPanel
            key={showEditServiceModal ? `edit-${editServiceId}` : "add"}
            mode={showEditServiceModal ? "edit" : "add"}
            service={showEditServiceModal ? editingService : null}
            departments={showEditServiceModal ? departments : departmentsForList}
            existing_services={scopedServices}
            initial_department_id={newFormDepartmentId}
            resolve_department_doctors={doctorsForDepartmentId}
            doctors_loading={doctorPoolLoading}
            on_error={(message) => toast.error(message)}
            on_cancel={closeServicePanel}
            on_saved={handleServiceSaved}
          />
        )}
      </aside>

      {/* Booking impact modal */}
      {showBookingImpact && (
        <div className="fixed inset-0 z-1000001 flex items-center justify-center px-4 overflow-y-auto">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={() => setShowBookingImpact(false)}
          />
          <div className="relative z-10 flex max-h-[min(90vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl px-4 py-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-indigo-600">Booking impact</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">
                  Booking visibility
                  {selectedDepartment
                    ? ` for ${selectedDepartment.name}`
                    : " across all departments"}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Review which services are bookable based on public visibility and assigned consultants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingImpact(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(90vh,880px)] overflow-y-auto rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse rounded-2xl overflow-hidden">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Service
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Assigned consultants
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Booking result
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allDepartmentServices.map((service) => {
                      const assigned = service.meta_data?.service_providers ?? [];
                      const isBookable = service.status === "active" && assigned.length > 0;
                      return (
                        <tr key={service.id} className="cursor-pointer transition hover:bg-slate-50 border border-slate-100 last:border-b-0">
                          <td className="text-sm px-4 md:px-6 py-5 align-middle border-b border-slate-100" data-label="Service">
                            <p className="text-sm font-semibold text-slate-900">
                              {service.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {service.duration} min • {formatCurrency(service.price, currencySign)}
                            </p>
                          </td>
                          <td className="text-sm px-4 md:px-6 py-5 align-middle border-b border-slate-100" data-label="Status">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                serviceStatusBadgeClass(service.status)
                              )}
                            >
                              {serviceStatusLabel(service.status)}
                            </span>
                          </td>
                          <td className="text-sm px-4 md:px-6 py-5 align-middle border-b border-slate-100" data-label="Assigned consultants">
                            {assigned.length > 0 ? (
                              <div className="flex items-center max-[1301px]:justify-end gap-3">
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
                                No consultants assigned
                              </span>
                            )}
                          </td>
                          <td className="text-sm px-4 md:px-6 py-5 align-middle border-b border-slate-100" data-label="Booking result">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                isBookable
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
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
            
            <ScreenGate minWidth={768}>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Bookable
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Public service with at least one assigned consultant.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hidden
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Private, draft, or inactive services stay hidden from customer booking.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Unavailable
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  Public service without consultants is not bookable.
                </p>
              </div>
            </div>
            </ScreenGate>
            
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


      <AddDepartmentPanel
        open={showAddDepartmentPanel}
        onClose={() => setShowAddDepartmentPanel(false)}
        onCreated={(created) => {
          void handleAddDepartmentCreated(created);
        }}
      />
    </>
  );
}
