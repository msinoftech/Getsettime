"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  get_service_provider_display_name,
  type service_provider_display_source,
} from "@/src/utils/service_provider_display";
import { userActsAsServiceProviderFromMetadata } from "@/lib/service_provider_role";
import { normalizeDepartmentIdsFromUserMetadata } from "@/lib/sync_department_service_providers_from_team";

type IconName =
  | "alert"
  | "ambulance"
  | "shield"
  | "user"
  | "building"
  | "doctor"
  | "file"
  | "phone"
  | "mail"
  | "activity"
  | "chevron"
  | "spark"
  | "check"
  | "clock"
  | "admin"
  | "info";

interface Department {
  id: string | number;
  name: string;
}

interface EventType {
  id: string;
  title: string;
  duration_minutes: number | null;
}

interface ServiceProvider {
  id: string;
  email: string;
  name?: string;
  role: string | null;
  departments: string[];
  raw_user_meta_data?: { full_name?: string; name?: string };
}

type PriorityValue = "high" | "critical" | "immediate";

const PRIORITY_ORDER: { value: PriorityValue; label: string }[] = [
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
  { value: "immediate", label: "Immediate" },
];

const reasonSuggestions = [
  "Chest pain",
  "High fever",
  "Severe allergy",
  "Shortness of breath",
  "Urgent follow-up",
  "Injury / trauma",
];

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "department_id" | "notes", string>>;

