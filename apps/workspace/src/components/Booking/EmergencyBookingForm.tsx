"use client";

import React, { useState, useEffect } from "react";

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    service_provider_id: "",
    department_id: "",
    additional_description: "",
  });
  const [eventTypeIdMaxDuration, setEventTypeIdMaxDuration] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
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
          const providers = (json.teamMembers || [])
            .filter((m: { role: string }) => m.role === "service_provider")
            .map((m: { id: string; email: string; name?: string }) => ({
              id: m.id,
              email: m.email,
              raw_user_meta_data: { name: m.name },
            }));
          setServiceProviders(providers);
        }
      } catch (err) {
        console.error("Error fetching service providers:", err);
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
          additional_description: formData.additional_description.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create emergency booking");
      }

      setSuccess(true);
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

  const providerLabel = (p: ServiceProvider) =>
    p.raw_user_meta_data?.name || p.raw_user_meta_data?.full_name || p.email || p.id;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-slate-800 mb-4">Emergency Booking</h1>
      <form
        onSubmit={handleSubmit}
        className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70"
      >
        {error && (
          <div className="md:col-span-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="md:col-span-2 p-3 bg-green-100 text-green-700 rounded-lg text-sm">
            Emergency booking created successfully.
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Email *
          </label>
          <input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
            Phone *
          </label>
          <input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="service_provider" className="block text-sm font-medium text-slate-700 mb-1">
            Service Provider *
          </label>
          <select
            id="service_provider"
            value={formData.service_provider_id}
            onChange={(e) =>
              setFormData({ ...formData, service_provider_id: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            disabled={loadingProviders}
            required
          >
            <option value="">Select...</option>
            {serviceProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {providerLabel(p)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="department" className="block text-sm font-medium text-slate-700 mb-1">
            Department *
          </label>
          <select
            id="department"
            value={formData.department_id}
            onChange={(e) =>
              setFormData({ ...formData, department_id: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            disabled={loadingDepts}
            required
          >
            <option value="">Select...</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="additional_description" className="block text-sm font-medium text-slate-700 mb-1">
            Additional Information *
          </label>
          <textarea
            id="additional_description"
            rows={3}
            value={formData.additional_description}
            onChange={(e) =>
              setFormData({ ...formData, additional_description: e.target.value })
            }
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>

        <div className="md:col-span-2 flex justify-end gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Add Emergency Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}
