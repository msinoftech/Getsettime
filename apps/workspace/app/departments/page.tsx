"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LuBoxes as Boxes,
  LuBuilding2 as Building2,
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuFileText as FileText,
  LuGlobe as Globe,
  LuInfo as Info,
  LuLock as Lock,
  LuPencil as Pencil,
  LuPlus as Plus,
  LuPower as Power,
  LuPowerOff as PowerOff,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuX as X,
} from "react-icons/lu";
import { FaUserDoctor } from "react-icons/fa6";
import type { IconType } from "react-icons";
import { Pagination, usePagination } from "@app/ui";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/src/components/ui/toast";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import {
  DepartmentPaginationSkeleton,
  DepartmentTableRowsSkeleton,
  StatValueSkeleton,
} from "@/src/components/ui/DepartmentSkeleton";
import { PortalActionsMenu } from "@/src/components/ui/PortalActionsMenu";
import { AddDepartmentPanel } from "@/src/features/departments/AddDepartmentPanel";
import {
  DepartmentFilters,
  type department_status_filter,
} from "@/src/features/departments/DepartmentFilters";
import {
  DEFAULT_DEPARTMENT_COLOR,
  get_department_gradient,
  parse_department_color,
  type department_color_id,
} from "@/src/features/departments/department_colors";
import {
  classNames,
  DepartmentColorPicker,
  PanelSection,
} from "@/src/features/departments/DepartmentPanelPrimitives";
import { WorkspaceUserAvatar } from "@/src/components/User/WorkspaceUserAvatar";
import { useServiceProviders, useUserDepartments } from "@/src/hooks/useBookingLookups";
import { useAuth } from "@/src/providers/AuthProvider";
import type { ServiceProvider } from "@/src/types/booking-entities";
import ScreenGate from "@/src/components/ScreenGate";


/** Public=active, Private=private, Draft=draft; inactive kept for legacy rows. */
type DepartmentStatus = "active" | "private" | "draft" | "inactive";
type VisibilityStatus = "active" | "private" | "draft";
type DepartmentFilter = department_status_filter;

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
    service_providers?: DepartmentServiceProviderMeta[];
    color?: string | null;
    services?: unknown[];
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
};

const DELETE_CONFIRM_MESSAGE =
  "Do you want to delete it? If you delete it then you need to again assign consultants. If you just want to hide this department, you can also deactivate it and it will hide from the booking form; you can activate it again anytime in the future.";

const DESCRIPTION_MAX_LENGTH = 150;
const DEPARTMENTS_PAGE_SIZE = 10;