export default function EmergencyBookingForm() {
  const router = useRouter();
  const footerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service_provider_id: "",
    department_id: "",
    priority: "high" as PriorityValue,
    additional_description: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [eventTypeIdMaxDuration, setEventTypeIdMaxDuration] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [workspaceOwnerSource, setWorkspaceOwnerSource] =
    useState<service_provider_display_source | null>(null);
  const [createdByLabel, setCreatedByLabel] = useState("Workspace");
  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const loadSessionUser = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const meta = user.user_metadata as Record<string, string | undefined> | undefined;
          const n =
            meta?.name ||
            meta?.full_name ||
            (typeof user.email === "string" ? user.email.split("@")[0] : undefined);
          if (n) setCreatedByLabel(n);
        }
      } catch {
        /* keep default */
      }
    };
    loadSessionUser();
  }, []);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/event-types", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const types = (json.data || []) as EventType[];
          if (types.length > 0) {
            const maxDuration = types.reduce((best, t) => {
              const d = t.duration_minutes ?? 0;
              return d > (best.duration_minutes ?? 0) ? t : best;
            }, types[0]);
            setEventTypeIdMaxDuration(maxDuration.id);
          }
        }
      } catch (err) {
        console.error("Error fetching event types:", err);
      }
    };

    const fetchDepartments = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/departments", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setDepartments(json.departments || []);
        }
      } catch (err) {
        console.error("Error fetching departments:", err);
      } finally {
        setLoadingDepts(false);
      }
    };

    const fetchServiceProviders = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/team-members", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          const members = (json.teamMembers || []) as Array<{
            id: string;
            email: string;
            name?: string;
            role: string | null;
            is_workspace_owner?: boolean;
            additional_roles?: string[];
            departments?: unknown;
            deactivated?: boolean;
            raw_user_meta_data?: { full_name?: string; name?: string };
          }>;
          const ownerMember = members.find((m) => m.is_workspace_owner === true);
          setWorkspaceOwnerSource(
            ownerMember
              ? {
                  email: ownerMember.email ?? "",
                  raw_user_meta_data: {
                    full_name: ownerMember.raw_user_meta_data?.full_name,
                    name: ownerMember.name ?? ownerMember.raw_user_meta_data?.name,
                  },
                }
              : null
          );
          const providers = members
            .filter(
              (m) =>
                m.deactivated !== true &&
                userActsAsServiceProviderFromMetadata({
                  role: m.role,
                  is_workspace_owner: m.is_workspace_owner,
                  additional_roles: m.additional_roles,
                })
            )
            .map((m) => {
              const deptIds = normalizeDepartmentIdsFromUserMetadata(m.departments).map((id) =>
                String(id)
              );
              return {
                id: m.id,
                email: m.email,
                name: m.name,
                role: m.role,
                departments: deptIds,
                raw_user_meta_data: { name: m.name, full_name: m.raw_user_meta_data?.full_name },
              } satisfies ServiceProvider;
            });
          setServiceProviders(providers);
        } else {
          setWorkspaceOwnerSource(null);
        }
      } catch (err) {
        console.error("Error fetching service providers:", err);
        setWorkspaceOwnerSource(null);
      } finally {
        setLoadingProviders(false);
      }
    };

    fetchEventTypes();
    fetchDepartments();
    fetchServiceProviders();
  }, []);

  const selectedDepartment = useMemo(
    () => departments.find((d) => String(d.id) === String(formData.department_id)),
    [departments, formData.department_id]
  );

  const filteredProviders = useMemo(() => {
    if (!formData.department_id) return [];
    const did = String(formData.department_id);
    return serviceProviders.filter((p) => p.departments.some((x) => String(x) === did));
  }, [formData.department_id, serviceProviders]);

  const selectedProvider = useMemo(
    () => serviceProviders.find((p) => p.id === formData.service_provider_id) ?? null,
    [formData.service_provider_id, serviceProviders]
  );

  const priorityDisplayLabel = useMemo(() => {
    return PRIORITY_ORDER.find((o) => o.value === formData.priority)?.label ?? "High";
  }, [formData.priority]);

  const bookingImpact = useMemo(() => {
    switch (formData.priority) {
      case "immediate":
        return "This booking may override normal queue order and should be reviewed instantly.";
      case "critical":
        return "This booking should be prioritized above regular appointments and assigned quickly.";
      default:
        return "This booking should be handled as a high-priority request.";
    }
  }, [formData.priority]);

  const providerLabel = (p: ServiceProvider) =>
    p.raw_user_meta_data?.name || p.raw_user_meta_data?.full_name || p.name || p.email || p.id;

  const setField = (patch: Partial<typeof formData>) => {
    setFormData((prev) => {
      const next = { ...prev, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "department_id")) {
        const newDept = patch.department_id ?? "";
        const still = serviceProviders.find(
          (sp) =>
            sp.id === prev.service_provider_id &&
            sp.departments.some((x) => String(x) === String(newDept))
        );
        next.service_provider_id = still ? prev.service_provider_id : "";
      }
      return next;
    });
    setFieldErrors((e) => {
      const n = { ...e };
      if ("name" in patch) n.name = undefined;
      if ("email" in patch) n.email = undefined;
      if ("phone" in patch) n.phone = undefined;
      if ("department_id" in patch) n.department_id = undefined;
      if ("additional_description" in patch) n.notes = undefined;
      return n;
    });
    setError(null);
    setSuccess(false);
  };

  const appendReason = (reason: string) => {
    setFormData((prev) => ({
      ...prev,
      additional_description: prev.additional_description
        ? `${prev.additional_description}\n• ${reason}`
        : `• ${reason}`,
    }));
    setFieldErrors((e) => ({ ...e, notes: undefined }));
    setError(null);
    setSuccess(false);
  };

  const priorityLabelForApi = (p: PriorityValue) => {
    if (p === "critical") return "Critical";
    if (p === "immediate") return "Immediate";
    return "High";
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!formData.name.trim()) next.name = "Patient name is required.";
    if (!formData.email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      next.email = "Enter a valid email address.";
    }
    if (!formData.phone.trim()) {
      next.phone = "Phone number is required.";
    } else if (formData.phone.replace(/[^\d+]/g, "").length < 10) {
      next.phone = "Enter a valid phone number.";
    }
    if (!formData.department_id) next.department_id = "Please select a department.";
    if (!formData.additional_description.trim()) next.notes = "Additional information is required.";

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const pl = priorityLabelForApi(formData.priority);
      const notes = formData.additional_description.trim();
      const description = notes ? `[Priority: ${pl}]\n\n${notes}` : `[Priority: ${pl}]`;

      const res = await fetch("/api/bookings/emergency", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          invitee_name: formData.name.trim(),
          invitee_email: formData.email.trim() || null,
          invitee_phone: formData.phone.trim() || null,
          event_type_id: eventTypeIdMaxDuration || null,
          service_provider_id: formData.service_provider_id || null,
          department_id: formData.department_id || null,
          additional_description: description,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create emergency booking");
      }

      setSuccess(true);
      window.dispatchEvent(new Event("bookings-viewed-update"));
      setFormData((prev) => ({
        ...prev,
        name: "",
        email: "",
        phone: "",
        service_provider_id: "",
        department_id: "",
        additional_description: "",
        priority: "high",
      }));
      setFieldErrors({});
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const scrollToReview = () => {
    footerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="min-h-screen w-full bg-slate-50"
      noValidate
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-200">
                <Icon name="ambulance" className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                  <Icon name="spark" className="h-3.5 w-3.5" />
                  Emergency Intake Workflow
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Emergency Booking
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">
                  Create urgent bookings with faster intake, department-based provider assignment,
                  and clear case notes for immediate action.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                label="Mode"
                value="Emergency"
                icon={<Icon name="shield" className="h-4 w-4" />}
              />
              <StatCard
                label="Priority"
                value={priorityDisplayLabel}
                icon={<Icon name="activity" className="h-4 w-4" />}
              />
              <StatCard
                label="Department"
                value={selectedDepartment?.name || "Not selected"}
                icon={<Icon name="building" className="h-4 w-4" />}
              />
              <StatCard
                label="Created By"
                value={createdByLabel}
                icon={<Icon name="admin" className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-[28px] border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50 shadow-sm">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Icon name="alert" className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-slate-900 sm:text-base">
                Emergency bookings can bypass standard availability rules
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Use this only for urgent cases. Once a department is selected, the provider list
                updates automatically to show only relevant providers.
              </p>
            </div>
            <button
              type="button"
              onClick={scrollToReview}
              className="shrink-0 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-left text-xs font-medium text-amber-700 shadow-sm transition hover:bg-amber-50"
            >
              Review before submit
            </button>
          </div>
        </div>

        {error && (
          <div
            className="mb-6 rounded-[24px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Icon name="check" className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-emerald-900">Emergency booking created successfully.</p>
                <p className="mt-1 text-sm text-emerald-800">The new booking is on your list and ready to assign.</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                    <Icon name="user" className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Patient Details</h2>
                    <p className="text-sm text-slate-500">
                      Add patient contact details and select the relevant department.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <FormField
                  label="Full Name"
                  required
                  icon={<Icon name="user" className="h-4 w-4" />}
                  error={fieldErrors.name}
                >
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setField({ name: e.target.value })}
                    placeholder="Enter patient full name"
                    className={getInputClass(!!fieldErrors.name)}
                    autoComplete="name"
                    disabled={loading}
                  />
                </FormField>
                <FormField
                  label="Email Address"
                  required
                  icon={<Icon name="mail" className="h-4 w-4" />}
                  error={fieldErrors.email}
                >
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setField({ email: e.target.value })}
                    placeholder="name@email.com"
                    className={getInputClass(!!fieldErrors.email)}
                    autoComplete="email"
                    disabled={loading}
                  />
                </FormField>
                <FormField
                  label="Phone Number"
                  required
                  icon={<Icon name="phone" className="h-4 w-4" />}
                  error={fieldErrors.phone}
                >
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setField({ phone: e.target.value })}
                    placeholder="+91 98765 43210"
                    className={getInputClass(!!fieldErrors.phone)}
                    autoComplete="tel"
                    disabled={loading}
                  />
                </FormField>
                <FormField
                  label="Department"
                  required
                  icon={<Icon name="building" className="h-4 w-4" />}
                  error={fieldErrors.department_id}
                >
                  <div className="relative">
                    <select
                      value={formData.department_id}
                      onChange={(e) => setField({ department_id: e.target.value })}
                      className={getSelectClass(!!fieldErrors.department_id)}
                      disabled={loadingDepts || loading}
                    >
                      <option value="">Select department</option>
                      {departments.map((d) => (
                        <option key={String(d.id)} value={String(d.id)}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="chevron"
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </FormField>
                {selectedDepartment && (
                  <div className="sm:col-span-2">
                    <div className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-800">
                      <Icon name="building" className="h-4 w-4" />
                      Selected Department: {selectedDepartment.name}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
                    <Icon name="doctor" className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Booking Details</h2>
                    <p className="text-sm text-slate-500">
                      Providers are filtered automatically based on selected department.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-5 p-6 sm:grid-cols-2">
                <FormField
                  label="Service Provider"
                  icon={<Icon name="doctor" className="h-4 w-4" />}
                >
                  <div className="relative">
                    <select
                      value={formData.service_provider_id}
                      onChange={(e) => setField({ service_provider_id: e.target.value })}
                      className={getSelectClass(false)}
                      disabled={loadingProviders || !formData.department_id || loading}
                    >
                      <option value="">
                        {!formData.department_id
                          ? "Select department first"
                          : serviceProviders.length === 0
                            ? get_service_provider_display_name(
                                null,
                                workspaceOwnerSource ?? undefined,
                                "No providers in workspace"
                              )
                            : "Select provider (optional)"}
                      </option>
                      {filteredProviders.map((p) => (
                        <option key={p.id} value={p.id}>
                          {providerLabel(p)}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="chevron"
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </FormField>
                <FormField
                  label="Priority"
                  icon={<Icon name="shield" className="h-4 w-4" />}
                >
                  <div className="relative">
                    <select
                      value={formData.priority}
                      onChange={(e) => setField({ priority: e.target.value as PriorityValue })}
                      className={getSelectClass(false)}
                      disabled={loading}
                    >
                      {PRIORITY_ORDER.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Icon
                      name="chevron"
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    />
                  </div>
                </FormField>
                <div className="sm:col-span-2">
                  <FormField
                    label="Additional Information"
                    required
                    icon={<Icon name="file" className="h-4 w-4" />}
                    error={fieldErrors.notes}
                  >
                    <textarea
                      value={formData.additional_description}
                      onChange={(e) => setField({ additional_description: e.target.value })}
                      placeholder="Describe symptoms, urgency reason, since when, severity, or important notes for the provider..."
                      rows={6}
                      className={`${getInputClass(!!fieldErrors.notes)} resize-none py-4`}
                      disabled={loading}
                    />
                  </FormField>
                  <div className="mt-4">
                    <p className="mb-3 text-sm font-semibold text-slate-700">Quick reason suggestions</p>
                    <div className="flex flex-wrap gap-2">
                      {reasonSuggestions.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => appendReason(reason)}
                          disabled={loading}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white disabled:opacity-50"
                        >
                          + {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    Tip: Keep notes short and actionable — what happened, since when, severity, and
                    anything clinically important.
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Emergency Summary</h2>
                <p className="text-sm text-slate-500">Live preview of the booking before submission.</p>
              </div>
              <div className="space-y-4 p-6">
                <SummaryRow label="Patient" value={formData.name || "Not added"} />
                <SummaryRow label="Email" value={formData.email || "Not added"} />
                <SummaryRow label="Phone" value={formData.phone || "Not added"} />
                <SummaryRow
                  label="Department"
                  value={selectedDepartment?.name || "Not selected"}
                />
                <SummaryRow
                  label="Provider"
                  value={
                    selectedProvider
                      ? providerLabel(selectedProvider)
                      : "Manual / later assign"
                  }
                />
                <SummaryRow label="Priority" value={priorityDisplayLabel} />
                <SummaryRow label="Created By" value={createdByLabel} />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Provider Availability</h2>
                <p className="text-sm text-slate-500">
                  Filtered by department for faster emergency assignment.
                </p>
              </div>
              <div className="space-y-3 p-6">
                {!formData.department_id ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Select a department to see providers linked to that department.
                  </div>
                ) : loadingProviders ? (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                    Loading providers…
                  </div>
                ) : filteredProviders.length > 0 ? (
                  filteredProviders.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{providerLabel(p)}</p>
                          <p className="mt-1 truncate text-sm text-slate-500">
                            {p.email || (p.role ? formatRole(p.role) : "Service provider")}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                          In department
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    No service providers are linked to this department. You can still submit and
                    assign a provider later.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Booking Impact</h2>
                <p className="text-sm text-slate-500">Explain how this booking affects normal flow.</p>
              </div>
              <div className="p-6">
                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex gap-3">
                    <div className="mt-0.5 text-violet-700">
                      <Icon name="info" className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-violet-900">{priorityDisplayLabel} priority</p>
                      <p className="mt-1 text-sm leading-6 text-violet-800">{bookingImpact}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">Admin Notes</h2>
                <p className="text-sm text-slate-500">Recommended checks before creating the booking.</p>
              </div>
              <div className="space-y-3 p-6">
                <NoticeItem text="Always verify patient phone and callback details first." />
                <NoticeItem text="Select department before provider to avoid assignment mismatch." />
                <NoticeItem text="Use Immediate only for truly urgent, high-risk cases." />
                <NoticeItem text="Allow reassignment if the selected provider is busy or unavailable." />
              </div>
            </section>
          </div>
        </div>
      </div>

      <div
        ref={footerRef}
        className="sticky bottom-0 z-20 mt-6 border-t border-slate-200 bg-slate-50/95 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-medium text-slate-900">Ready to create this emergency booking?</p>
            <p className="text-xs text-slate-500">Required fields are validated before submission.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="inline-flex h-11 min-w-[7rem] items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 min-w-[12rem] items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:scale-[1.01] hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Add Emergency Booking"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FormField({
  label,
  required,
  icon,
  children,
  error,
}: {
  label: string;
  required?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
      </div>
      {children}
      {error ? <p className="mt-2 text-xs font-medium text-rose-600">{error}</p> : null}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-2 flex items-center gap-2 text-slate-400">{icon}</div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-slate-900" title={value}>
        {value}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function NoticeItem({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
      <p className="text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function getInputClass(hasError: boolean) {
  return `w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:ring-4 disabled:opacity-60 ${
    hasError
      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
      : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-100"
  }`;
}

function getSelectClass(hasError: boolean) {
  return `w-full appearance-none rounded-2xl border bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:ring-4 disabled:opacity-60 ${
    hasError
      ? "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
      : "border-slate-200 focus:border-indigo-500 focus:ring-indigo-100"
  }`;
}

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const commonProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const icons: Record<IconName, React.ReactNode> = {
    alert: (
      <svg {...commonProps}>
        <path d="M12 3 2.8 19a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L12 3Z" />
        <path d="M12 9v5" />
        <path d="M12 18h.01" />
      </svg>
    ),
    ambulance: (
      <svg {...commonProps}>
        <path d="M4 17H3a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h8v8" />
        <path d="M12 8h4l4 4v4a1 1 0 0 1-1 1h-1" />
        <path d="M6 17h8" />
        <circle cx="6" cy="17" r="2" />
        <circle cx="16" cy="17" r="2" />
        <path d="M7 6v4" />
        <path d="M5 8h4" />
      </svg>
    ),
    shield: (
      <svg {...commonProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="M12 8v4" />
        <path d="M12 16h.01" />
      </svg>
    ),
    user: (
      <svg {...commonProps}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    ),
    building: (
      <svg {...commonProps}>
        <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
        <path d="M9 21v-5h3v5" />
        <path d="M8 7h.01" />
        <path d="M13 7h.01" />
        <path d="M8 11h.01" />
        <path d="M13 11h.01" />
        <path d="M3 21h18" />
      </svg>
    ),
    doctor: (
      <svg {...commonProps}>
        <path d="M12 3v6" />
        <path d="M9 6h6" />
        <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    file: (
      <svg {...commonProps}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </svg>
    ),
    phone: (
      <svg {...commonProps}>
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8.9 9.7a16 16 0 0 0 5.4 5.4l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2Z" />
      </svg>
    ),
    mail: (
      <svg {...commonProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
    activity: (
      <svg {...commonProps}>
        <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
      </svg>
    ),
    chevron: (
      <svg {...commonProps}>
        <path d="m6 9 6 6 6-6" />
      </svg>
    ),
    spark: (
      <svg {...commonProps}>
        <path d="M12 2v6" />
        <path d="M12 16v6" />
        <path d="m4.9 4.9 4.2 4.2" />
        <path d="m14.9 14.9 4.2 4.2" />
        <path d="M2 12h6" />
        <path d="M16 12h6" />
        <path d="m4.9 19.1 4.2-4.2" />
        <path d="m14.9 9.1 4.2-4.2" />
      </svg>
    ),
    check: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="m8 12 3 3 5-6" />
      </svg>
    ),
    clock: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    admin: (
      <svg {...commonProps}>
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a7 7 0 0 1 13 0" />
        <path d="m16.5 11.5 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3 1-2Z" />
      </svg>
    ),
    info: (
      <svg {...commonProps}>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    ),
  };

  return <>{icons[name]}</>;
}
