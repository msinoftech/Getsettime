"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  LuBoxes as Boxes,
  LuBuilding2 as Building2,
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuFileText as FileText,
  LuFilter as Filter,
  LuGlobe as Globe,
  LuInfo as Info,
  LuLock as Lock,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuPower as Power,
  LuPowerOff as PowerOff,
  LuSearch as Search,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuX as X,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { Pagination, usePagination } from "@app/ui";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { DepartmentSkeleton } from "@/src/components/ui/DepartmentSkeleton";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import { useServiceProviders, useUserDepartments } from "@/src/hooks/useBookingLookups";
import { useAuth } from "@/src/providers/AuthProvider";
import type { ServiceProvider } from "@/src/types/booking-entities";

/** Public=active, Private=private, Draft=draft; inactive kept for legacy rows. */
type DepartmentStatus = "active" | "private" | "draft" | "inactive";
type VisibilityStatus = "active" | "private" | "draft";
type DepartmentFilter = "all" | "active" | "private" | "draft";

const VISIBILITY_OPTIONS: {
  value: VisibilityStatus;
  label: string;
  Icon: IconType;
}[] = [
  { value: "active", label: "Public", Icon: Globe },
  { value: "private", label: "Private", Icon: Lock },
  { value: "draft", label: "Draft", Icon: FileText },
];

function toVisibilityStatus(status: DepartmentStatus): VisibilityStatus {
  if (status === "active") return "active";
  if (status === "draft") return "draft";
  return "private";
}

function departmentStatusLabel(status: DepartmentStatus): string {
  if (status === "active") return "Public";
  if (status === "draft") return "Draft";
  if (status === "private") return "Private";
  return "Inactive";
}

function departmentStatusBadgeClass(status: DepartmentStatus): string {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "draft") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
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
    service_providers?: DepartmentServiceProviderMeta[];
  } | null;
  created_at: string;
}

interface WorkspaceService {
  id: string;
  name: string;
  department_id: number | null;
  status: string | null;
  flag?: boolean;
}

type DoctorRow = {
  id: string;
  name: string;
  role: string;
  inactive: boolean;
  assignedDepartmentIds: number[];
  avatarUrl: string | null;
};

const DELETE_CONFIRM_MESSAGE =
  "Do you want to delete it? If you delete it then you need to again assign doctors. If you just want to hide this department, you can also deactivate it and it will hide from the booking form; you can activate it again anytime in the future.";

const DESCRIPTION_MAX_LENGTH = 150;
const DEPARTMENTS_PAGE_SIZE = 10;

const CARD_GRADIENTS = [
  "from-cyan-500 to-sky-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-blue-500 to-indigo-600",
] as const;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getCardGradient(id: number): string {
  return CARD_GRADIENTS[Math.abs(id) % CARD_GRADIENTS.length];
}

