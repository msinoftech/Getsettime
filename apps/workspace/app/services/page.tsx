"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LuBuilding2 as Building2,
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuFileText as FileText,
  LuGlobe as Globe,
  LuInfo as Info,
  LuLayoutGrid as LayoutGrid,
  LuLock as Lock,
  LuPlus as Plus,
  LuSearch as Search,
  LuBoxes as Boxes,
  LuUserRound as UserRound,
  LuUsers as Users,
  LuX as X,
  LuPencil as Pencil,
  LuTrash2 as Trash2,
  LuPower as Power,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { Pagination, usePagination } from "@app/ui";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import { ServiceSkeleton } from "@/src/components/ui/ServiceSkeleton";
import { currencySymbol } from "@/src/constants/currency";
import { AddDepartmentPanel } from "@/src/features/departments/AddDepartmentPanel";
import { get_department_gradient } from "@/src/features/departments/department_colors";
import {
  ServiceFilters,
  type service_status_filter,
} from "@/src/features/services/ServiceFilters";
import { useServiceProviders, useUserDepartments } from "@/src/hooks/useBookingLookups";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import type { ServiceProvider } from "@/src/types/booking-entities";

type DepartmentStatus = "active" | "inactive";
/** Public=active, Private=private, Draft=draft; inactive kept for legacy rows. */
type ServiceStatus = "active" | "private" | "draft" | "inactive";
type VisibilityStatus = "active" | "private" | "draft";
type StatusFilter = service_status_filter;
type DoctorAssignMode = "all" | "specific";

const VISIBILITY_OPTIONS: {
  value: VisibilityStatus;
  label: string;
  Icon: IconType;
}[] = [
  { value: "active", label: "Public", Icon: Globe },
  { value: "private", label: "Private", Icon: Lock },
  { value: "draft", label: "Draft", Icon: FileText },
];

function toVisibilityStatus(status: ServiceStatus): VisibilityStatus {
  if (status === "active") return "active";
  if (status === "draft") return "draft";
  return "private";
}

function serviceStatusLabel(status: ServiceStatus): string {
  if (status === "active") return "Public";
  if (status === "draft") return "Draft";
  if (status === "private") return "Private";
  return "Inactive";
}

function serviceStatusBadgeClass(status: ServiceStatus): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "draft") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

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
  status: DepartmentStatus;
  flag: boolean;
  meta_data: {
    services?: { id: string; name: string }[];
    service_providers?: DepartmentServiceProviderMeta[];
    color?: string | null;
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
  meta_data: {
    service_providers?: ServiceProviderMeta[];
  } | null;
  created_at: string;
  updated_at: string;
}

interface DoctorRow {
  id: string;
  name: string;
  role: string;
  avatar: string;
  avatarUrl: string | null;
}

function ProviderAvatar({
  name,
  initials,
  avatarUrl,
  size = "md",
}: {
  name: string;
  initials: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-sm";
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={classNames(sizeClass, "shrink-0 rounded-full object-cover")}
      />
    );
  }
  return (
    <span
      className={classNames(
        sizeClass,
        "flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700"
      )}
    >
      {initials}
    </span>
  );
}

