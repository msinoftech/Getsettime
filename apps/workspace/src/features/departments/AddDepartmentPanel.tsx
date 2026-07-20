"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LuCheck as Check,
  LuChevronDown as ChevronDown,
  LuFileText as FileText,
  LuGlobe as Globe,
  LuInfo as Info,
  LuLock as Lock,
  LuX as X,
} from "react-icons/lu";
import type { IconType } from "react-icons";
import { supabase } from "@/lib/supabaseClient";
import { AlertModal } from "@/src/components/ui/AlertModal";
import {
  DEFAULT_DEPARTMENT_COLOR,
  type department_color_id,
} from "@/src/features/departments/department_colors";
import {
  classNames,
  DepartmentColorPicker,
  PanelSection,
  ProviderAvatar,
  provider_initials,
} from "@/src/features/departments/DepartmentPanelPrimitives";
import { useServiceProviders, useUserDepartments } from "@/src/hooks/useBookingLookups";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import type { ServiceProvider } from "@/src/types/booking-entities";

const DESCRIPTION_MAX_LENGTH = 150;

type VisibilityStatus = "active" | "private" | "draft";

const VISIBILITY_OPTIONS: {
  value: VisibilityStatus;
  label: string;
  Icon: IconType;
}[] = [
  { value: "active", label: "Public", Icon: Globe },
  { value: "private", label: "Private", Icon: Lock },
  { value: "draft", label: "Draft", Icon: FileText },
];

type workspace_department = {
  id: number;
  name: string;
  status?: string | null;
};

type workspace_service = {
  id: string;
  name: string;
  department_id: number | null;
  flag?: boolean;
};

type doctor_option = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export type created_department = {
  id: number;
  name: string;
};

export type AddDepartmentPanelProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (department: created_department) => void;
};

function serviceProviderDisplayName(p: ServiceProvider): string {
  return (
    p.raw_user_meta_data?.full_name ||
    p.raw_user_meta_data?.name ||
    p.email ||
    "Unknown"
  );
}

function resolveProviderAvatarUrl(p: ServiceProvider): string | null {
  return p.avatar_url?.trim() || null;
}

