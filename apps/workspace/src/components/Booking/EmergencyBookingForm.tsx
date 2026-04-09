"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  get_service_provider_display_name,
  type service_provider_display_source,
} from "@/src/utils/service_provider_display";

interface Department {
  id: string;
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
  raw_user_meta_data?: { full_name?: string; name?: string };
}

export default function EmergencyBookingForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service_provider_id: "",
    department_id: "",
    priority: "high" as "high" | "critical",
    additional_description: "",
  });
  const [eventTypeIdMaxDuration, setEventTypeIdMaxDuration] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [workspaceOwnerSource, setWorkspaceOwnerSource] =
    useState<service_provider_display_source | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const { data: { session } } = await supabase.auth.getSession();
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
        const { data: { session } } = await supabase.auth.getSession();
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
        const { data: { session } } = await supabase.auth.getSession();
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
            role: string;
            is_workspace_owner?: boolean;
            raw_user_meta_data?: { full_name?: string; name?: string };
          }>;
          const ownerMember = members.find((m) => m.is_workspace_owner === true);
          setWorkspaceOwnerSource(
            ownerMember
              ? {
                  email: ownerMember.email ?? "",
                  raw_user_meta_data: {
                    full_name: ownerMember.raw_user_meta_data?.full_name,
                    name:
                      ownerMember.name ??
                      ownerMember.raw_user_meta_data?.name,
                  },
                }
              : null
          );
          const providers = members
            .filter((m) => m.role === "service_provider")
            .map((m) => ({
              id: m.id,
              email: m.email,
              raw_user_meta_data: { name: m.name },
            }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const priorityLabel = formData.priority === "critical" ? "Critical" : "High";
      const notes = formData.additional_description.trim();
      const description = notes
        ? `[Priority: ${priorityLabel}]\n\n${notes}`
        : `[Priority: ${priorityLabel}]`;

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
      }));
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

  const providerLabel = (p: ServiceProvider) =>
    p.raw_user_meta_data?.name || p.raw_user_meta_data?.full_name || p.email || p.id;

  const inputBase =
    "w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const selectBase =
    "w-full h-11 px-4 rounded-xl border border-gray-200 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Emergency Booking</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a high-priority booking for urgent cases. Required fields are marked with *.
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Info banner */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5" aria-hidden="true">
              ⚡
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                Emergency bookings bypass standard availability rules (if enabled).
              </p>
              <p className="text-sm text-gray-600">
                Please double-check patient contact details before submitting.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm" role="alert">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-100 text-green-700 rounded-xl text-sm" role="status">
              Emergency booking created successfully.
            </div>
          )}

          {/* Section: Patient Details */}
          <section aria-labelledby="patient-details-heading">
            <h2
              id="patient-details-heading"
              className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4"
            >
              Patient Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Name *" htmlFor="name">
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={inputBase}
                  placeholder="Enter full name"
                  required
                />
              </Field>

              <Field label="Email *" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={inputBase}
                  placeholder="name@email.com"
                  required
                />
              </Field>

              <Field label="Phone *" htmlFor="phone">
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={inputBase}
                  placeholder="+91 98765 43210"
                  required
                />
              </Field>

              <Field label="Department *" htmlFor="department">
                <select
                  id="department"
                  value={formData.department_id}
                  onChange={(e) =>
                    setFormData({ ...formData, department_id: e.target.value })
                  }
                  className={selectBase}
                  disabled={loadingDepts}
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Divider */}
          <div className="h-px bg-gray-100" />

          {/* Section: Booking Details */}
          <section aria-labelledby="booking-details-heading">
            <h2
              id="booking-details-heading"
              className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4"
            >
              Booking Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Service Provider" htmlFor="service_provider">
                <select
                  id="service_provider"
                  value={formData.service_provider_id}
                  onChange={(e) =>
                    setFormData({ ...formData, service_provider_id: e.target.value })
                  }
                  className={selectBase}
                  disabled={loadingProviders}
                >
                  <option value="">
                    {serviceProviders.length === 0
                      ? get_service_provider_display_name(
                          null,
                          workspaceOwnerSource ?? undefined,
                          "Workspace admin"
                        )
                      : "Select provider"}
                  </option>
                  {serviceProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {providerLabel(p)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority" htmlFor="priority">
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priority: e.target.value as "high" | "critical",
                    })
                  }
                  className={selectBase}
                >
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            </div>

            <div className="mt-5">
              <Field label="Additional Information *" htmlFor="additional_description">
                <textarea
                  id="additional_description"
                  rows={5}
                  value={formData.additional_description}
                  onChange={(e) =>
                    setFormData({ ...formData, additional_description: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Symptoms, urgency reason, notes for the provider..."
                  required
                />
              </Field>
              <p className="text-xs text-gray-500 mt-2">
                Tip: Keep it short and actionable (what happened, since when, severity).
              </p>
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 transition disabled:opacity-60"
          >
            {loading ? "Saving..." : "Add Emergency Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={htmlFor}>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}