const DURATION_OPTIONS: number[] = [15, 20, 30, 40, 45, 60];
const DESCRIPTION_MAX_LENGTH = 150;
const SERVICES_PAGE_SIZE = 10;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function PanelSection({
  number,
  title,
  children,
  isLast = false,
}: {
  number: number;
  title: string;
  children: ReactNode;
  isLast?: boolean;
}) {
  return (
    <section className={isLast ? "p-4" : "border-b border-slate-200 p-4"}>
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
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

function formatCurrency(
  value: number | null | undefined,
  symbol: string
): string {
  if (value == null) return "—";
  return `${symbol}${value.toFixed(2)}`;
}

function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function ServicesPage() {
  const { user, loading: authLoading } = useAuth();
  const { general } = useWorkspaceSettings();
  const { data: serviceProviders } = useServiceProviders();
  const {
    byDepartment: providersByDepartmentId,
    byUser: deptIdsByProvider,
    refetch: refetchUserDepartments,
  } = useUserDepartments();

  const currentUserRole =
    (user?.user_metadata?.role as string | undefined) ?? null;
  const isLoggedInServiceProvider = currentUserRole === "service_provider";
  const isStaffUser = currentUserRole === "staff";
  const currentUserId = user?.id ?? null;

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
  const [doctorFilter, setDoctorFilter] = useState("");
  const [durationFilter, setDurationFilter] = useState("");

  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [showEditServiceModal, setShowEditServiceModal] = useState(false);
  const [showAddDepartmentPanel, setShowAddDepartmentPanel] = useState(false);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [showBookingImpact, setShowBookingImpact] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const [newServiceName, setNewServiceName] = useState("");
  const [newServiceDescription, setNewServiceDescription] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState(30);
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newFormDepartmentId, setNewFormDepartmentId] = useState<number | null>(null);
  const [newAssignMode, setNewAssignMode] = useState<DoctorAssignMode>("specific");
  const [newAssignedDoctorIds, setNewAssignedDoctorIds] = useState<string[]>([]);
  const [showNewAssignedMenu, setShowNewAssignedMenu] = useState(false);
  const [newServiceStatus, setNewServiceStatus] =
    useState<VisibilityStatus>("active");

  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState("");
  const [editServiceDescription, setEditServiceDescription] = useState("");
  const [editServiceDuration, setEditServiceDuration] = useState(30);
  const [editServicePrice, setEditServicePrice] = useState("");
  const [editAssignMode, setEditAssignMode] = useState<DoctorAssignMode>("specific");
  const [editAssignedDoctorIds, setEditAssignedDoctorIds] = useState<string[]>([]);
  const [showEditAssignedMenu, setShowEditAssignedMenu] = useState(false);
  const [editServiceStatus, setEditServiceStatus] =
    useState<VisibilityStatus>("active");

  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const currency =
    typeof (general as { currency?: string | null } | undefined)?.currency === "string" &&
    (general as { currency?: string }).currency
      ? (general as { currency: string }).currency
      : "USD";
  const currencySign = currencySymbol(currency);

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
    [fetchDepartments, fetchServices]
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

  const doctorsForDepartment = useCallback(
    (department: Department | null): DoctorRow[] => {
      if (!department) return [];
      const assignedIds = providersByDepartmentId.get(department.id) ?? new Set();
      const rows: DoctorRow[] = serviceProviders
        .filter((sp) => assignedIds.has(sp.id))
        .map((sp) => {
          const name = providerDisplayName(sp);
          return {
            id: sp.id,
            name,
            role: "Doctor",
            avatar: providerInitials(name),
            avatarUrl: sp.avatar_url?.trim() || null,
          };
        });

      if (
        isLoggedInServiceProvider &&
        currentUserId &&
        assignedIds.has(currentUserId) &&
        !rows.some((r) => r.id === currentUserId)
      ) {
        const meta = user?.user_metadata as
          | {
              full_name?: string;
              name?: string;
              avatar_url?: string;
              picture?: string;
            }
          | undefined;
        const name =
          meta?.full_name?.trim() ||
          meta?.name?.trim() ||
          user?.email ||
          "You";
        const avatarUrl =
          (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
          (typeof meta?.picture === "string" && meta.picture.trim()) ||
          null;
        rows.push({
          id: currentUserId,
          name,
          role: "Doctor",
          avatar: providerInitials(name),
          avatarUrl,
        });
      }

      return rows;
    },
    [
      serviceProviders,
      providersByDepartmentId,
      isLoggedInServiceProvider,
      currentUserId,
      user,
    ]
  );

  const departmentDoctors = useMemo(
    () => doctorsForDepartment(selectedDepartment),
    [doctorsForDepartment, selectedDepartment]
  );

  const providerAvatarById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const sp of serviceProviders) {
      map.set(sp.id, sp.avatar_url?.trim() || null);
    }
    if (currentUserId && user?.user_metadata) {
      const meta = user.user_metadata as {
        avatar_url?: string;
        picture?: string;
      };
      const avatarUrl =
        (typeof meta.avatar_url === "string" && meta.avatar_url.trim()) ||
        (typeof meta.picture === "string" && meta.picture.trim()) ||
        null;
      if (!map.has(currentUserId)) {
        map.set(currentUserId, avatarUrl);
      }
    }
    return map;
  }, [serviceProviders, currentUserId, user]);

  const visibleDoctorsCount = useMemo(() => {
    if (selectedDepartment) return departmentDoctors.length;
    const ids = new Set<string>();
    for (const dept of departmentsForList) {
      for (const doctor of doctorsForDepartment(dept)) {
        ids.add(doctor.id);
      }
    }
    return ids.size;
  }, [
    selectedDepartment,
    departmentDoctors,
    departmentsForList,
    doctorsForDepartment,
  ]);

  const newFormDepartment = useMemo(
    () =>
      departmentsForList.find((d) => d.id === newFormDepartmentId) ?? null,
    [departmentsForList, newFormDepartmentId]
  );

  const addFormDoctors = useMemo(
    () => doctorsForDepartment(newFormDepartment),
    [doctorsForDepartment, newFormDepartment]
  );

  const editFormDepartment = useMemo(() => {
    if (!editServiceId) return null;
    const service = services.find((s) => s.id === editServiceId);
    if (!service?.department_id) return null;
    return (
      departments.find((d) => d.id === Number(service.department_id)) ?? null
    );
  }, [editServiceId, services, departments]);

  const editFormDoctors = useMemo(
    () => doctorsForDepartment(editFormDepartment),
    [doctorsForDepartment, editFormDepartment]
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
      for (const doctor of doctorsForDepartment(department)) {
        map.set(doctor.id, doctor.name);
      }
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [
    selectedDepartment,
    departmentsForList,
    doctorsForDepartment,
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

  const syncServiceDoctorAssignments = useCallback(
    async (serviceId: string, doctorIds: string[]) => {
      const token = await getAuthToken();
      if (!token) {
        setAlertMessage("Not authenticated");
        return false;
      }

      const currentRes = await fetch(
        `/api/user-services?service_id=${encodeURIComponent(serviceId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!currentRes.ok) {
        const err = await currentRes.json().catch(() => null);
        setAlertMessage(err?.error || `Request failed (${currentRes.status})`);
        return false;
      }
      const currentData = await currentRes.json().catch(() => ({}));
      const currentIds = new Set<string>(
        ((currentData.assignments ?? []) as { user_id: string }[]).map(
          (a) => a.user_id
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
          setAlertMessage(err?.error || `Request failed (${post.status})`);
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
          setAlertMessage(err?.error || `Request failed (${del.status})`);
          return false;
        }
      }

      return true;
    },
    [getAuthToken]
  );

  const resolveAssignedDoctorIds = (
    mode: DoctorAssignMode,
    selectedIds: string[],
    pool: DoctorRow[]
  ): string[] => {
    if (mode === "all") {
      return pool.map((d) => d.id);
    }
    const poolIds = new Set(pool.map((d) => d.id));
    return selectedIds.filter((id) => poolIds.has(id));
  };

  const resetAddForm = () => {
    setNewServiceName("");
    setNewServiceDescription("");
    setNewServiceDuration(30);
    setNewServicePrice("");
    setNewFormDepartmentId(null);
    setNewAssignMode("specific");
    setNewAssignedDoctorIds([]);
    setShowNewAssignedMenu(false);
    setNewServiceStatus("active");
  };

  const resetEditForm = () => {
    setEditServiceId(null);
    setEditServiceName("");
    setEditServiceDescription("");
    setEditServiceDuration(30);
    setEditServicePrice("");
    setEditAssignMode("specific");
    setEditAssignedDoctorIds([]);
    setShowEditAssignedMenu(false);
    setEditServiceStatus("active");
  };

  const handleSelectDepartment = (departmentId: number | null) => {
    setSelectedDepartmentId(departmentId);
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
    resetEditForm();
    setShowEditServiceModal(false);
    resetAddForm();
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

  const handleAddService = async () => {
    const name = newServiceName.trim();
    const departmentId = newFormDepartmentId;
    if (!name || departmentId == null) return;

    const departmentServices = scopedServices.filter(
      (s) => Number(s.department_id) === departmentId
    );
    const duplicate = departmentServices.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("A service with this name already exists in this department.");
      return;
    }

    const assignedIds = resolveAssignedDoctorIds(
      newAssignMode,
      newAssignedDoctorIds,
      addFormDoctors
    );
    if (
      newAssignMode === "specific" &&
      addFormDoctors.length > 0 &&
      assignedIds.length === 0
    ) {
      setAlertMessage("Please select at least one consultant for this service.");
      return;
    }

    setBusyAction(true);
    try {
      const price = parsePriceInput(newServicePrice);
      const data = await callServicesApi("POST", {
        name,
        description: newServiceDescription.trim() || null,
        duration: newServiceDuration,
        price,
        department_id: departmentId,
        status: newServiceStatus,
      });

      if (!data?.service) return;

      const newService = data.service as Service;

      // "all" → every department consultant; "specific" → only selected consultants.
      const ok = await syncServiceDoctorAssignments(newService.id, assignedIds);
      if (!ok) {
        setServices((prev) => [newService, ...prev]);
        return;
      }
      await refreshServiceAssignments();

      resetAddForm();
      setShowAddServiceModal(false);
    } finally {
      setBusyAction(false);
    }
  };

  const openEditService = (service: Service) => {
    if (isStaffUser) return;
    setEditServiceId(service.id);
    setEditServiceName(service.name);
    setEditServiceDescription(
      (service.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH)
    );
    setEditServiceDuration(service.duration ?? 30);
    setEditServicePrice(service.price != null ? String(service.price) : "");

    const serviceDept =
      service.department_id != null
        ? departments.find((d) => d.id === Number(service.department_id)) ?? null
        : null;
    const pool = doctorsForDepartment(serviceDept);
    const assigned = (service.meta_data?.service_providers ?? []).map((p) => p.id);
    const poolIds = new Set(pool.map((d) => d.id));
    const assignedInPool = assigned.filter((id) => poolIds.has(id));
    const allSelected =
      pool.length > 0 && pool.every((d) => assignedInPool.includes(d.id));

    setEditAssignMode(allSelected ? "all" : "specific");
    setEditAssignedDoctorIds(assignedInPool);
    setShowEditAssignedMenu(false);
    setEditServiceStatus(toVisibilityStatus(service.status));
    setShowAddDepartmentPanel(false);
    setShowAddServiceModal(false);
    resetAddForm();
    setShowEditServiceModal(true);
  };

  const handleSaveEditedService = async () => {
    if (!editServiceId) return;
    const name = editServiceName.trim();
    if (!name) return;

    const serviceDeptId = editFormDepartment?.id ?? null;
    const siblingServices = scopedServices.filter(
      (s) =>
        s.id !== editServiceId &&
        (serviceDeptId == null || Number(s.department_id) === serviceDeptId)
    );
    const duplicate = siblingServices.some(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("Another service in this department already has this name.");
      return;
    }

    const assignedIds = resolveAssignedDoctorIds(
      editAssignMode,
      editAssignedDoctorIds,
      editFormDoctors
    );
    if (
      editAssignMode === "specific" &&
      editFormDoctors.length > 0 &&
      assignedIds.length === 0
    ) {
      setAlertMessage("Please select at least one consultant for this service.");
      return;
    }

    setBusyAction(true);
    try {
      const data = await callServicesApi("PUT", {
        id: editServiceId,
        name,
        description: editServiceDescription.trim() || null,
        duration: editServiceDuration,
        price: parsePriceInput(editServicePrice),
        status: editServiceStatus,
      });

      if (!data?.service) return;

      // "all" → every department consultant; "specific" → only selected consultants
      // (also removes any previously assigned consultants not in the next set).
      const ok = await syncServiceDoctorAssignments(editServiceId, assignedIds);
      if (!ok) return;

      await refreshServiceAssignments();
      resetEditForm();
      setShowEditServiceModal(false);
    } finally {
      setBusyAction(false);
    }
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

    setBusyAction(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setAlertMessage("Not authenticated");
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
          setAlertMessage(err?.error || `Request failed (${del.status})`);
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
          setAlertMessage(err?.error || `Request failed (${post.status})`);
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
        setAlertMessage("Not authenticated");
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
          setAlertMessage(err?.error || `Request failed (${post.status})`);
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
        setAlertMessage("Not authenticated");
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
          setAlertMessage(err?.error || `Request failed (${del.status})`);
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
    if (newAssignMode !== "all") return;
    setNewAssignedDoctorIds(addFormDoctors.map((d) => d.id));
  }, [newAssignMode, addFormDoctors]);

  useEffect(() => {
    if (editAssignMode !== "all") return;
    setEditAssignedDoctorIds(editFormDoctors.map((d) => d.id));
  }, [editAssignMode, editFormDoctors]);

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

  const closeServicePanel = () => {
    setShowAddServiceModal(false);
    setShowEditServiceModal(false);
    resetAddForm();
    resetEditForm();
  };

  const openAddDepartmentDrawer = () => {
    if (isLoggedInServiceProvider || isStaffUser) return;
    closeServicePanel();
    setShowAddDepartmentPanel(true);
  };

  if (initialLoading || authLoading) {
    return <ServiceSkeleton />;
  }

  const panelFieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";
  const panelSelectClass =
    "w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-9 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

  const editVisibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === editServiceStatus) ??
    VISIBILITY_OPTIONS[0];
  const EditVisibilityIcon = editVisibilityOption.Icon;
  const newVisibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === newServiceStatus) ??
    VISIBILITY_OPTIONS[0];
  const NewVisibilityIcon = newVisibilityOption.Icon;

  return (
    <>
    <div
      className={classNames(
        "min-h-screen transition-[margin] duration-300 ease-in-out",
        (showAddDepartmentPanel || panelAnimatedOpen) &&
          "hidden lg:block lg:mr-[28rem]"
      )}
    >
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
            <button
              type="button"
              onClick={() => setShowBookingImpact(true)}
              disabled={allDepartmentServices.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LayoutGrid className="h-4 w-4" />
              View booking impact
            </button>

            {!isLoggedInServiceProvider && !isStaffUser && (
              <button
                type="button"
                onClick={openAddDepartmentDrawer}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
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
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                Add Service
              </button>
            ) : null}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{activeDepartmentsCount}</p>
              <p className="text-sm text-slate-500">active departments</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{activeServicesCount}</p>
              <p className="text-sm text-slate-500">active services</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-slate-900">{visibleDoctorsCount}</p>
              <p className="text-sm text-slate-500">assigned consultants</p>
            </div>
          </div>
        </div>

        {/* All Services */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4">
            <ServiceFilters
              leading={
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    All Services
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedDepartment
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

          {/* Department tabs */}
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {departmentsForList.length === 0 ? (
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
                      ? "border-violet-500 bg-violet-50 text-violet-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  All Departments
                </button>
                {departmentsForList.map((department) => {
                  const active = department.id === selectedDepartmentId;
                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => handleSelectDepartment(department.id)}
                      className={classNames(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                        active
                          ? "border-violet-500 bg-violet-50 text-violet-700"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {department.name}
                      {department.status === "inactive" ? " (Inactive)" : ""}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {/* Services table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Service
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Duration
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Assigned Consultants
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    {!isStaffUser ? (
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedServices.length === 0 && (
                    <tr>
                      <td colSpan={isStaffUser ? 5 : 6} className="px-4 py-10 text-center">
                        <p className="text-sm font-medium text-slate-700">No services found</p>
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
                      <tr
                        key={service.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                      >
                        <td className="px-4 py-3.5">
                          {serviceDepartment ? (
                            <span
                              className={classNames(
                                "inline-flex rounded-full bg-gradient-to-br px-2.5 py-1 text-xs font-medium text-white",
                                get_department_gradient(serviceDepartment)
                              )}
                            >
                              {deptName}
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {deptName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                          {service.price != null && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatCurrency(service.price, currencySign)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-600">
                          {service.duration} min
                        </td>
                        <td className="px-4 py-3.5">
                          {assigned.length === 0 ? (
                            <span className="text-sm text-slate-400">Unassigned</span>
                          ) : (
                            <div className="flex min-w-0 items-center gap-2.5">
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
                                    <ProviderAvatar
                                      name={doctor.name}
                                      initials={providerInitials(doctor.name)}
                                      avatarUrl={providerAvatarById.get(doctor.id)}
                                      size="sm"
                                    />
                                  </div>
                                ))}
                                {assigned.length > 3 && (
                                  <span className="relative -ml-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 ring-2 ring-white">
                                    +{assigned.length - 3}
                                  </span>
                                )}
                              </div>
                              <p className="min-w-0 text-sm leading-snug text-slate-800">
                                {assigned.map((doctor, index) => (
                                  <span key={doctor.id}>
                                    {doctor.name}
                                    {index < assigned.length - 1 ? "," : ""}
                                    {index < assigned.length - 1 ? <br /> : null}
                                  </span>
                                ))}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={classNames(
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                              serviceStatusBadgeClass(service.status)
                            )}
                          >
                            {serviceStatusLabel(service.status)}
                          </span>
                        </td>
                        {!isStaffUser ? (
                          <td className="px-4 py-3.5">
                            <div className="relative flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditService(service)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
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
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 px-4 py-3">
              <Pagination
                currentPage={servicesPage}
                totalPages={servicesTotalPages}
                totalItems={servicesTotalItems}
                itemsPerPage={SERVICES_PAGE_SIZE}
                onPageChange={handleServicesPageChange}
                loading={busyAction}
                itemLabel="services"
              />
            </div>
          </div>
        </section>

        {/* Consultant-service assignment matrix */}
        {/* <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Consultant-service assignment
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedDepartment
                  ? `Assign exact services to each consultant under ${selectedDepartment.name}.`
                  : "Select a department tab to manage consultant-service assignments."}
              </p>
            </div>

            {selectedDepartment && (
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  placeholder="Search consultants..."
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>
            )}
          </div>

          {!selectedDepartment ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                Choose a department to assign consultants
              </p>
              <p className="mt-1 text-xs text-slate-500">
                The assignment matrix is available when a single department filter is selected.
              </p>
            </div>
          ) : filteredServices.length === 0 || filteredDoctors.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-700">
                {filteredDoctors.length === 0
                  ? "No consultants assigned to this department yet"
                  : "No services to map against"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {filteredDoctors.length === 0
                  ? "Assign consultants to this department first on the Departments page."
                  : "Add a service to this department to start mapping consultants."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="sticky left-0 z-20 min-w-[220px] border-b border-slate-200 bg-slate-50 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Consultants
                      </th>

                      {filteredServices.map((service) => (
                        <th
                          key={service.id}
                          className="min-w-[140px] border-b border-slate-200 px-3 py-3.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          <div className="space-y-1">
                            <p className="text-sm normal-case tracking-normal font-semibold text-slate-700">
                              {service.name}
                            </p>
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                serviceStatusBadgeClass(service.status)
                              )}
                            >
                              {serviceStatusLabel(service.status)}
                            </span>
                          </div>
                        </th>
                      ))}

                      <th className="min-w-[160px] border-b border-slate-200 px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                          <td className="sticky left-0 z-10 border-b border-slate-100 bg-inherit px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <ProviderAvatar
                                name={doctor.name}
                                initials={doctor.avatar}
                                avatarUrl={doctor.avatarUrl}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {doctor.name}
                                </p>
                                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
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
                                className="border-b border-slate-100 px-3 py-3.5 text-center"
                              >
                                <button
                                  type="button"
                                  disabled={disabled}
                                  onClick={() =>
                                    handleToggleAssignment(service, doctor)
                                  }
                                  className={classNames(
                                    "mx-auto flex h-9 w-9 items-center justify-center rounded-lg border transition",
                                    service.status !== "active"
                                      ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-300"
                                      : checked
                                        ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                                        : "border-slate-300 bg-white text-slate-400 hover:border-blue-300 hover:text-blue-500",
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

                          <td className="border-b border-slate-100 px-4 py-3.5 align-middle">
                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => handleAssignAllForDoctor(doctor)}
                                disabled={busyAction}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Assign all active
                              </button>

                              <button
                                type="button"
                                onClick={() => handleClearAllForDoctor(doctor)}
                                disabled={busyAction}
                                className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
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
        </section> */}
      </div>

    </div>

      <aside
        className={classNames(
          "fixed top-16 right-0 bottom-0 z-30 flex w-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:w-[28rem]",
          "transform transition-transform duration-300 ease-in-out will-change-transform",
          panelAnimatedOpen
            ? "translate-x-0"
            : "pointer-events-none translate-x-full"
        )}
        aria-hidden={!panelVisible}
      >
        {panelVisible && (
          <>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {showEditServiceModal ? "Edit Service" : "Add Service"}
              </h2>
              <button
                type="button"
                onClick={closeServicePanel}
                className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
              {showEditServiceModal ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <PanelSection number={1} title="Basic Details">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <label className="block min-w-0">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Service name<span className="text-red-500">*</span>
                            </span>
                            <input
                              value={editServiceName}
                              onChange={(e) => setEditServiceName(e.target.value)}
                              placeholder="Service name"
                              className={panelFieldClass}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Department<span className="text-red-500">*</span>
                            </span>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                              {editFormDepartment?.name ?? "—"}
                            </div>
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Short description
                          </span>
                          <div className="relative">
                            <textarea
                              value={editServiceDescription}
                              onChange={(e) =>
                                setEditServiceDescription(
                                  e.target.value.slice(0, DESCRIPTION_MAX_LENGTH)
                                )
                              }
                              placeholder="Brief summary of this service"
                              rows={3}
                              maxLength={DESCRIPTION_MAX_LENGTH}
                              className={classNames(
                                panelFieldClass,
                                "resize-none pb-7"
                              )}
                            />
                            <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-slate-400">
                              {editServiceDescription.length}/{DESCRIPTION_MAX_LENGTH}
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
                                value={editServiceDuration}
                                onChange={(e) =>
                                  setEditServiceDuration(parseInt(e.target.value, 10))
                                }
                                className={panelSelectClass}
                              >
                                {DURATION_OPTIONS.map((minutes) => (
                                  <option key={minutes} value={minutes}>
                                    {minutes} mins
                                  </option>
                                ))}
                                {!DURATION_OPTIONS.includes(editServiceDuration) && (
                                  <option value={editServiceDuration}>
                                    {editServiceDuration} mins
                                  </option>
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
                                {currencySign}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editServicePrice}
                                onChange={(e) => setEditServicePrice(e.target.value)}
                                placeholder="0.00"
                                className={classNames(panelFieldClass, "pl-8")}
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
                          {editFormDoctors.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                              No consultants assigned to this department yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {editFormDoctors.map((doctor) => (
                                <div
                                  key={doctor.id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-2.5 py-1.5"
                                >
                                  <ProviderAvatar
                                    name={doctor.name}
                                    initials={doctor.avatar}
                                    avatarUrl={doctor.avatarUrl}
                                    size="sm"
                                  />
                                  <span className="text-sm font-medium text-violet-900">
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
                                setEditAssignMode("all");
                                setEditAssignedDoctorIds(
                                  editFormDoctors.map((d) => d.id)
                                );
                                setShowEditAssignedMenu(false);
                              }}
                              className={classNames(
                                "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                                editAssignMode === "all"
                                  ? "border-violet-500 bg-violet-50 text-violet-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              )}
                            >
                              <span
                                className={classNames(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  editAssignMode === "all"
                                    ? "border-violet-600 bg-violet-600 text-white"
                                    : "border-slate-300"
                                )}
                              >
                                {editAssignMode === "all" && (
                                  <Check className="h-2.5 w-2.5" />
                                )}
                              </span>
                              All department consultants
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditAssignMode("specific");
                                setShowEditAssignedMenu(false);
                              }}
                              className={classNames(
                                "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                                editAssignMode === "specific"
                                  ? "border-violet-500 bg-violet-50 text-violet-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              )}
                            >
                              <span
                                className={classNames(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  editAssignMode === "specific"
                                    ? "border-violet-600 bg-violet-600 text-white"
                                    : "border-slate-300"
                                )}
                              >
                                {editAssignMode === "specific" && (
                                  <Check className="h-2.5 w-2.5" />
                                )}
                              </span>
                              Select specific consultants
                            </button>
                          </div>
                          {editAssignMode === "all" && (
                            <p className="mt-2 text-xs text-slate-500">
                              {editFormDoctors.length === 0
                                ? "No department consultants available to assign."
                                : `All ${editFormDoctors.length} department consultant${editFormDoctors.length === 1 ? "" : "s"} will be assigned to this service.`}
                            </p>
                          )}
                        </div>

                        {editAssignMode === "specific" && (
                          <div className="relative">
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              Assigned consultants<span className="text-red-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setShowEditAssignedMenu((prev) => !prev)
                              }
                              disabled={editFormDoctors.length === 0}
                              className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                {editAssignedDoctorIds.length === 0 ? (
                                  <span className="text-slate-400">Select consultants</span>
                                ) : (
                                  editAssignedDoctorIds.map((id) => {
                                    const doctor = editFormDoctors.find(
                                      (d) => d.id === id
                                    );
                                    if (!doctor) return null;
                                    return (
                                      <span
                                        key={id}
                                        className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800"
                                      >
                                        {doctor.name}
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditAssignedDoctorIds((prev) =>
                                              prev.filter((x) => x !== id)
                                            );
                                          }}
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" ||
                                              e.key === " "
                                            ) {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setEditAssignedDoctorIds((prev) =>
                                                prev.filter((x) => x !== id)
                                              );
                                            }
                                          }}
                                          className="rounded text-violet-500 hover:text-violet-800"
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
                            {showEditAssignedMenu && (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                {editFormDoctors.map((doctor) => {
                                  const checked = editAssignedDoctorIds.includes(
                                    doctor.id
                                  );
                                  return (
                                    <button
                                      key={doctor.id}
                                      type="button"
                                      onClick={() => {
                                        setEditAssignedDoctorIds((prev) =>
                                          prev.includes(doctor.id)
                                            ? prev.filter((id) => id !== doctor.id)
                                            : [...prev, doctor.id]
                                        );
                                      }}
                                      className={classNames(
                                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                                        checked
                                          ? "bg-violet-50 text-violet-800"
                                          : "text-slate-700 hover:bg-slate-50"
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          "flex h-4 w-4 items-center justify-center rounded border",
                                          checked
                                            ? "border-violet-600 bg-violet-600 text-white"
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

                        <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>
                            Consultants are selected once in Department settings. Only department consultants can be assigned here.
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          Only selected consultants will appear on the booking page for this service.
                        </p>
                      </PanelSection>

                      <PanelSection number={4} title="Booking Options" isLast>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700">Visibility</span>
                          <div className="relative min-w-[9.5rem]">
                            <EditVisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              value={editServiceStatus}
                              onChange={(e) =>
                                setEditServiceStatus(
                                  e.target.value as VisibilityStatus
                                )
                              }
                              aria-label="Visibility"
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-violet-400"
                            >
                              {VISIBILITY_OPTIONS.map((option) => (
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
                        onClick={closeServicePanel}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveEditedService}
                        disabled={busyAction || !editServiceName.trim()}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction ? "Saving…" : "Update Service"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <PanelSection number={1} title="Basic Details">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <label className="block min-w-0">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Service name<span className="text-red-500">*</span>
                            </span>
                            <input
                              value={newServiceName}
                              onChange={(e) => setNewServiceName(e.target.value)}
                              placeholder="e.g. Cardiac Screening"
                              className={panelFieldClass}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className="mb-2 block text-sm font-medium text-slate-700">
                              Department<span className="text-red-500">*</span>
                            </span>
                            <div className="relative">
                              <select
                                value={newFormDepartmentId ?? ""}
                                onChange={(e) => {
                                  const nextId =
                                    e.target.value === ""
                                      ? null
                                      : parseInt(e.target.value, 10);
                                  setNewFormDepartmentId(
                                    nextId != null && Number.isFinite(nextId)
                                      ? nextId
                                      : null
                                  );
                                  setNewAssignedDoctorIds([]);
                                  setShowNewAssignedMenu(false);
                                }}
                                className={panelSelectClass}
                              >
                                <option value="" disabled>
                                  Select department
                                </option>
                                {departmentsForList.map((department) => (
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
                          </label>
                        </div>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Short description
                          </span>
                          <div className="relative">
                            <textarea
                              value={newServiceDescription}
                              onChange={(e) =>
                                setNewServiceDescription(
                                  e.target.value.slice(0, DESCRIPTION_MAX_LENGTH)
                                )
                              }
                              placeholder="Brief summary of this service"
                              rows={3}
                              maxLength={DESCRIPTION_MAX_LENGTH}
                              className={classNames(
                                panelFieldClass,
                                "resize-none pb-7"
                              )}
                            />
                            <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-slate-400">
                              {newServiceDescription.length}/{DESCRIPTION_MAX_LENGTH}
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
                                value={newServiceDuration}
                                onChange={(e) =>
                                  setNewServiceDuration(parseInt(e.target.value, 10))
                                }
                                className={panelSelectClass}
                              >
                                {DURATION_OPTIONS.map((minutes) => (
                                  <option key={minutes} value={minutes}>
                                    {minutes} mins
                                  </option>
                                ))}
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
                                {currencySign}
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={newServicePrice}
                                onChange={(e) => setNewServicePrice(e.target.value)}
                                placeholder="0.00"
                                className={classNames(panelFieldClass, "pl-8")}
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
                          {addFormDoctors.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                              No consultants assigned to this department yet.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {addFormDoctors.map((doctor) => (
                                <div
                                  key={doctor.id}
                                  className="inline-flex items-center gap-2 rounded-xl bg-violet-50 px-2.5 py-1.5"
                                >
                                  <ProviderAvatar
                                    name={doctor.name}
                                    initials={doctor.avatar}
                                    avatarUrl={doctor.avatarUrl}
                                    size="sm"
                                  />
                                  <span className="text-sm font-medium text-violet-900">
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
                                setNewAssignMode("all");
                                setNewAssignedDoctorIds(
                                  addFormDoctors.map((d) => d.id)
                                );
                                setShowNewAssignedMenu(false);
                              }}
                              className={classNames(
                                "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                                newAssignMode === "all"
                                  ? "border-violet-500 bg-violet-50 text-violet-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              )}
                            >
                              <span
                                className={classNames(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  newAssignMode === "all"
                                    ? "border-violet-600 bg-violet-600 text-white"
                                    : "border-slate-300"
                                )}
                              >
                                {newAssignMode === "all" && (
                                  <Check className="h-2.5 w-2.5" />
                                )}
                              </span>
                              All department consultants
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setNewAssignMode("specific");
                                setShowNewAssignedMenu(false);
                              }}
                              className={classNames(
                                "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                                newAssignMode === "specific"
                                  ? "border-violet-500 bg-violet-50 text-violet-800"
                                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
                              )}
                            >
                              <span
                                className={classNames(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                                  newAssignMode === "specific"
                                    ? "border-violet-600 bg-violet-600 text-white"
                                    : "border-slate-300"
                                )}
                              >
                                {newAssignMode === "specific" && (
                                  <Check className="h-2.5 w-2.5" />
                                )}
                              </span>
                              Select specific consultants
                            </button>
                          </div>
                          {newAssignMode === "all" && (
                            <p className="mt-2 text-xs text-slate-500">
                              {addFormDoctors.length === 0
                                ? "No department consultants available to assign."
                                : `All ${addFormDoctors.length} department consultant${addFormDoctors.length === 1 ? "" : "s"} will be assigned to this service.`}
                            </p>
                          )}
                        </div>

                        {newAssignMode === "specific" && (
                          <div className="relative">
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                              Assigned consultants<span className="text-red-500">*</span>
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setShowNewAssignedMenu((prev) => !prev)
                              }
                              disabled={addFormDoctors.length === 0}
                              className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                {newAssignedDoctorIds.length === 0 ? (
                                  <span className="text-slate-400">Select consultants</span>
                                ) : (
                                  newAssignedDoctorIds.map((id) => {
                                    const doctor = addFormDoctors.find(
                                      (d) => d.id === id
                                    );
                                    if (!doctor) return null;
                                    return (
                                      <span
                                        key={id}
                                        className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800"
                                      >
                                        {doctor.name}
                                        <span
                                          role="button"
                                          tabIndex={0}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setNewAssignedDoctorIds((prev) =>
                                              prev.filter((x) => x !== id)
                                            );
                                          }}
                                          onKeyDown={(e) => {
                                            if (
                                              e.key === "Enter" ||
                                              e.key === " "
                                            ) {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setNewAssignedDoctorIds((prev) =>
                                                prev.filter((x) => x !== id)
                                              );
                                            }
                                          }}
                                          className="rounded text-violet-500 hover:text-violet-800"
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
                            {showNewAssignedMenu && (
                              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                                {addFormDoctors.map((doctor) => {
                                  const checked = newAssignedDoctorIds.includes(
                                    doctor.id
                                  );
                                  return (
                                    <button
                                      key={doctor.id}
                                      type="button"
                                      onClick={() => {
                                        setNewAssignedDoctorIds((prev) =>
                                          prev.includes(doctor.id)
                                            ? prev.filter((id) => id !== doctor.id)
                                            : [...prev, doctor.id]
                                        );
                                      }}
                                      className={classNames(
                                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm",
                                        checked
                                          ? "bg-violet-50 text-violet-800"
                                          : "text-slate-700 hover:bg-slate-50"
                                      )}
                                    >
                                      <span
                                        className={classNames(
                                          "flex h-4 w-4 items-center justify-center rounded border",
                                          checked
                                            ? "border-violet-600 bg-violet-600 text-white"
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

                        <div className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm text-violet-800">
                          <Info className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>
                          consultants are selected once in Department settings. Only
                            department consultants can be assigned here.
                          </p>
                        </div>
                        <p className="text-xs text-slate-500">
                          Only selected consultants will appear on the booking page for this
                          service.
                        </p>
                      </PanelSection>

                      <PanelSection number={4} title="Booking Options" isLast>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700">Visibility</span>
                          <div className="relative min-w-[9.5rem]">
                            <NewVisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              value={newServiceStatus}
                              onChange={(e) =>
                                setNewServiceStatus(
                                  e.target.value as VisibilityStatus
                                )
                              }
                              aria-label="Visibility"
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-violet-400"
                            >
                              {VISIBILITY_OPTIONS.map((option) => (
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
                        onClick={closeServicePanel}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddService}
                        disabled={
                          busyAction ||
                          !newServiceName.trim() ||
                          newFormDepartmentId == null
                        }
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction ? "Saving…" : "Save Service"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Booking impact modal */}
      {showBookingImpact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-blue-600">Booking impact</p>
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
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse">
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
                        <tr key={service.id} className="odd:bg-white even:bg-slate-50/50">
                          <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                            <p className="text-sm font-semibold text-slate-900">
                              {service.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {service.duration} min • {formatCurrency(service.price, currencySign)}
                            </p>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                serviceStatusBadgeClass(service.status)
                              )}
                            >
                              {serviceStatusLabel(service.status)}
                            </span>
                          </td>
                          <td className="border-b border-slate-100 px-4 py-3.5 align-top">
                            {assigned.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {assigned.map((doctor) => (
                                  <span
                                    key={doctor.id}
                                    className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
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
                          <td className="border-b border-slate-100 px-4 py-3.5 align-top">
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