function serviceProviderDisplayName(p: ServiceProvider): string {
  return (
    p.raw_user_meta_data?.full_name ||
    p.raw_user_meta_data?.name ||
    p.email ||
    "Unknown"
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
  const isStaffUser = currentUserRole === "staff";
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
  const [serviceFilter, setServiceFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);

  const [editingDepartmentId, setEditingDepartmentId] = useState<number | null>(
    null
  );
  const [editDepartmentName, setEditDepartmentName] = useState("");
  const [editDepartmentDescription, setEditDepartmentDescription] = useState("");
  const [editDepartmentStatus, setEditDepartmentStatus] =
    useState<VisibilityStatus>("active");
  const [editDepartmentColor, setEditDepartmentColor] =
    useState<department_color_id>(DEFAULT_DEPARTMENT_COLOR);
  const [editAssignedDoctorIds, setEditAssignedDoctorIds] = useState<string[]>([]);
  const [showEditDoctorsMenu, setShowEditDoctorsMenu] = useState(false);
  const [editAssignedServiceIds, setEditAssignedServiceIds] = useState<string[]>(
    []
  );
  const [showEditServicesMenu, setShowEditServicesMenu] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const doctorAssignmentInFlightRef = useRef<Set<string>>(new Set());

  const getAuthToken = useCallback(async () => {
    const { session } = await getWorkspaceSession();
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

  useEffect(() => {
    fetchDepartments();
    fetchServices();
  }, [fetchDepartments, fetchServices]);

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
    }));
  }, [serviceProviders, providerAssignments]);

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
    return departmentsForList.filter((dep) => {
      const matchesSearch =
        term === "" ||
        dep.name.toLowerCase().includes(term) ||
        (dep.description ?? "").toLowerCase().includes(term) ||
        getDepartmentDoctors(dep.id).some((d) =>
          d.name.toLowerCase().includes(term)
        );
      const matchesService =
        serviceFilter === "" ||
        getDepartmentServices(dep.id).some((s) => s.id === serviceFilter);
      const matchesDoctor =
        doctorFilter === "" ||
        getDepartmentDoctors(dep.id).some((d) => d.id === doctorFilter);
      return matchesSearch && matchesService && matchesDoctor;
    });
  }, [
    departmentsForList,
    departmentSearch,
    serviceFilter,
    doctorFilter,
    getDepartmentDoctors,
    getDepartmentServices,
  ]);

  const filterServiceOptions = useMemo(
    () =>
      [...workspaceServices]
        .map((service) => ({ id: service.id, label: service.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [workspaceServices]
  );

  const filterDoctorOptions = useMemo(
    () =>
      [...doctors]
        .map((doctor) => ({ id: doctor.id, label: doctor.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [doctors]
  );

  const showServiceFilter = filterServiceOptions.length > 0;
  const showDoctorFilter =
    !isLoggedInServiceProvider && filterDoctorOptions.length > 0;

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
  }, [
    departmentSearch,
    departmentFilter,
    serviceFilter,
    doctorFilter,
    setDepartmentsPage,
  ]);

  const callApi = useCallback(
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
        toast.error(err?.error || `Request failed (${response.status})`);
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
          toast.error("Not authenticated");
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
          toast.error(err?.error || `Request failed (${res.status})`);
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
          toast.error("Not authenticated");
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
          toast.error(err?.error || `Request failed (${res.status})`);
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
        toast.error("Not authenticated");
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
          toast.error(
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
          toast.error(
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

  const resetEditForm = () => {
    setEditingDepartmentId(null);
    setEditDepartmentName("");
    setEditDepartmentDescription("");
    setEditDepartmentStatus("active");
    setEditDepartmentColor(DEFAULT_DEPARTMENT_COLOR);
    setEditAssignedDoctorIds([]);
    setShowEditDoctorsMenu(false);
    setEditAssignedServiceIds([]);
    setShowEditServicesMenu(false);
  };

  const closeEditDepartmentPanel = () => {
    setShowEditPanel(false);
    resetEditForm();
  };

  const openAddDepartmentDrawer = () => {
    if (isStaffUser) return;
    closeEditDepartmentPanel();
    setShowAddPanel(true);
  };

  const handleAddDepartmentCreated = useCallback(
    async (created: { id: number; name: string }) => {
      await Promise.all([
        fetchDepartments({ selectId: created.id, silent: true }),
        fetchServices(),
        refetchUserDepartments(),
      ]);
      setShowAddPanel(false);
    },
    [fetchDepartments, fetchServices, refetchUserDepartments]
  );

  const openEditDepartment = (department: Department) => {
    if (isLoggedInServiceProvider || isStaffUser) return;
    setShowAddPanel(false);
    setEditingDepartmentId(department.id);
    setEditDepartmentName(department.name);
    setEditDepartmentDescription(
      (department.description ?? "").slice(0, DESCRIPTION_MAX_LENGTH)
    );
    setEditDepartmentStatus(toVisibilityStatus(department.status));
    setEditDepartmentColor(
      parse_department_color(department.meta_data?.color) ??
        DEFAULT_DEPARTMENT_COLOR
    );
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

  const handleSaveEditedDepartment = async () => {
    if (editingDepartmentId == null) return;
    const trimmedName = editDepartmentName.trim();
    if (!trimmedName) {
      toast.error("Department name is required.");
      return;
    }

    const duplicate = departments.find(
      (d) =>
        d.id !== editingDepartmentId &&
        d.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      toast.error("Another department with this name already exists.");
      return;
    }

    setBusyAction(true);
    try {
      const data = await callApi("PUT", {
        id: editingDepartmentId,
        name: trimmedName,
        description: editDepartmentDescription.trim() || null,
        status: editDepartmentStatus,
        meta_data: {
          color: editDepartmentColor,
        },
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
      toast.success("Department updated successfully.");
      closeEditDepartmentPanel();
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
      toast.success(
        nextStatus === "active"
          ? "Department activated successfully."
          : "Department deactivated successfully."
      );
    }
  };

  const handleDeleteDepartmentClick = (id: number) => setDeleteConfirmId(id);

  const handleDeleteDepartmentConfirm = async () => {
    if (!deleteConfirmId) return;

    if (departments.length <= 1) {
      setDeleteConfirmId(null);
      toast.error("You must keep at least one department.");
      return;
    }

    const deletedDepartment = departments.find((d) => d.id === deleteConfirmId);

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
      toast.success(
        deletedDepartment
          ? `"${deletedDepartment.name}" deleted successfully.`
          : "Department deleted successfully."
      );
      if (editingDepartmentId === removedId) closeEditDepartmentPanel();
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

  const editPanelOpen = showEditPanel;
  const editPanelVisible = editPanelOpen || panelAnimatedOpen;
  const layoutPanelOpen = showAddPanel || showEditPanel;

  useEffect(() => {
    if (!editPanelOpen) {
      setPanelAnimatedOpen(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelAnimatedOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [editPanelOpen]);

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

  const isPageLoading = initialLoading || spLoading || authLoading;
  const showRowActions = !isLoggedInServiceProvider && !isStaffUser;

  const panelFieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

  const selectedEditDoctors = doctors.filter((d) =>
    editAssignedDoctorIds.includes(d.id)
  );
  const selectedEditServices = workspaceServices.filter((s) =>
    editAssignedServiceIds.includes(s.id)
  );

  const toggleEditDoctor = (doctorId: string) => {
    setEditAssignedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
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

  return (
    <>
      <div className={classNames( "transition-[margin] duration-300 ease-in-out" )}>
        <div className="mx-auto space-y-5">
          <div className="flex gap-4 flex-row flex-wrap items-start sm:justify-between">
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

            {!isStaffUser ? (
              <button
                type="button"
                onClick={openAddDepartmentDrawer}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <Plus className="h-4 w-4" />
                Add Department
              </button>
            ) : null}
          </div>

          <ScreenGate minWidth={768}> 
            <div className={classNames( "grid gap-3 sm:grid-cols-4", showFullDoctorFlow ? "xl:grid-cols-4" : "xl:grid-cols-3" )}>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
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

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Boxes className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-slate-500">Linked services</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isPageLoading ? <StatValueSkeleton /> : totalServicesCount}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-slate-500">
                    {showFullDoctorFlow ? "Assigned consultants" : "Consultants"}
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {isPageLoading ? (
                      <StatValueSkeleton />
                    ) : showFullDoctorFlow ? (
                      assignedDoctorsCount
                    ) : (
                      doctors.length
                    )}
                  </p>
                </div>
              </div>

              {showFullDoctorFlow && (
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <Lock className="h-4 w-4 md:h-5 md:w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug text-slate-500">private / draft</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {isPageLoading ? (
                        <StatValueSkeleton />
                      ) : (
                        privateDepartmentsCount + draftDepartmentsCount
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScreenGate>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <DepartmentFilters
                leading={
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      All Departments
                    </h2>
                    <p className="text-sm text-slate-500">
                      {showFullDoctorFlow
                        ? "Organize clinical departments and manage services and consultant assignments."
                        : isLoggedInServiceProvider
                          ? "Your assigned departments."
                          : "Add, edit, activate, deactivate, and delete departments."}
                    </p>
                  </div>
                }
                search={departmentSearch}
                status_filter={departmentFilter}
                service_filter={serviceFilter}
                doctor_filter={doctorFilter}
                service_options={filterServiceOptions}
                doctor_options={filterDoctorOptions}
                show_service_filter={showServiceFilter}
                show_doctor_filter={showDoctorFilter}
                result_count={searchedDepartments.length}
                on_search_change={setDepartmentSearch}
                on_status_filter_change={setDepartmentFilter}
                on_service_filter_change={setServiceFilter}
                on_doctor_filter_change={setDoctorFilter}
              />
            </div>

            <div className="rounded-xl">
              
              {/* Mobile View */}
              <ScreenGate maxWidth={1023}> 
                <div className="w-full">

                  <div className="space-y-2 md:pt-2">
                    {isPageLoading ? (
                      <DepartmentTableRowsSkeleton showActions={showRowActions} />
                    ) : (
                      <>
                        {/* Empty State */}
                        {paginatedDepartments.length === 0 && (
                          <div
                            className="
                              rounded-xl
                              border border-slate-200
                              bg-white
                              px-4 py-10
                              text-center
                            "
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
                          </div>
                        )}

                        {/* Department Cards */}
                        {paginatedDepartments.map((dep) => {
                          const assigned = getDepartmentDoctors(dep.id);
                          const services = getDepartmentServices(dep.id);
                          const doctorCount = getDepartmentDoctorCount(dep.id);

                          return (
                            <div key={dep.id} className="group">
                              <div className="relative flex w-full items-start md:items-center justify-between rounded-xl border border-slate-200  px-4 py-3.5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-sm">
                                <div className="flex items-start flex-col sm:items-center gap-3 pr-4">
                                  <div className="flex gap-2">
                                    {/* Icon */}
                                    <div
                                      className={classNames(
                                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                                        get_department_gradient(dep)
                                      )}
                                    >
                                      <FaUserDoctor className="h-5 w-5" />
                                    </div>

                                    {/* Content */}
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {dep.name}
                                      </p>

                                      {dep.description ? (
                                        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                                          {dep.description}
                                        </p>
                                      ) : (
                                        // <p className="mt-0.5 text-xs text-slate-400">
                                        //   {doctorCount} consultant
                                        //   {doctorCount !== 1 ? "s" : ""}
                                        // </p>
                                        <div className="flex shrink-0 flex-col justify-center">
                                          {services.length === 0 ? (
                                            <p className="mt-0.5 text-sm text-slate-400">
                                              No services
                                            </p>
                                          ) : (
                                            <p className="mt-0.5 text-sm text-slate-400">
                                              {services.length} service
                                              {services.length !== 1 ? "s" : ""}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <ScreenGate maxWidth={639}>
                                    {/* Assigned mobile */}
                                    <div className="flex shrink-0 items-center gap-3">
                                      {assigned.length === 0 ? (
                                        <span className="text-sm text-slate-400">
                                          Unassigned
                                        </span>
                                      ) : (
                                        <>
                                          <div className="flex shrink-0 items-center">
                                            {assigned.slice(0, 3).map((doctor, index) => (
                                              <div
                                                key={doctor.id}
                                                className={classNames(
                                                  "relative rounded-full ring-2 ring-white",
                                                  index > 0 && "-ml-2"
                                                )}
                                                style={{
                                                  zIndex: assigned.length - index,
                                                }}
                                              >
                                                <WorkspaceUserAvatar
                                                  name={doctor.name}
                                                  userId={doctor.id}
                                                  size="sm"
                                                />
                                              </div>
                                            ))}

                                            {assigned.length > 3 && (
                                              <span
                                                className="
                                                  relative -ml-2
                                                  flex h-7 w-7
                                                  items-center justify-center
                                                  rounded-full
                                                  bg-slate-100
                                                  text-sm font-semibold
                                                  text-slate-600
                                                  ring-2 ring-white
                                                "
                                              >
                                                +{assigned.length - 3}
                                              </span>
                                            )}
                                          </div>

                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-slate-700">
                                              {assigned[0]?.name}
                                            </p>

                                            {assigned.length > 1 && (
                                              <p className="text-sm text-slate-400">
                                                +{assigned.length - 1} more
                                              </p>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </ScreenGate>
                                </div>
                                
                                <ScreenGate minWidth={640}>
                                  {/* Assigned */}
                                  <div className="flex shrink-0 items-center gap-3 px-4">
                                    {assigned.length === 0 ? (
                                      <span className="text-sm text-slate-400">
                                        Unassigned
                                      </span>
                                    ) : (
                                      <>
                                        <div className="flex shrink-0 items-center">
                                          {assigned.slice(0, 3).map((doctor, index) => (
                                            <div
                                              key={doctor.id}
                                              className={classNames(
                                                "relative rounded-full ring-2 ring-white",
                                                index > 0 && "-ml-2"
                                              )}
                                              style={{
                                                zIndex: assigned.length - index,
                                              }}
                                            >
                                              <WorkspaceUserAvatar
                                                name={doctor.name}
                                                userId={doctor.id}
                                                size="sm"
                                              />
                                            </div>
                                          ))}

                                          {assigned.length > 3 && (
                                            <span
                                              className="
                                                relative -ml-2
                                                flex h-7 w-7
                                                items-center justify-center
                                                rounded-full
                                                bg-slate-100
                                                text-sm font-semibold
                                                text-slate-600
                                                ring-2 ring-white
                                              "
                                            >
                                              +{assigned.length - 3}
                                            </span>
                                          )}
                                        </div>

                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-medium text-slate-700">
                                            {assigned[0]?.name}
                                          </p>

                                          {assigned.length > 1 && (
                                            <p className="text-sm text-slate-400">
                                              +{assigned.length - 1} more
                                            </p>
                                          )}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </ScreenGate>

                                {/* ACTION */}
                                {showRowActions && (
                                  <div className="flex shrink-0 flex-col items-end justify-end gap-2">
                                    {/* STATUS */}
                                    <div className="">
                                      <span
                                        className={classNames(
                                          "inline-flex rounded-full px-3 py-1 text-xs font-medium",
                                          departmentStatusBadgeClass(dep.status)
                                        )}
                                      >
                                        {departmentStatusLabel(dep.status)}
                                      </span>
                                    </div>

                                    <div className="flex gap-2">
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
                                          onClick={() => openEditDepartment(dep)}
                                          className="
                                            flex w-full items-center gap-2
                                            rounded-lg px-3 py-2
                                            text-sm text-indigo-600
                                            hover:bg-indigo-50
                                            disabled:opacity-60
                                          "
                                        >
                                          <Pencil className="h-3.5 w-3.5" />

                                          <span className="">
                                            Edit
                                          </span>
                                        </button>

                                        <button
                                          type="button"
                                          role="menuitem"
                                          disabled={busyAction}
                                          onClick={() => {
                                            setRowMenuId(null);
                                            void toggleDepartmentStatus(dep);
                                          }}
                                          className="
                                            flex w-full items-center gap-2
                                            rounded-lg px-3 py-2
                                            text-sm text-slate-700
                                            hover:bg-slate-50
                                            disabled:opacity-60
                                          "
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
                                          className="
                                            flex w-full items-center gap-2
                                            rounded-lg px-3 py-2
                                            text-sm text-red-600
                                            hover:bg-red-50
                                            disabled:opacity-60
                                          "
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Delete
                                        </button>
                                      </PortalActionsMenu>
                                    </div>

                                  </div>
                                )}

                              </div>

                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </ScreenGate>
              
              {/* Desktop View */}
              <ScreenGate minWidth={1024}> 
                <div className="overflow-hidden overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-100">
                      <tr className="text-left text-sm text-slate-900">
                        <th className="px-6 py-4 font-semibold">
                          Department
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Department consultants
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Services
                        </th>
                        <th className="px-6 py-4 font-semibold">
                          Status
                        </th>
                        {showRowActions && (
                          <th className="px-6 py-4 text-right font-semibold">
                            Action
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {isPageLoading ? (
                        <DepartmentTableRowsSkeleton showActions={showRowActions} />
                      ) : (
                        <>
                          {paginatedDepartments.length === 0 && (
                            <tr>
                              <td
                                colSpan={showRowActions ? 5 : 4}
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
                                className="cursor-pointer transition hover:bg-slate-50 border border-slate-100 last:border-b-0  border-b border-slate-100"
                              >
                                <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Department">
                                  <div className="flex max-[1301px]:justify-end gap-2.5">
                                    <div
                                      className={classNames(
                                        "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
                                        get_department_gradient(dep)
                                      )}
                                    >
                                      <FaUserDoctor className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {dep.name}
                                      </p>
                                      {dep.description ? (
                                        <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                                          {dep.description}
                                        </p>
                                      ) : (
                                        <p className="mt-0.5 text-sm text-slate-400">
                                          {doctorCount} consultant
                                          {doctorCount !== 1 ? "s" : ""}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Provider">
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
                                        {assigned[0]?.name}
                                        {assigned.length > 1 ? (
                                          <>
                                            <br />
                                            <span className="text-slate-500">
                                              +{assigned.length - 1} more
                                            </span>
                                          </>
                                        ) : null}
                                      </p>
                                    </div>
                                  )}
                                </td>

                                <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Services">
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

                                <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Status">
                                  <span
                                    className={classNames(
                                      "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
                                      departmentStatusBadgeClass(dep.status)
                                    )}
                                  >
                                    {departmentStatusLabel(dep.status)}
                                  </span>
                                </td>

                                {showRowActions && (
                                  <td className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium align-middle border-b border-slate-100" data-label="Action">
                                    <div className="flex items-center justify-end gap-2">
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
                                          onClick={() => openEditDepartment(dep)}
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
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </ScreenGate>


              <div className="mt-3">
                {isPageLoading ? (
                  <DepartmentPaginationSkeleton />
                ) : (
                  <Pagination
                    currentPage={departmentsPage}
                    totalPages={departmentsTotalPages}
                    totalItems={departmentsTotalItems}
                    itemsPerPage={DEPARTMENTS_PAGE_SIZE}
                    onPageChange={handleDepartmentsPageChange}
                    loading={busyAction}
                    itemLabel="departments"
                  />
                )}
              </div>
            </div>
          </section>

          <ScreenGate minWidth={1024}>
          {showFullDoctorFlow && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Users className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {isPageLoading ? (
                      <StatValueSkeleton className="inline-block h-4 w-8 align-middle" />
                    ) : (
                      totalAssignments
                    )}
                  </span>{" "}
                  total consultant-department assignments
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <p className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {isPageLoading ? (
                      <StatValueSkeleton className="inline-block h-4 w-8 align-middle" />
                    ) : (
                      activeDepartmentsCount
                    )}
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
                    {isPageLoading ? (
                      <StatValueSkeleton className="inline-block h-4 w-8 align-middle" />
                    ) : (
                      privateDepartmentsCount
                    )}
                  </span>{" "}
                  private department
                  {isPageLoading
                    ? "s"
                    : privateDepartmentsCount !== 1
                      ? "s"
                      : ""}
                  {!isPageLoading && draftDepartmentsCount > 0
                    ? `, ${draftDepartmentsCount} draft`
                    : ""}
                </p>
              </div>
            </div>
          )}
          </ScreenGate>

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
        aria-hidden={!editPanelVisible}
      >
        <button
            type="button"
            aria-label="Close exception panel"
            onClick={closeEditDepartmentPanel}
            className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
          />
        {editPanelVisible && (
          <>
            <div className="relative ml-auto flex w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl pb-[60px] lg:pb-0">
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Edit Department
                </h2>
                <button
                  type="button"
                  onClick={closeEditDepartmentPanel}
                  className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
                <div className="flex h-full min-h-0 flex-col pb-[60px] lg:pb-0">
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
                                This department is not public. New consultant
                                assignments are disabled until you set it to
                                Public.
                              </p>
                            </div>
                          )}
                          {showFullDoctorFlow && (
                            <div>
                              <p className="mb-2 text-sm font-medium text-slate-700">
                                Department consultants
                              </p>
                              <p className="mb-2 text-xs text-slate-500">
                              Consultants who belong to this department.
                              </p>
                              {doctors.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                                  No consultants available yet.
                                </p>
                              ) : (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowEditDoctorsMenu((prev) => !prev)
                                    }
                                    disabled={editDepartmentStatus !== "active"}
                                    className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                      {selectedEditDoctors.length === 0 ? (
                                        <span className="text-slate-500">
                                          Select consultants
                                        </span>
                                      ) : (
                                        selectedEditDoctors.map((doctor) => (
                                          <span
                                            key={doctor.id}
                                            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) =>
                                              e.stopPropagation()
                                            }
                                          >
                                            <span className="min-w-0 truncate">
                                              {doctor.name}
                                            </span>
                                            <span
                                              role="button"
                                              tabIndex={0}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleEditDoctor(doctor.id);
                                              }}
                                              onKeyDown={(e) => {
                                                if (
                                                  e.key === "Enter" ||
                                                  e.key === " "
                                                ) {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  toggleEditDoctor(doctor.id);
                                                }
                                              }}
                                              className="rounded-full p-0.5 hover:bg-indigo-100"
                                              aria-label={`Remove ${doctor.name}`}
                                            >
                                              <X className="h-3 w-3" />
                                            </span>
                                          </span>
                                        ))
                                      )}
                                    </div>
                                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                  </button>
                                  {showEditDoctorsMenu && (
                                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
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
                                            disabled={
                                              editDepartmentStatus !== "active" &&
                                              !checked
                                            }
                                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            <span
                                              className={classNames(
                                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                                checked
                                                  ? "border-indigo-600 bg-indigo-600 text-white"
                                                  : "border-slate-300"
                                              )}
                                            >
                                              {checked && (
                                                <Check className="h-2.5 w-2.5" />
                                              )}
                                            </span>
                                            <WorkspaceUserAvatar
                                              name={doctor.name}
                                              userId={doctor.id}
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
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowEditServicesMenu((prev) => !prev)
                                  }
                                  className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white"
                                >
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                    {selectedEditServices.length === 0 ? (
                                      <span className="text-slate-500">
                                        Select services
                                      </span>
                                    ) : (
                                      selectedEditServices.map((service) => (
                                        <span
                                          key={service.id}
                                          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600"
                                          onClick={(e) => e.stopPropagation()}
                                          onMouseDown={(e) => e.stopPropagation()}
                                        >
                                          <span className="min-w-0 truncate">
                                            {service.name}
                                          </span>
                                          <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleEditService(service.id);
                                            }}
                                            onKeyDown={(e) => {
                                              if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                              ) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleEditService(service.id);
                                              }
                                            }}
                                            className="rounded-full p-0.5 hover:bg-violet-100"
                                            aria-label={`Remove ${service.name}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </span>
                                        </span>
                                      ))
                                    )}
                                  </div>
                                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                                </button>
                                {showEditServicesMenu && (
                                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
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
                                                ? "border-indigo-600 bg-indigo-600 text-white"
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
                            )}
                          </div>

                          <div className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-sm text-indigo-600">
                            <Info className="mt-0.5 h-4.5 w-4.5 shrink-0" />
                            <p>
                              Services are not automatically assigned to all
                              department consultants. Consultants are assigned to specific
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
                          <span className="text-sm text-slate-700">
                            Visibility
                          </span>
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
                              className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
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
                        <DepartmentColorPicker
                          value={editDepartmentColor}
                          onChange={setEditDepartmentColor}
                        />
                      </PanelSection>
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={closeEditDepartmentPanel}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEditedDepartment()}
                        disabled={busyAction || !editDepartmentName.trim()}
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction ? "Saving…" : "Save Department"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      <AddDepartmentPanel
        open={showAddPanel}
        onClose={() => setShowAddPanel(false)}
        onCreated={(created) => {
          void handleAddDepartmentCreated(created);
        }}
      />

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

    </>
  );
}