export function AddDepartmentPanel({
  open,
  onClose,
  onCreated,
}: AddDepartmentPanelProps) {
  const { user } = useAuth();
  const { workspaceAdminProfessionsId } = useWorkspaceSettings();
  const { data: serviceProviders } = useServiceProviders();
  const { byUser: deptIdsByProvider, refetch: refetchUserDepartments } =
    useUserDepartments();

  const currentUserRole =
    (user?.user_metadata?.role as string | undefined) ?? null;
  const isLoggedInServiceProvider = currentUserRole === "service_provider";
  const currentUserId = user?.id ?? null;
  const showFullDoctorFlow =
    serviceProviders.length > 1 && !isLoggedInServiceProvider;
  const showOrganizationSection = !isLoggedInServiceProvider;

  const [panelAnimatedOpen, setPanelAnimatedOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const [departments, setDepartments] = useState<workspace_department[]>([]);
  const [workspaceServices, setWorkspaceServices] = useState<workspace_service[]>(
    []
  );
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const adminProfessionsId = workspaceAdminProfessionsId ?? null;
  const [serviceSuggestions, setServiceSuggestions] = useState<string[]>([]);

  const [departmentName, setDepartmentName] = useState("");
  const [departmentDescription, setDepartmentDescription] = useState("");
  const [assignedDoctorIds, setAssignedDoctorIds] = useState<string[]>([]);
  const [showDoctorsMenu, setShowDoctorsMenu] = useState(false);
  const [selectedServiceNames, setSelectedServiceNames] = useState<string[]>(
    []
  );
  const [customServiceName, setCustomServiceName] = useState("");
  const [departmentStatus, setDepartmentStatus] =
    useState<VisibilityStatus>("active");
  const [departmentColor, setDepartmentColor] = useState<department_color_id>(
    DEFAULT_DEPARTMENT_COLOR
  );

  const panelVisible = open || panelAnimatedOpen;

  const getAuthToken = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const resetForm = useCallback(() => {
    setDepartmentName("");
    setDepartmentDescription("");
    setAssignedDoctorIds([]);
    setShowDoctorsMenu(false);
    setSelectedServiceNames([]);
    setCustomServiceName("");
    setServiceSuggestions([]);
    setDepartmentStatus("active");
    setDepartmentColor(DEFAULT_DEPARTMENT_COLOR);
  }, []);

  const loadLookups = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    try {
      const [deptRes, servicesRes] = await Promise.all([
        fetch("/api/departments", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/services", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(
          Array.isArray(data?.departments)
            ? (data.departments as workspace_department[])
            : []
        );
      }

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        const list = Array.isArray(data?.services)
          ? (data.services as workspace_service[])
          : [];
        setWorkspaceServices(list.filter((s) => s.flag !== false));
      }

      if (!adminProfessionsId) {
        setSuggestions([]);
      } else {
        const catalogRes = await fetch(
          `/api/catalog/departments?profession_id=${adminProfessionsId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (catalogRes.ok) {
          const catalogData = await catalogRes.json();
          setSuggestions(
            Array.isArray(catalogData?.departments)
              ? catalogData.departments
              : []
          );
        }
      }
    } catch (error) {
      console.error("Error loading add-department lookups:", error);
    }
  }, [getAuthToken, adminProfessionsId]);

  useEffect(() => {
    if (!open) {
      setPanelAnimatedOpen(false);
      return;
    }
    void loadLookups();
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPanelAnimatedOpen(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, loadLookups]);

  useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const trimmedDepartmentName = departmentName.trim();
  const matchedCatalogDepartment = useMemo(
    () =>
      suggestions.find(
        (item) => item.toLowerCase() === trimmedDepartmentName.toLowerCase()
      ) ?? null,
    [suggestions, trimmedDepartmentName]
  );

  useEffect(() => {
    if (!open) return;
    if (!adminProfessionsId || !matchedCatalogDepartment) {
      setServiceSuggestions([]);
      return;
    }

    let cancelled = false;
    const loadServiceSuggestions = async () => {
      const token = await getAuthToken();
      if (!token || cancelled) return;
      try {
        const res = await fetch(
          `/api/catalog/services?profession_id=${adminProfessionsId}&department=${encodeURIComponent(
            matchedCatalogDepartment
          )}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled) {
          setServiceSuggestions(
            Array.isArray(data?.services) ? (data.services as string[]) : []
          );
        }
      } catch (error) {
        console.error("Error loading service suggestions:", error);
      }
    };

    void loadServiceSuggestions();
    return () => {
      cancelled = true;
    };
  }, [open, adminProfessionsId, matchedCatalogDepartment, getAuthToken]);

  const doctors = useMemo<doctor_option[]>(() => {
    return serviceProviders.map((sp) => ({
      id: sp.id,
      name: serviceProviderDisplayName(sp),
      avatarUrl: resolveProviderAvatarUrl(sp),
    }));
  }, [serviceProviders]);

  const assignedDeptIdsForEffectiveProvider = useMemo(() => {
    const providerId =
      isLoggedInServiceProvider && currentUserId
        ? currentUserId
        : serviceProviders.length === 1
          ? serviceProviders[0]!.id
          : null;
    if (!providerId) return new Set<number>();
    return deptIdsByProvider.get(providerId) ?? new Set<number>();
  }, [
    isLoggedInServiceProvider,
    currentUserId,
    serviceProviders,
    deptIdsByProvider,
  ]);

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
      return departments.some(
        (d) => d.name.toLowerCase() === name.toLowerCase()
      );
    },
    [isLoggedInServiceProvider, departments, assignedDeptIdsForEffectiveProvider]
  );

  const selectedDoctors = doctors.filter((d) =>
    assignedDoctorIds.includes(d.id)
  );

  const visibilityOption =
    VISIBILITY_OPTIONS.find((o) => o.value === departmentStatus) ??
    VISIBILITY_OPTIONS[0];
  const VisibilityIcon = visibilityOption.Icon;

  const handleClose = () => {
    onClose();
  };

  const linkUserToDepartment = useCallback(
    async (userId: string, departmentId: number) => {
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
    },
    [getAuthToken]
  );

  const assignServiceToProviders = useCallback(
    async (token: string, serviceId: string, providerIds: string[]) => {
      for (const userId of providerIds) {
        const res = await fetch("/api/user-services", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId, service_id: serviceId }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          const message: string = err?.error || "";
          // An already-existing assignment is fine; anything else is a failure.
          if (!message.toLowerCase().includes("duplicate")) {
            setAlertMessage(
              message || `Failed to assign consultant to service (${res.status})`
            );
            return false;
          }
        }
      }
      return true;
    },
    []
  );

  const createDepartmentServices = useCallback(
    async (
      departmentId: number,
      serviceNames: string[],
      providerIds: string[]
    ) => {
      if (serviceNames.length === 0) return true;

      const token = await getAuthToken();
      if (!token) {
        setAlertMessage("Not authenticated");
        return false;
      }

      for (const serviceName of serviceNames) {
        const trimmedName = serviceName.trim();
        if (!trimmedName) continue;

        // Prefer an existing service already in this department; otherwise create.
        const existingInDept = workspaceServices.find(
          (s) =>
            s.name.toLowerCase() === trimmedName.toLowerCase() &&
            Number(s.department_id) === departmentId
        );

        let serviceId: string | null = existingInDept?.id ?? null;

        if (!serviceId) {
          const response = await fetch("/api/services", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name: trimmedName,
              department_id: departmentId,
            }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => null);
            setAlertMessage(
              err?.error || `Failed to create service (${response.status})`
            );
            return false;
          }
          const data = (await response.json().catch(() => null)) as {
            service?: { id: string | number };
          } | null;
          serviceId =
            data?.service?.id != null ? String(data.service.id) : null;
        }

        if (!serviceId) {
          setAlertMessage(`Failed to resolve service id for "${trimmedName}"`);
          return false;
        }

        if (providerIds.length > 0) {
          const assigned = await assignServiceToProviders(
            token,
            serviceId,
            providerIds
          );
          if (!assigned) return false;
        }
      }

      return true;
    },
    [workspaceServices, getAuthToken, assignServiceToProviders]
  );

  const assignSelfToDepartment = useCallback(
    async (departmentId: number) => {
      if (!isLoggedInServiceProvider || !currentUserId) return false;
      if (assignedDeptIdsForEffectiveProvider.has(departmentId)) return true;
      const ok = await linkUserToDepartment(currentUserId, departmentId);
      if (!ok) return false;
      await refetchUserDepartments();
      return true;
    },
    [
      isLoggedInServiceProvider,
      currentUserId,
      assignedDeptIdsForEffectiveProvider,
      linkUserToDepartment,
      refetchUserDepartments,
    ]
  );

  const createDepartment = useCallback(
    async (
      rawName: string,
      opts?: {
        description?: string;
        doctorIds?: string[];
        serviceNames?: string[];
        status?: VisibilityStatus;
        color?: department_color_id;
      }
    ): Promise<created_department | null> => {
      const name = rawName.trim();
      if (!name) return null;

      setBusyAction(true);
      try {
        const token = await getAuthToken();
        if (!token) {
          setAlertMessage("Not authenticated");
          return null;
        }

        const linkTarget =
          isLoggedInServiceProvider && currentUserId
            ? { id: currentUserId }
            : serviceProviders.length === 1
              ? serviceProviders[0]
              : undefined;

        let deptId: number;
        let deptName: string;

        const existing = departments.find(
          (d) => d.name.toLowerCase() === name.toLowerCase()
        );

        if (existing) {
          deptId = existing.id;
          deptName = existing.name;
          if (isLoggedInServiceProvider && currentUserId) {
            await assignSelfToDepartment(existing.id);
          }
        } else {
          const response = await fetch("/api/departments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              name,
              description: opts?.description?.trim() || null,
              status: opts?.status ?? "active",
              meta_data: {
                color: opts?.color ?? DEFAULT_DEPARTMENT_COLOR,
              },
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => null);
            setAlertMessage(err?.error || `Request failed (${response.status})`);
            return null;
          }

          const data = (await response.json().catch(() => null)) as {
            department?: { id: number; name: string };
          } | null;

          if (!data?.department?.id) return null;
          deptId = data.department.id;
          deptName = data.department.name;
        }

        // Resolve consultants the same way for department + service assignment.
        let serviceProviderIds: string[] = [];
        if (showFullDoctorFlow && opts?.doctorIds?.length) {
          serviceProviderIds = opts.doctorIds;
        } else if (linkTarget) {
          serviceProviderIds = [linkTarget.id];
        }

        for (const userId of serviceProviderIds) {
          const alreadyLinked =
            deptIdsByProvider.get(userId)?.has(deptId) ?? false;
          if (!alreadyLinked) {
            const ok = await linkUserToDepartment(userId, deptId);
            if (!ok) {
              setAlertMessage("Failed to link provider to department");
              return { id: deptId, name: deptName };
            }
          }
        }
        if (serviceProviderIds.length > 0) {
          await refetchUserDepartments();
        }

        const serviceNames = (opts?.serviceNames ?? [])
          .map((n) => n.trim())
          .filter(Boolean);
        if (serviceNames.length > 0) {
          const servicesOk = await createDepartmentServices(
            deptId,
            serviceNames,
            serviceProviderIds
          );
          if (!servicesOk) {
            return { id: deptId, name: deptName };
          }
        }

        return { id: deptId, name: deptName };
      } finally {
        setBusyAction(false);
      }
    },
    [
      departments,
      isLoggedInServiceProvider,
      currentUserId,
      assignSelfToDepartment,
      getAuthToken,
      serviceProviders,
      deptIdsByProvider,
      linkUserToDepartment,
      refetchUserDepartments,
      showFullDoctorFlow,
      createDepartmentServices,
    ]
  );

  const handleSuggestionClick = async (name: string) => {
    if (suggestionShowsAsSelected(name)) return;
    const created = await createDepartment(name);
    if (!created) return;
    onCreated?.(created);
    if (isLoggedInServiceProvider) handleClose();
  };

  const handleSave = async () => {
    const pendingCustom = customServiceName.trim();
    const serviceNames = [...selectedServiceNames];
    if (
      pendingCustom &&
      !serviceNames.some((n) => n.toLowerCase() === pendingCustom.toLowerCase())
    ) {
      serviceNames.push(pendingCustom);
    }

    const created = await createDepartment(departmentName, {
      description: departmentDescription,
      doctorIds: assignedDoctorIds,
      serviceNames,
      status: departmentStatus,
      color: departmentColor,
    });
    if (!created) return;
    onCreated?.(created);
    handleClose();
  };

  const toggleDoctor = (doctorId: string) => {
    setAssignedDoctorIds((prev) =>
      prev.includes(doctorId)
        ? prev.filter((id) => id !== doctorId)
        : [...prev, doctorId]
    );
  };

  const toggleServiceName = (name: string) => {
    setSelectedServiceNames((prev) =>
      prev.some((n) => n.toLowerCase() === name.toLowerCase())
        ? prev.filter((n) => n.toLowerCase() !== name.toLowerCase())
        : [...prev, name]
    );
  };

  const addCustomService = () => {
    const name = customServiceName.trim();
    if (!name) return;
    setSelectedServiceNames((prev) =>
      prev.some((n) => n.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, name]
    );
    setCustomServiceName("");
  };

  const panelFieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <>
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
              <h2 className="text-lg font-bold text-slate-900">Add Department</h2>
              <button
                type="button"
                onClick={handleClose}
                className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex-1 overflow-y-auto px-5 py-5">
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <PanelSection
                      number={1}
                      title="Basic Details"
                      isLast={isLoggedInServiceProvider}
                    >
                      {!isLoggedInServiceProvider && (
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
                      )}

                      {suggestions.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Quick Suggestions
                          </span>
                          <div className="mt-2">
                            <p className="mb-2 text-xs text-slate-500">
                              {isLoggedInServiceProvider
                                ? "Select a department to assign it to yourself."
                                : "Click a suggestion to fill the department name."}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {suggestions.map((item) => {
                                const selected =
                                  suggestionShowsAsSelected(item);
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
                        </div>
                      )}

                      {isLoggedInServiceProvider && suggestions.length === 0 && (
                        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
                          No department suggestions available for your profession
                          yet.
                        </p>
                      )}

                      {!isLoggedInServiceProvider && (
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
                      )}
                    </PanelSection>

                    {showOrganizationSection && (
                      <PanelSection number={2} title="Organization">
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
                                    setShowDoctorsMenu((prev) => !prev)
                                  }
                                  className="flex min-h-[42px] w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-white"
                                >
                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                                    {selectedDoctors.length === 0 ? (
                                      <span className="text-slate-500">
                                        Select consultants
                                      </span>
                                    ) : (
                                      selectedDoctors.map((doctor) => (
                                        <span
                                          key={doctor.id}
                                          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
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
                                              toggleDoctor(doctor.id);
                                            }}
                                            onKeyDown={(e) => {
                                              if (
                                                e.key === "Enter" ||
                                                e.key === " "
                                              ) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleDoctor(doctor.id);
                                              }
                                            }}
                                            className="rounded-full p-0.5 hover:bg-violet-100"
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
                                {showDoctorsMenu && (
                                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                                    {doctors.map((doctor) => {
                                      const checked = assignedDoctorIds.includes(
                                        doctor.id
                                      );
                                      return (
                                        <button
                                          key={doctor.id}
                                          type="button"
                                          onClick={() => toggleDoctor(doctor.id)}
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
                                            initials={provider_initials(
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
                            )}
                          </div>
                        )}

                        <div>
                          <p className="mb-2 text-sm font-medium text-slate-700">
                            Services offered
                            <span className="ml-1 text-xs font-normal text-slate-400">
                              (optional)
                            </span>
                          </p>
                          <p className="mb-2 text-xs text-slate-500">
                            Services available in this department.
                          </p>

                          {selectedServiceNames.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {selectedServiceNames.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800"
                                >
                                  <span className="min-w-0 truncate">
                                    {name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => toggleServiceName(name)}
                                    className="rounded-full p-0.5 hover:bg-violet-100"
                                    aria-label={`Remove ${name}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {serviceSuggestions.length > 0 ? (
                            <div className="mb-3">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Quick Suggestions
                              </span>
                              <p className="mb-2 mt-1 text-xs text-slate-500">
                                Click a suggestion to add it as a service.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {serviceSuggestions.map((item) => {
                                  const selected = selectedServiceNames.some(
                                    (n) =>
                                      n.toLowerCase() === item.toLowerCase()
                                  );
                                  return (
                                    <button
                                      key={item}
                                      type="button"
                                      onClick={() => toggleServiceName(item)}
                                      disabled={busyAction}
                                      className={classNames(
                                        "rounded-full px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                                        selected
                                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                                      )}
                                    >
                                      {selected ? "✓" : "+"} {item}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p className="mb-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                              {matchedCatalogDepartment
                                ? "No service suggestions available for this department yet."
                                : "Pick a department from the quick suggestions to see matching service suggestions."}
                            </p>
                          )}

                          <div className="flex gap-2">
                            <input
                              value={customServiceName}
                              onChange={(e) =>
                                setCustomServiceName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addCustomService();
                                }
                              }}
                              placeholder="Add a custom service"
                              className={panelFieldClass}
                            />
                            <button
                              type="button"
                              onClick={addCustomService}
                              disabled={busyAction || !customServiceName.trim()}
                              className="shrink-0 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-xs text-violet-800">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <p>
                            Selected services are created with this department and automatically assigned to the selected consultants.
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
                          <span className="text-sm text-slate-700">Visibility</span>
                          <div className="relative min-w-[9.5rem]">
                            <VisibilityIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                            <select
                              value={departmentStatus}
                              onChange={(e) =>
                                setDepartmentStatus(
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
                        <DepartmentColorPicker
                          value={departmentColor}
                          onChange={setDepartmentColor}
                        />
                      </PanelSection>
                    )}
                  </div>
                </div>

                <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {isLoggedInServiceProvider ? "Close" : "Cancel"}
                    </button>
                    {!isLoggedInServiceProvider && (
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={busyAction || !departmentName.trim()}
                        className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyAction ? "Saving…" : "Save Department"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>

      {alertMessage && (
        <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      )}
    </>
  );
}