function serviceProviderDisplayName(p: ServiceProvider): string {
  return (
    p.raw_user_meta_data?.full_name ||
    p.raw_user_meta_data?.name ||
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

function resolveProviderAvatarUrl(p: ServiceProvider): string | null {
  const fromField = p.avatar_url?.trim();
  if (fromField) return fromField;
  return null;
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

export default function DepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: serviceProviders, loading: spLoading } = useServiceProviders();
  const { byUser: deptIdsByProvider, refetch: refetchUserDepartments } =
    useUserDepartments();

  const currentUserRole =
    (user?.user_metadata?.role as string | undefined) ?? null;
  const isLoggedInServiceProvider = currentUserRole === "service_provider";
  const currentUserId = user?.id ?? null;

  const showFullDoctorFlow =
    serviceProviders.length > 1 && !isLoggedInServiceProvider;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [workspaceServices, setWorkspaceServices] = useState<WorkspaceService[]>(
    []
  );
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(
    null
  );

  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<DepartmentFilter>("all");
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);

  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");
  const [newAssignedDoctorIds, setNewAssignedDoctorIds] = useState<string[]>([]);
  const [showNewDoctorsMenu, setShowNewDoctorsMenu] = useState(false);
  const [newAssignedServiceIds, setNewAssignedServiceIds] = useState<string[]>([]);
  const [showNewServicesMenu, setShowNewServicesMenu] = useState(false);
  const [newDepartmentStatus, setNewDepartmentStatus] =
    useState<VisibilityStatus>("active");

  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(
    null
  );
  const [editDepartmentName, setEditDepartmentName] = useState("");
  const [editDepartmentDescription, setEditDepartmentDescription] = useState("");
  const [editDepartmentStatus, setEditDepartmentStatus] =
    useState<VisibilityStatus>("active");
  const [editAssignedDoctorIds, setEditAssignedDoctorIds] = useState<string[]>([]);
  const [showEditDoctorsMenu, setShowEditDoctorsMenu] = useState(false);
  const [editAssignedServiceIds, setEditAssignedServiceIds] = useState<string[]>(
    []
  );
  const [showEditServicesMenu, setShowEditServicesMenu] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const doctorAssignmentInFlightRef = useRef<Set<string>>(new Set());

  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const token = await getAuthToken();
      if (!token) return;
      const response = await fetch("/api/services", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();
      const list = Array.isArray(data?.services)
        ? (data.services as WorkspaceService[])
        : [];
      setWorkspaceServices(list.filter((s) => s.flag !== false));
    } catch (error) {
      console.error("Error fetching services:", error);
    }
  }, [getAuthToken]);

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
    fetchServices();
    fetchSuggestions();
  }, [fetchDepartments, fetchServices, fetchSuggestions]);

  useEffect(() => {
    if (!isLoggedInServiceProvider || !currentUserId) return;
    const assigned = deptIdsByProvider.get(currentUserId);
    if (!assigned || assigned.size === 0) return;
    setSelectedDepartmentId((prev) => {
      if (prev !== null && assigned.has(prev)) return prev;
      const firstAssigned = departments.find((d) => assigned.has(d.id));
      return firstAssigned?.id ?? null;
    });
  }, [
    isLoggedInServiceProvider,
    currentUserId,
    deptIdsByProvider,
    departments,
  ]);

  const providerAssignments = useMemo(() => {
    const map = new Map<string, number[]>();
    deptIdsByProvider.forEach((deptSet, userId) => {
      map.set(userId, [...deptSet].sort((a, b) => a - b));
    });
    return map;
  }, [deptIdsByProvider]);

  const doctors = useMemo<DoctorRow[]>(() => {
    return serviceProviders.map((sp) => ({
      id: sp.id,
      name: serviceProviderDisplayName(sp),
      role: "Consultant",
      inactive: sp.deactivated === true,
      assignedDepartmentIds: providerAssignments.get(sp.id) ?? [],
      avatarUrl: resolveProviderAvatarUrl(sp),
    }));
  }, [serviceProviders, providerAssignments]);

  const providerAvatarById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const doctor of doctors) {
      map.set(doctor.id, doctor.avatarUrl);
    }
    return map;
  }, [doctors]);

  const totalAssignments = useMemo(
    () =>
      doctors.reduce(
        (sum, doctor) => sum + doctor.assignedDepartmentIds.length,
        0
      ),
    [doctors]
  );

  const assignedDoctorsCount = useMemo(
    () => doctors.filter((d) => d.assignedDepartmentIds.length > 0).length,
    [doctors]
  );

  const activeDepartmentsCount = useMemo(
    () => departments.filter((d) => d.status === "active").length,
    [departments]
  );

  const privateDepartmentsCount = useMemo(
    () =>
      departments.filter(
        (d) => d.status === "private" || d.status === "inactive"
      ).length,
    [departments]
  );

  const draftDepartmentsCount = useMemo(
    () => departments.filter((d) => d.status === "draft").length,
    [departments]
  );

  const servicesByDepartmentId = useMemo(() => {
    const map = new Map<number, WorkspaceService[]>();
    for (const service of workspaceServices) {
      const deptId = Number(service.department_id);
      if (!Number.isFinite(deptId)) continue;
      const list = map.get(deptId) ?? [];
      list.push(service);
      map.set(deptId, list);
    }
    return map;
  }, [workspaceServices]);

  const totalServicesCount = useMemo(
    () =>
      workspaceServices.filter((s) => s.department_id != null).length,
    [workspaceServices]
  );

  const getDepartmentServices = useCallback(
    (departmentId: number) =>
      (servicesByDepartmentId.get(departmentId) ?? []).filter(
        (s) => s.department_id != null
      ),
    [servicesByDepartmentId]
  );

  const filteredDepartments = useMemo(() => {
    if (departmentFilter === "active") {
      return departments.filter((d) => d.status === "active");
    }
    if (departmentFilter === "draft") {
      return departments.filter((d) => d.status === "draft");
    }
    if (departmentFilter === "private") {
      return departments.filter(
        (d) => d.status === "private" || d.status === "inactive"
      );
    }
    return departments;
  }, [departments, departmentFilter]);

  const effectiveProviderId = useMemo(() => {
    if (isLoggedInServiceProvider && currentUserId) return currentUserId;
    if (serviceProviders.length === 1) return serviceProviders[0]!.id;
    return null;
  }, [isLoggedInServiceProvider, currentUserId, serviceProviders]);

  const assignedDeptIdsForEffectiveProvider = useMemo(() => {
    if (!effectiveProviderId) return new Set<number>();
    return deptIdsByProvider.get(effectiveProviderId) ?? new Set<number>();
  }, [effectiveProviderId, deptIdsByProvider]);

  const assignedDepartmentsForSoleProvider = useMemo(() => {
    if (!effectiveProviderId) return [];
    return departments.filter((d) => {
      if (!assignedDeptIdsForEffectiveProvider.has(d.id)) return false;
      if (departmentFilter === "active") return d.status === "active";
      if (departmentFilter === "draft") return d.status === "draft";
      if (departmentFilter === "private") {
        return d.status === "private" || d.status === "inactive";
      }
      return true;
    });
  }, [
    departments,
    effectiveProviderId,
    departmentFilter,
    assignedDeptIdsForEffectiveProvider,
  ]);

  const suggestionAlreadyExists = useCallback(
    (name: string) =>
      departments.some((d) => d.name.toLowerCase() === name.toLowerCase()),
    [departments]
  );

  const suggestionShowsAsSelected = useCallback(
    (name: string) => {
      if (isLoggedInServiceProvider) {
        const dep = departments.find(
          (d) => d.name.toLowerCase() === name.toLowerCase()
        );
        return (
          dep != null && assignedDeptIdsForEffectiveProvider.has(dep.id)
        );
      }
      return suggestionAlreadyExists(name);
    },
    [
      isLoggedInServiceProvider,
      departments,
      assignedDeptIdsForEffectiveProvider,
      suggestionAlreadyExists,
    ]
  );

  const getDepartmentDoctorCount = useCallback(
    (departmentId: number) => {
      const fromAssignments = doctors.filter((doctor) =>
        doctor.assignedDepartmentIds.includes(departmentId)
      ).length;
      if (
        isLoggedInServiceProvider &&
        assignedDeptIdsForEffectiveProvider.has(departmentId)
      ) {
        return Math.max(fromAssignments, 1);
      }
      return fromAssignments;
    },
    [doctors, isLoggedInServiceProvider, assignedDeptIdsForEffectiveProvider]
  );

  const getDepartmentDoctors = useCallback(
    (departmentId: number) =>
      doctors.filter((doctor) =>
        doctor.assignedDepartmentIds.includes(departmentId)
      ),
    [doctors]
  );

  const departmentsForList = useMemo(() => {
    if (isLoggedInServiceProvider) return assignedDepartmentsForSoleProvider;
    return filteredDepartments;
  }, [
    isLoggedInServiceProvider,
    assignedDepartmentsForSoleProvider,
    filteredDepartments,
  ]);

  const searchedDepartments = useMemo(() => {
    const term = departmentSearch.trim().toLowerCase();
    if (!term) return departmentsForList;
    return departmentsForList.filter((dep) => {
      const nameMatch = dep.name.toLowerCase().includes(term);
      const descMatch = (dep.description ?? "").toLowerCase().includes(term);
      const doctorMatch = getDepartmentDoctors(dep.id).some((d) =>
        d.name.toLowerCase().includes(term)
      );
      return nameMatch || descMatch || doctorMatch;
    });
  }, [departmentsForList, departmentSearch, getDepartmentDoctors]);

  const {
    currentPage: departmentsPage,
    totalPages: departmentsTotalPages,
    totalItems: departmentsTotalItems,
    paginatedItems: paginatedDepartments,
    setCurrentPage: setDepartmentsPage,
    handlePageChange: handleDepartmentsPageChange,
  } = usePagination(searchedDepartments, DEPARTMENTS_PAGE_SIZE);

  useEffect(() => {
    setDepartmentsPage(1);
  }, [departmentSearch, departmentFilter, setDepartmentsPage]);

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

  const linkUserToDepartment = useCallback(
    async (userId: string, departmentId: number) => {
      const flightKey = `assign:${userId}:${departmentId}`;
      if (doctorAssignmentInFlightRef.current.has(flightKey)) return false;
      doctorAssignmentInFlightRef.current.add(flightKey);
      try {
        const token = await getAuthToken();
        if (!token) {
          setAlertMessage("Not authenticated");
          return false;
        }
        const res = await fetch("/api/user-departments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            user_id: userId,
            department_id: departmentId,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setAlertMessage(err?.error || `Request failed (${res.status})`);
          return false;
        }
        return true;
      } finally {
        doctorAssignmentInFlightRef.current.delete(flightKey);
      }
    },
    [getAuthToken]
  );

  const unlinkUserFromDepartment = useCallback(
    async (userId: string, departmentId: number) => {
      const flightKey = `unassign:${userId}:${departmentId}`;
      if (doctorAssignmentInFlightRef.current.has(flightKey)) return false;
      doctorAssignmentInFlightRef.current.add(flightKey);
      try {
        const token = await getAuthToken();
        if (!token) {
          setAlertMessage("Not authenticated");
          return false;
        }
        const res = await fetch(
          `/api/user-departments?user_id=${encodeURIComponent(userId)}&department_id=${departmentId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setAlertMessage(err?.error || `Request failed (${res.status})`);
          return false;
        }
        return true;
      } finally {
        doctorAssignmentInFlightRef.current.delete(flightKey);
      }
    },
    [getAuthToken]
  );

  const syncDepartmentDoctors = useCallback(
    async (departmentId: number, nextDoctorIds: string[]) => {
      const currentIds = doctors
        .filter((d) => d.assignedDepartmentIds.includes(departmentId))
        .map((d) => d.id);
      const nextSet = new Set(nextDoctorIds);
      const currentSet = new Set(currentIds);

      const toAdd = nextDoctorIds.filter((id) => !currentSet.has(id));
      const toRemove = currentIds.filter((id) => !nextSet.has(id));

      for (const userId of toAdd) {
        const ok = await linkUserToDepartment(userId, departmentId);
        if (!ok) return false;
      }
      for (const userId of toRemove) {
        const ok = await unlinkUserFromDepartment(userId, departmentId);
        if (!ok) return false;
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        await refetchUserDepartments();
      }
      return true;
    },
    [doctors, linkUserToDepartment, unlinkUserFromDepartment, refetchUserDepartments]
  );

  const assignSelfToDepartment = useCallback(
    async (departmentId: number) => {
      if (!isLoggedInServiceProvider || !currentUserId) return false;
      if (assignedDeptIdsForEffectiveProvider.has(departmentId)) {
        setSelectedDepartmentId(departmentId);
        return true;
      }

      setBusyAction(true);
      try {
        const ok = await linkUserToDepartment(currentUserId, departmentId);
        if (!ok) return false;
        await refetchUserDepartments();
        setSelectedDepartmentId(departmentId);
        return true;
      } finally {
        setBusyAction(false);
      }
    },
    [
      isLoggedInServiceProvider,
      currentUserId,
      assignedDeptIdsForEffectiveProvider,
      linkUserToDepartment,
      refetchUserDepartments,
    ]
  );

  const syncDepartmentServices = useCallback(
    async (departmentId: number, nextServiceIds: string[]) => {
      const currentIds = workspaceServices
        .filter((s) => Number(s.department_id) === departmentId)
        .map((s) => s.id);
      const nextSet = new Set(nextServiceIds);
      const currentSet = new Set(currentIds);

      const toAssign = nextServiceIds.filter((id) => !currentSet.has(id));
      const toUnassign = currentIds.filter((id) => !nextSet.has(id));

      if (toAssign.length === 0 && toUnassign.length === 0) return true;

      const token = await getAuthToken();
      if (!token) {
        setAlertMessage("Not authenticated");
        return false;
      }

      for (const serviceId of toAssign) {
        const response = await fetch("/api/services", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: serviceId,
            department_id: departmentId,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          setAlertMessage(
            err?.error || `Failed to assign service (${response.status})`
          );
          return false;
        }
      }

      for (const serviceId of toUnassign) {
        const response = await fetch("/api/services", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: serviceId,
            department_id: null,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => null);
          setAlertMessage(
            err?.error || `Failed to unassign service (${response.status})`
          );
          return false;
        }
      }

      await fetchServices();
      return true;
    },
    [workspaceServices, getAuthToken, fetchServices]
  );

  const resetAddForm = () => {
    setDepartmentName("");
    setDepartmentDescription("");
    setNewAssignedDoctorIds([]);
    setShowNewDoctorsMenu(false);
    setNewAssignedServiceIds([]);
    setShowNewServicesMenu(false);
    setNewDepartmentStatus("active");
  };

  const resetEditForm = () => {
    setEditingDepartmentId(null);
    setEditDepartmentName("");
    setEditDepartmentDescription("");
    setEditDepartmentStatus("active");
    setEditAssignedDoctorIds([]);
    setShowEditDoctorsMenu(false);
    setEditAssignedServiceIds([]);
    setShowEditServicesMenu(false);
  };

  const closeDepartmentPanel = () => {
    setShowAddPanel(false);
    setShowEditPanel(false);
    resetAddForm();
    resetEditForm();
  };

  const openAddDepartmentDrawer = () => {
    resetEditForm();
    setShowEditPanel(false);
    resetAddForm();
    setShowAddPanel(true);
  };

  const openEditDepartment = (department: Department) => {
    if (isLoggedInServiceProvider) return;
    resetAddForm();
    setShowAddPanel(false);
    setEditingDepartmentId(department.id);
    setEditDepartmentName(department.name);
    setEditDepartmentDescription(
      (department.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH)
    );
    setEditDepartmentStatus(toVisibilityStatus(department.status));
    setEditAssignedDoctorIds(
      doctors
        .filter((d) => d.assignedDepartmentIds.includes(department.id))
        .map((d) => d.id)
    );
    setEditAssignedServiceIds(
      workspaceServices
        .filter((s) => Number(s.department_id) === department.id)
        .map((s) => s.id)
    );
    setShowEditDoctorsMenu(false);
    setShowEditServicesMenu(false);
    setRowMenuId(null);
    setSelectedDepartmentId(department.id);
    setShowEditPanel(true);
  };

  const createDepartment = useCallback(
    async (
      rawName: string,
      opts?: {
        description?: string;
        doctorIds?: string[];
        serviceIds?: string[];
        status?: VisibilityStatus;
      }
    ): Promise<number | null> => {
      const name = rawName.trim();
      if (!name) return null;

      const existing = departments.find(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );
      if (existing) {
        if (isLoggedInServiceProvider && currentUserId) {
          await assignSelfToDepartment(existing.id);
        } else {
          setSelectedDepartmentId(existing.id);
        }
        return existing.id;
      }

      setBusyAction(true);
      try {
        const linkTarget =
          isLoggedInServiceProvider && currentUserId
            ? { id: currentUserId }
            : serviceProviders.length === 1
              ? serviceProviders[0]
              : undefined;

        const data = (await callApi("POST", {
          name,
          description: opts?.description?.trim() || null,
          status: opts?.status ?? "active",
        })) as {
          department?: Department;
          restored?: boolean;
          reused?: boolean;
        } | null;

        if (!data?.department?.id) return null;

        const deptId = data.department.id;

        if (linkTarget) {
          const alreadyLinked =
            deptIdsByProvider.get(linkTarget.id)?.has(deptId) ?? false;
          if (!alreadyLinked) {
            const ok = await linkUserToDepartment(linkTarget.id, deptId);
            if (!ok) {
              setAlertMessage("Failed to link provider to department");
            }
          }
          await refetchUserDepartments();
        } else if (showFullDoctorFlow && opts?.doctorIds?.length) {
          for (const userId of opts.doctorIds) {
            await linkUserToDepartment(userId, deptId);
          }
          await refetchUserDepartments();
        }

        if (opts?.serviceIds?.length) {
          const servicesOk = await syncDepartmentServices(
            deptId,
            opts.serviceIds
          );
          if (!servicesOk) {
            await fetchDepartments({ selectId: deptId, silent: true });
            return null;
          }
        }

        await fetchDepartments({ selectId: deptId, silent: true });
        return deptId;
      } finally {
        setBusyAction(false);
      }
    },
    [
      callApi,
      departments,
      fetchDepartments,
      serviceProviders,
      deptIdsByProvider,
      refetchUserDepartments,
      linkUserToDepartment,
      isLoggedInServiceProvider,
      currentUserId,
      assignSelfToDepartment,
      showFullDoctorFlow,
      syncDepartmentServices,
    ]
  );

  const handleSuggestionClick = useCallback(
    async (name: string) => {
      if (suggestionShowsAsSelected(name)) return;
      const deptId = await createDepartment(name);
      if (deptId != null && isLoggedInServiceProvider) {
        setShowAddPanel(false);
        setShowEditPanel(false);
        setDepartmentName("");
        setDepartmentDescription("");
        setNewAssignedDoctorIds([]);
        setShowNewDoctorsMenu(false);
        setNewAssignedServiceIds([]);
        setShowNewServicesMenu(false);
      }
    },
    [suggestionShowsAsSelected, createDepartment, isLoggedInServiceProvider]
  );

  const handleSaveNewDepartment = async () => {
    const deptId = await createDepartment(departmentName, {
      description: departmentDescription,
      doctorIds: newAssignedDoctorIds,
      serviceIds: newAssignedServiceIds,
      status: newDepartmentStatus,
    });
    if (deptId != null) closeDepartmentPanel();
  };

  const handleSaveEditedDepartment = async () => {
    if (editingDepartmentId == null) return;
    const trimmedName = editDepartmentName.trim();
    if (!trimmedName) return;

    const duplicate = departments.find(
      (d) =>
        d.id !== editingDepartmentId &&
        d.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      setAlertMessage("Another department with this name already exists.");
      return;
    }

    setBusyAction(true);
    try {
      const data = await callApi("PUT", {
        id: editingDepartmentId,
        name: trimmedName,
        description: editDepartmentDescription.trim() || null,
        status: editDepartmentStatus,
      });

      if (!data?.department) return;

      if (showFullDoctorFlow) {
        const currentIds = doctors
          .filter((d) => d.assignedDepartmentIds.includes(editingDepartmentId))
          .map((d) => d.id);
        const nextIds =
          editDepartmentStatus !== "active"
            ? editAssignedDoctorIds.filter((id) => currentIds.includes(id))
            : editAssignedDoctorIds;
        const ok = await syncDepartmentDoctors(editingDepartmentId, nextIds);
        if (!ok) return;
      }

      const servicesOk = await syncDepartmentServices(
        editingDepartmentId,
        editAssignedServiceIds
      );
      if (!servicesOk) return;

      setDepartments((prev) =>
        prev.map((d) =>
          d.id === editingDepartmentId ? { ...d, ...data.department } : d
        )
      );
      closeDepartmentPanel();
    } finally {
      setBusyAction(false);
    }
  };

  const toggleDepartmentStatus = async (department: Department) => {
    const nextStatus: DepartmentStatus =
      department.status === "inactive" ? "active" : "inactive";

    setBusyAction(true);
    const data = await callApi("PUT", { id: department.id, status: nextStatus });
    setBusyAction(false);

    if (data?.department) {
      setDepartments((prev) =>
        prev.map((d) => (d.id === department.id ? { ...d, ...data.department } : d))
      );
      if (editingDepartmentId === department.id) {
        setEditDepartmentStatus(toVisibilityStatus(nextStatus));
      }
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
      if (editingDepartmentId === removedId) closeDepartmentPanel();
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

  const panelOpen = showAddPanel || showEditPanel;
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
    if (!rowMenuId && !showFilterMenu) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest("[data-portal-actions-menu]") ||
        target.closest("[data-filter-menu]")
      ) {
        return;
      }
      setRowMenuId(null);
      setShowFilterMenu(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [rowMenuId, showFilterMenu]);

  if (initialLoading || spLoading || authLoading) {
    return <DepartmentSkeleton />;
  }

  const panelFieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

  const selectedNewDoctors = doctors.filter((d) =>
    newAssignedDoctorIds.includes(d.id)
  );
  const selectedEditDoctors = doctors.filter((d) =>
    editAssignedDoctorIds.includes(d.id)
  );
  const selectedNewServices = workspaceServices.filter((s) =>
    newAssignedServiceIds.includes(s.id)
  );
  const selectedEditServices = workspaceServices.filter((s) =>
    editAssignedServiceIds.includes(s.id)
  );

  const toggleNewDoctor = (doctorId: string) => {
    setNewAssignedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const toggleEditDoctor = (doctorId: string) => {
    setEditAssignedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const toggleNewService = (serviceId: string) => {
    setNewAssignedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const toggleEditService = (serviceId: string) => {
    setEditAssignedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
  };

  const serviceOptionLabel = (service: WorkspaceService) => {
    const deptId = Number(service.department_id);
    if (
      !Number.isFinite(deptId) ||
      (editingDepartmentId != null && deptId === editingDepartmentId)
    ) {
      return service.name;
    }
    const deptName = departments.find((d) => d.id === deptId)?.name;
    return deptName ? `${service.name} (${deptName})` : service.name;
  };

  const showOrganizationSection = !isLoggedInServiceProvider;
  const editVisibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === editDepartmentStatus) ??
    VISIBILITY_OPTIONS[0];
  const EditVisibilityIcon = editVisibilityOption.Icon;
  const newVisibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === newDepartmentStatus) ??
    VISIBILITY_OPTIONS[0];
  const NewVisibilityIcon = newVisibilityOption.Icon;

  return (
    <>
      <div
        className={classNames(
          "min-h-screen transition-[margin] duration-300 ease-in-out",
          panelAnimatedOpen && "hidden lg:block lg:mr-[28rem]"
        )}
      >
        <div className="mx-auto space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Departments
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {showFullDoctorFlow
                  ? "Manage departments, service groups, provider assignments, and booking visibility for your practice."
                  : "Add and manage department names, visibility, and status. They appear on your booking form when active."}
              </p>
            </div>

            <button
              type="button"
              onClick={openAddDepartmentDrawer}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700"
            >
              <Plus className="h-4 w-4" />
              Add Department
            </button>
          </div>

          <div
            className={classNames(
              "grid gap-3 sm:grid-cols-2",
              showFullDoctorFlow ? "xl:grid-cols-4" : "xl:grid-cols-3"
            )}
          >
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900">
                  {activeDepartmentsCount}
                </p>
                <p className="text-sm text-slate-500">active departments</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Boxes className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900">
                  {totalServicesCount}
                </p>
                <p className="text-sm text-slate-500">linked services</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Users className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-slate-900">
                  {showFullDoctorFlow ? assignedDoctorsCount : doctors.length}
                </p>
                <p className="text-sm text-slate-500">
                  {showFullDoctorFlow ? "assigned doctors" : "doctors"}
                </p>
              </div>
            </div>

            {showFullDoctorFlow && (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Lock className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-slate-900">
                    {privateDepartmentsCount + draftDepartmentsCount}
                  </p>
                  <p className="text-sm text-slate-500">private / draft</p>
                </div>
              </div>
            )}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  All Departments
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {showFullDoctorFlow
                    ? "Organize clinical departments and manage services and doctor assignments."
                    : isLoggedInServiceProvider
                      ? "Your assigned departments."
                      : "Add, edit, activate, deactivate, and delete departments."}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-[200px] flex-1 sm:flex-none sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={departmentSearch}
                    onChange={(e) => setDepartmentSearch(e.target.value)}
                    placeholder="Search departments..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  />
                </div>

                <div className="relative" data-filter-menu>
                  <button
                    type="button"
                    onClick={() => setShowFilterMenu((prev) => !prev)}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Filter className="h-4 w-4" />
                    Filter
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  </button>

                  {showFilterMenu && (
                    <div className="absolute right-0 top-12 z-20 w-44 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                      {(
                        ["all", "active", "private", "draft"] as DepartmentFilter[]
                      ).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => {
                              setDepartmentFilter(status);
                              setShowFilterMenu(false);
                            }}
                            className={classNames(
                              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
                              departmentFilter === status
                                ? "bg-blue-50 text-blue-700"
                                : "text-slate-700 hover:bg-slate-50"
                            )}
                          >
                            <span>
                              {status === "all"
                                ? "All"
                                : status === "active"
                                  ? "Public"
                                  : status === "private"
                                    ? "Private"
                                    : "Draft"}
                            </span>
                            {departmentFilter === status && (
                              <Check className="h-4 w-4" />
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {(
                ["all", "active", "private", "draft"] as DepartmentFilter[]
              ).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setDepartmentFilter(status)}
                    className={classNames(
                      "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                      departmentFilter === status
                        ? "border-violet-500 bg-violet-50 text-violet-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {status === "all"
                      ? "All"
                      : status === "active"
                        ? "Public"
                        : status === "private"
                          ? "Private"
                          : "Draft"}
                  </button>
                )
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Department doctors
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Services
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      {!isLoggedInServiceProvider && (
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDepartments.length === 0 && (
                      <tr>
                        <td
                          colSpan={isLoggedInServiceProvider ? 4 : 5}
                          className="px-4 py-10 text-center"
                        >
                          <p className="text-sm font-medium text-slate-700">
                            {isLoggedInServiceProvider
                              ? "No assigned departments yet"
                              : "No departments found"}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {isLoggedInServiceProvider
                              ? "Choose a department from Quick Suggestions when adding."
                              : departments.length === 0
                                ? "Add your first department to get started."
                                : "Try changing the search or status filter."}
                          </p>
                        </td>
                      </tr>
                    )}

                    {paginatedDepartments.map((dep) => {
                      const assigned = getDepartmentDoctors(dep.id);
                      const services = getDepartmentServices(dep.id);
                      const doctorCount = getDepartmentDoctorCount(dep.id);

                      return (
                        <tr
                          key={dep.id}
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60"
                        >
                          <td className="px-4 py-3.5">
                            <div className="flex items-start gap-3">
                              <div
                                className={classNames(
                                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                                  getCardGradient(dep.id)
                                )}
                              >
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {dep.name}
                                </p>
                                {dep.description ? (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                    {dep.description}
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-xs text-slate-400">
                                    {doctorCount} consultant
                                    {doctorCount !== 1 ? "s" : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            {assigned.length === 0 ? (
                              <span className="text-sm text-slate-400">
                                Unassigned
                              </span>
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
                                  {assigned[0]?.name}
                                  {assigned.length > 1 ? (
                                    <>
                                      <br />
                                      <span className="text-xs text-slate-500">
                                        +{assigned.length - 1} more
                                      </span>
                                    </>
                                  ) : null}
                                </p>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            {services.length === 0 ? (
                              <span className="text-sm text-slate-400">
                                No services
                              </span>
                            ) : (
                              <p className="text-sm text-slate-700">
                                {services.length} service
                                {services.length !== 1 ? "s" : ""}
                              </p>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <span
                              className={classNames(
                                "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                departmentStatusBadgeClass(dep.status)
                              )}
                            >
                              {departmentStatusLabel(dep.status)}
                            </span>
                          </td>

                          {!isLoggedInServiceProvider && (
                            <td className="px-4 py-3.5">
                              <div className="relative flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditDepartment(dep)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <PortalActionsMenu
                                  open={rowMenuId === dep.id}
                                  onToggle={() =>
                                    setRowMenuId((prev) =>
                                      prev === dep.id ? null : dep.id
                                    )
                                  }
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={busyAction}
                                    onClick={() => {
                                      setRowMenuId(null);
                                      void toggleDepartmentStatus(dep);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                  >
                                    {dep.status === "inactive" ? (
                                      <>
                                        <Power className="h-3.5 w-3.5" />
                                        Activate
                                      </>
                                    ) : (
                                      <>
                                        <PowerOff className="h-3.5 w-3.5" />
                                        Inactivate
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    disabled={
                                      busyAction || departments.length === 1
                                    }
                                    onClick={() => {
                                      setRowMenuId(null);
                                      handleDeleteDepartmentClick(dep.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                  </button>
                                </PortalActionsMenu>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 px-4 py-3">
                <Pagination
                  currentPage={departmentsPage}
                  totalPages={departmentsTotalPages}
                  totalItems={departmentsTotalItems}
                  itemsPerPage={DEPARTMENTS_PAGE_SIZE}
                  onPageChange={handleDepartmentsPageChange}
                  loading={busyAction}
                  itemLabel="departments"
                />
              </div>
            </div>
          </section>

          {showFullDoctorFlow && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {totalAssignments}
                  </span>{" "}
                  total doctor-department assignments
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {activeDepartmentsCount}
                  </span>{" "}
                  departments visible on booking
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Lock className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {privateDepartmentsCount}
                  </span>{" "}
                  private department
                  {privateDepartmentsCount !== 1 ? "s" : ""}
                  {draftDepartmentsCount > 0
                    ? `, ${draftDepartmentsCount} draft`
                    : ""}
                </p>
              </div>
            </div>
          )}
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
                {showEditPanel ? "Edit Department" : "Add Department"}
              </h2>
              <button
                type="button"
                onClick={closeDepartmentPanel}
                className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
              {showEditPanel ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <PanelSection number={1} title="Basic Details">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Department name<span className="text-red-500">*</span>
                          </span>
                          <input
                            value={editDepartmentName}
                            onChange={(e) => setEditDepartmentName(e.target.value)}
                            placeholder="e.g. Cardiology"
                            className={panelFieldClass}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">
                            Short description
                          </span>
                          <div className="relative">
                            <textarea
                              value={editDepartmentDescription}
                              onChange={(e) =>
                                setEditDepartmentDescription(
                                  e.target.value.slice(0, DESCRIPTION_MAX_LENGTH)
                                )
                              }
                              placeholder="Brief summary of this department"
                              rows={3}
                              maxLength={DESCRIPTION_MAX_LENGTH}
                              className={classNames(
                                panelFieldClass,
                                "resize-none pb-7"
                              )}
                            />
                            <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-slate-400">
                              {editDepartmentDescription.length}/
                              {DESCRIPTION_MAX_LENGTH}
                            </span>
                          </div>
                        </label>
                      </PanelSection>

                      {showOrganizationSection && (
                        <PanelSection number={2} title="Organization">
                          {showFullDoctorFlow &&
                            editDepartmentStatus !== "active" && (
                            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <p>
                                This department is not public. New doctor
                                assignments are disabled until you set it to
                                Public.
                              </p>
                            </div>
                          )}
                          {showFullDoctorFlow && (
                            <div>
                              <p className="mb-2 text-sm font-medium text-slate-700">
                                Department doctors
                              </p>
                              <p className="mb-2 text-xs text-slate-500">
                                Doctors who belong to this department.
                              </p>
                              {doctors.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                  No doctors available yet.
                                </p>
                              ) : (
                                <>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowEditDoctorsMenu((prev) => !prev)
                                      }
                                      disabled={editDepartmentStatus !== "active"}
                                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      <span>
                                        {selectedEditDoctors.length === 0
                                          ? "Select doctors"
                                          : `${selectedEditDoctors.length} selected`}
                                      </span>
                                      <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </button>
                                    {showEditDoctorsMenu && (
                                      <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                        {doctors.map((doctor) => {
                                          const checked =
                                            editAssignedDoctorIds.includes(
                                              doctor.id
                                            );
                                          return (
                                            <button
                                              key={doctor.id}
                                              type="button"
                                              onClick={() =>
                                                toggleEditDoctor(doctor.id)
                                              }
                                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                                            >
                                              <span
                                                className={classNames(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                  checked
                                                    ? "border-violet-600 bg-violet-600 text-white"
                                                    : "border-slate-300"
                                                )}
                                              >
                                                {checked && (
                                                  <Check className="h-2.5 w-2.5" />
                                                )}
                                              </span>
                                              <ProviderAvatar
                                                name={doctor.name}
                                                initials={providerInitials(
                                                  doctor.name
                                                )}
                                                avatarUrl={doctor.avatarUrl}
                                                size="sm"
                                              />
                                              <span className="min-w-0 truncate text-slate-800">
                                                {doctor.name}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  {selectedEditDoctors.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {selectedEditDoctors.map((doctor) => (
                                        <span
                                          key={doctor.id}
                                          className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                                        >
                                          {doctor.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleEditDoctor(doctor.id)
                                            }
                                            className="rounded-full p-0.5 hover:bg-violet-100"
                                            aria-label={`Remove ${doctor.name}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="mb-2 text-sm font-medium text-slate-700">
                              Services offered
                              <span className="text-red-500">*</span>
                            </p>
                            <p className="mb-2 text-xs text-slate-500">
                              Services available in this department.
                            </p>
                            {workspaceServices.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                No services yet. Create services from the Services
                                screen.
                              </p>
                            ) : (
                              <>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowEditServicesMenu((prev) => !prev)
                                    }
                                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-white"
                                  >
                                    <span>
                                      {selectedEditServices.length === 0
                                        ? "Select services"
                                        : `${selectedEditServices.length} selected`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  </button>
                                  {showEditServicesMenu && (
                                    <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                      {workspaceServices.map((service) => {
                                        const checked =
                                          editAssignedServiceIds.includes(
                                            service.id
                                          );
                                        return (
                                          <button
                                            key={service.id}
                                            type="button"
                                            onClick={() =>
                                              toggleEditService(service.id)
                                            }
                                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                                          >
                                            <span
                                              className={classNames(
                                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                checked
                                                  ? "border-violet-600 bg-violet-600 text-white"
                                                  : "border-slate-300"
                                              )}
                                            >
                                              {checked && (
                                                <Check className="h-2.5 w-2.5" />
                                              )}
                                            </span>
                                            <span className="min-w-0 truncate text-slate-800">
                                              {serviceOptionLabel(service)}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {selectedEditServices.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedEditServices.map((service) => (
                                      <span
                                        key={service.id}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                                      >
                                        {service.name}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleEditService(service.id)
                                          }
                                          className="rounded-full p-0.5 hover:bg-violet-100"
                                          aria-label={`Remove ${service.name}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-800">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p>
                              Services are not automatically assigned to all
                              department doctors. Doctors are assigned to specific
                              services from the Services screen.
                            </p>
                          </div>
                        </PanelSection>
                      )}

                      <PanelSection
                        number={showOrganizationSection ? 3 : 2}
                        title="Visibility"
                        isLast
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700">Visibility</span>
                          <div className="relative min-w-[9.5rem]">
                            <EditVisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              value={editDepartmentStatus}
                              onChange={(e) =>
                                setEditDepartmentStatus(
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
                        <p className="text-xs text-slate-500">
                          Only Public departments appear on the booking form.
                        </p>
                      </PanelSection>
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeDepartmentPanel}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEditedDepartment()}
                        disabled={busyAction || !editDepartmentName.trim()}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction ? "Saving…" : "Save Department"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex-1 overflow-y-auto px-5 py-5">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <PanelSection
                        number={1}
                        title="Basic Details"
                        isLast={isLoggedInServiceProvider}
                      >
                        {!isLoggedInServiceProvider && (
                          <>
                            <label className="block">
                              <span className="mb-2 block text-sm font-medium text-slate-700">
                                Department name
                                <span className="text-red-500">*</span>
                              </span>
                              <input
                                value={departmentName}
                                onChange={(e) => setDepartmentName(e.target.value)}
                                placeholder="e.g. Cardiology"
                                className={panelFieldClass}
                              />
                            </label>
                            <label className="block">
                              <span className="mb-2 block text-sm font-medium text-slate-700">
                                Short description
                              </span>
                              <div className="relative">
                                <textarea
                                  value={departmentDescription}
                                  onChange={(e) =>
                                    setDepartmentDescription(
                                      e.target.value.slice(0, DESCRIPTION_MAX_LENGTH)
                                    )
                                  }
                                  placeholder="Brief summary of this department"
                                  rows={3}
                                  maxLength={DESCRIPTION_MAX_LENGTH}
                                  className={classNames(
                                    panelFieldClass,
                                    "resize-none pb-7"
                                  )}
                                />
                                <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs text-slate-400">
                                  {departmentDescription.length}/
                                  {DESCRIPTION_MAX_LENGTH}
                                </span>
                              </div>
                            </label>
                          </>
                        )}

                        {suggestions.length > 0 && (
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Quick Suggestions
                            </p>
                            <p className="mb-2 text-xs text-slate-500">
                              {isLoggedInServiceProvider
                                ? "Select a department to assign it to yourself."
                                : "Click a suggestion to fill the department name."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((item) => {
                                const selected = suggestionShowsAsSelected(item);
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => {
                                      if (selected) return;
                                      if (isLoggedInServiceProvider) {
                                        void handleSuggestionClick(item);
                                        return;
                                      }
                                      setDepartmentName(item);
                                    }}
                                    disabled={busyAction || selected}
                                    className={classNames(
                                      "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                                      selected
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : departmentName === item
                                          ? "border border-violet-300 bg-violet-50 text-violet-700"
                                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                    )}
                                  >
                                    {selected ? "✓" : "+"} {item}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {isLoggedInServiceProvider && suggestions.length === 0 && (
                          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                            No department suggestions available for your profession
                            yet.
                          </p>
                        )}
                      </PanelSection>

                      {showOrganizationSection && (
                        <PanelSection number={2} title="Organization">
                          {showFullDoctorFlow && (
                            <div>
                              <p className="mb-2 text-sm font-medium text-slate-700">
                                Department doctors
                              </p>
                              <p className="mb-2 text-xs text-slate-500">
                                Doctors who belong to this department.
                              </p>
                              {doctors.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                  No doctors available yet.
                                </p>
                              ) : (
                                <>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowNewDoctorsMenu((prev) => !prev)
                                      }
                                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-white"
                                    >
                                      <span>
                                        {selectedNewDoctors.length === 0
                                          ? "Select doctors"
                                          : `${selectedNewDoctors.length} selected`}
                                      </span>
                                      <ChevronDown className="h-4 w-4 text-slate-400" />
                                    </button>
                                    {showNewDoctorsMenu && (
                                      <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                        {doctors.map((doctor) => {
                                          const checked =
                                            newAssignedDoctorIds.includes(
                                              doctor.id
                                            );
                                          return (
                                            <button
                                              key={doctor.id}
                                              type="button"
                                              onClick={() =>
                                                toggleNewDoctor(doctor.id)
                                              }
                                              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                                            >
                                              <span
                                                className={classNames(
                                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                  checked
                                                    ? "border-violet-600 bg-violet-600 text-white"
                                                    : "border-slate-300"
                                                )}
                                              >
                                                {checked && (
                                                  <Check className="h-2.5 w-2.5" />
                                                )}
                                              </span>
                                              <ProviderAvatar
                                                name={doctor.name}
                                                initials={providerInitials(
                                                  doctor.name
                                                )}
                                                avatarUrl={doctor.avatarUrl}
                                                size="sm"
                                              />
                                              <span className="min-w-0 truncate text-slate-800">
                                                {doctor.name}
                                              </span>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  {selectedNewDoctors.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      {selectedNewDoctors.map((doctor) => (
                                        <span
                                          key={doctor.id}
                                          className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                                        >
                                          {doctor.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleNewDoctor(doctor.id)
                                            }
                                            className="rounded-full p-0.5 hover:bg-violet-100"
                                            aria-label={`Remove ${doctor.name}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="mb-2 text-sm font-medium text-slate-700">
                              Services offered
                              <span className="text-red-500">*</span>
                            </p>
                            <p className="mb-2 text-xs text-slate-500">
                              Services available in this department.
                            </p>
                            {workspaceServices.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                No services yet. Create services from the Services
                                screen.
                              </p>
                            ) : (
                              <>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowNewServicesMenu((prev) => !prev)
                                    }
                                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-white"
                                  >
                                    <span>
                                      {selectedNewServices.length === 0
                                        ? "Select services"
                                        : `${selectedNewServices.length} selected`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 text-slate-400" />
                                  </button>
                                  {showNewServicesMenu && (
                                    <div className="absolute left-0 right-0 top-12 z-20 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                      {workspaceServices.map((service) => {
                                        const checked =
                                          newAssignedServiceIds.includes(
                                            service.id
                                          );
                                        return (
                                          <button
                                            key={service.id}
                                            type="button"
                                            onClick={() =>
                                              toggleNewService(service.id)
                                            }
                                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50"
                                          >
                                            <span
                                              className={classNames(
                                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                checked
                                                  ? "border-violet-600 bg-violet-600 text-white"
                                                  : "border-slate-300"
                                              )}
                                            >
                                              {checked && (
                                                <Check className="h-2.5 w-2.5" />
                                              )}
                                            </span>
                                            <span className="min-w-0 truncate text-slate-800">
                                              {serviceOptionLabel(service)}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                {selectedNewServices.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {selectedNewServices.map((service) => (
                                      <span
                                        key={service.id}
                                        className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                                      >
                                        {service.name}
                                        <button
                                          type="button"
                                          onClick={() =>
                                            toggleNewService(service.id)
                                          }
                                          className="rounded-full p-0.5 hover:bg-violet-100"
                                          aria-label={`Remove ${service.name}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-800">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <p>
                              Services are not automatically assigned to all
                              department doctors. Doctors are assigned to specific
                              services from the Services screen.
                            </p>
                          </div>
                        </PanelSection>
                      )}

                      {!isLoggedInServiceProvider && (
                        <PanelSection
                          number={showOrganizationSection ? 3 : 2}
                          title="Visibility"
                          isLast
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm text-slate-700">
                              Visibility
                            </span>
                            <div className="relative min-w-[9.5rem]">
                              <NewVisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                              <select
                                value={newDepartmentStatus}
                                onChange={(e) =>
                                  setNewDepartmentStatus(
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
                          <p className="text-xs text-slate-500">
                            Only Public departments appear on the booking form.
                          </p>
                        </PanelSection>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeDepartmentPanel}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {isLoggedInServiceProvider ? "Close" : "Cancel"}
                      </button>
                      {!isLoggedInServiceProvider && (
                        <button
                          type="button"
                          onClick={() => void handleSaveNewDepartment()}
                          disabled={busyAction || !departmentName.trim()}
                          className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyAction ? "Saving…" : "Save Department"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </aside>

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
    </>
  );
}
