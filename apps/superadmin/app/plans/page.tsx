"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pagination, usePagination } from "@app/ui";
import type { plan_cta_variant, plans_with_content } from "@app/db/subscription";
import {
  formatBookingLimitLabel,
  isUnlimitedBookingLimit,
  UNLIMITED_BOOKING_LIMIT,
} from "@app/db/subscription";
import { PlanTableSkeleton } from "@/src/components/Plans/PlanTableSkeleton";

type PlanFormState = {
  name: string;
  slug: string;
  price: string;
  booking_limit: string;
  unlimited_bookings: boolean;
  workspace_limit: string;
  admin_limit: string;
  service_provider_limit: string;
  extra_service_provider_seat_price: string;
  billing_interval: string;
  display_order: string;
  is_active: boolean;
  google_calendar_sync: boolean;
  email_notifications: boolean;
  public_booking_page: boolean;
  whatsapp_automation: boolean;
  online_payments: boolean;
  additional_locations: boolean;
  subtitle: string;
  features: string[];
  cta_label: string;
  cta_variant: plan_cta_variant;
  badge_label: string;
  is_highlighted: boolean;
  content_display_order: string;
};

const EMPTY_FORM: PlanFormState = {
  name: "",
  slug: "",
  price: "0",
  booking_limit: "250",
  unlimited_bookings: false,
  workspace_limit: "1",
  admin_limit: "1",
  service_provider_limit: "2",
  extra_service_provider_seat_price: "0",
  billing_interval: "month",
  display_order: "0",
  is_active: true,
  google_calendar_sync: true,
  email_notifications: true,
  public_booking_page: true,
  whatsapp_automation: false,
  online_payments: false,
  additional_locations: false,
  subtitle: "",
  features: [""],
  cta_label: "",
  cta_variant: "primary",
  badge_label: "",
  is_highlighted: false,
  content_display_order: "0",
};

function planToForm(plan: plans_with_content): PlanFormState {
  return {
    name: plan.name,
    slug: plan.slug,
    price: String(plan.price),
    booking_limit: isUnlimitedBookingLimit(plan.booking_limit)
      ? String(UNLIMITED_BOOKING_LIMIT)
      : String(plan.booking_limit),
    unlimited_bookings: isUnlimitedBookingLimit(plan.booking_limit),
    workspace_limit: String(plan.workspace_limit),
    admin_limit: String(plan.admin_limit),
    service_provider_limit: String(plan.service_provider_limit),
    extra_service_provider_seat_price: String(plan.extra_service_provider_seat_price),
    billing_interval: plan.billing_interval ?? "",
    display_order: String(plan.display_order),
    is_active: plan.is_active,
    google_calendar_sync: plan.google_calendar_sync,
    email_notifications: plan.email_notifications,
    public_booking_page: plan.public_booking_page,
    whatsapp_automation: plan.whatsapp_automation,
    online_payments: plan.online_payments,
    additional_locations: plan.additional_locations,
    subtitle: plan.content?.subtitle ?? "",
    features: plan.content?.features?.length ? plan.content.features : [""],
    cta_label: plan.content?.cta_label ?? "",
    cta_variant: plan.content?.cta_variant ?? "primary",
    badge_label: plan.content?.badge_label ?? "",
    is_highlighted: plan.content?.is_highlighted ?? false,
    content_display_order: String(plan.content?.display_order ?? 0),
  };
}

function formToPayload(form: PlanFormState) {
  const features = form.features.map((f) => f.trim()).filter(Boolean);
  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    price: Number(form.price),
    booking_limit: form.unlimited_bookings
      ? UNLIMITED_BOOKING_LIMIT
      : Number(form.booking_limit),
    workspace_limit: Number(form.workspace_limit),
    admin_limit: Number(form.admin_limit),
    service_provider_limit: Number(form.service_provider_limit),
    extra_service_provider_seat_price: Number(form.extra_service_provider_seat_price),
    billing_interval: form.billing_interval.trim() || null,
    display_order: Number(form.display_order) || 0,
    is_active: form.is_active,
    google_calendar_sync: form.google_calendar_sync,
    email_notifications: form.email_notifications,
    public_booking_page: form.public_booking_page,
    whatsapp_automation: form.whatsapp_automation,
    online_payments: form.online_payments,
    additional_locations: form.additional_locations,
    content: {
      context: "upgrade_modal" as const,
      subtitle: form.subtitle.trim() || null,
      features,
      cta_label: form.cta_label.trim() || null,
      cta_variant: form.cta_variant,
      badge_label: form.badge_label.trim() || null,
      is_highlighted: form.is_highlighted,
      display_order: Number(form.content_display_order) || 0,
    },
  };
}

function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isSlugTaken(
  slug: string,
  plans: plans_with_content[],
  excludePlanId?: number
): boolean {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return false;
  return plans.some((plan) => plan.slug === normalized && plan.id !== excludePlanId);
}

export default function PlansPage() {
  const [plans, setPlans] = useState<plans_with_content[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editing, setEditing] = useState<plans_with_content | null>(null);
  const [deleting, setDeleting] = useState<plans_with_content | null>(null);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", status: "all" as "all" | "active" | "inactive" });
  const slugManuallyEditedRef = useRef(false);
  const ITEMS_PER_PAGE = 15;

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch plans");
      setPlans((data.plans || []) as plans_with_content[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPlans();
  }, []);

  const openAdd = () => {
    slugManuallyEditedRef.current = false;
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEdit = (row: plans_with_content) => {
    slugManuallyEditedRef.current = true;
    setEditing(row);
    setForm(planToForm(row));
    setFormErrors({});
    setModalError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setModalError(null);
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.slug.trim()) errors.slug = "Slug is required";
    else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      errors.slug = "Slug must be lowercase kebab-case";
    } else if (isSlugTaken(form.slug, plans, editing?.id)) {
      errors.slug = "A plan with this slug already exists";
    }
    if (Number.isNaN(Number(form.price)) || Number(form.price) < 0) {
      errors.price = "Price must be a non-negative number";
    }
    if (!form.unlimited_bookings) {
      const limit = Number(form.booking_limit);
      if (Number.isNaN(limit) || !Number.isInteger(limit) || limit < 0) {
        errors.booking_limit = "Enter a non-negative whole number, or enable Unlimited";
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setSubmitting(true);
    setModalError(null);
    try {
      const payload = formToPayload(form);
      const url = editing ? `/api/plans/${editing.id}` : "/api/plans";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || "Failed to save");
        return;
      }
      closeModal();
      await fetchPlans();
    } catch (e: unknown) {
      setModalError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!deleting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${deleting.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to deactivate");
      setIsDeleteModalOpen(false);
      setDeleting(null);
      await fetchPlans();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to deactivate");
    } finally {
      setSubmitting(false);
    }
  };

  const updateFeature = (index: number, value: string) => {
    setForm((prev) => {
      const next = [...prev.features];
      next[index] = value;
      return { ...prev, features: next };
    });
  };

  const addFeature = () => {
    setForm((prev) => ({ ...prev, features: [...prev.features, ""] }));
  };

  const removeFeature = (index: number) => {
    setForm((prev) => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const filtered = plans.filter((p) => {
    const matchesSearch = filters.search
      ? p.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        p.slug.toLowerCase().includes(filters.search.toLowerCase())
      : true;
    const matchesStatus =
      filters.status === "all" ||
      (filters.status === "active" && p.is_active) ||
      (filters.status === "inactive" && !p.is_active);
    return matchesSearch && matchesStatus;
  });

  const {
    paginatedItems: paginated,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: totalFiltered,
    handlePageChange,
  } = usePagination(filtered, ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters.search, filters.status, setCurrentPage]);

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1";
  const slugDuplicateWarning =
    form.slug.trim() &&
    !formErrors.slug &&
    isSlugTaken(form.slug, plans, editing?.id)
      ? "A plan with this slug already exists"
      : null;

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugManuallyEditedRef.current ? prev.slug : slugFromName(name),
    }));
    if (formErrors.name) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.name;
        return next;
      });
    }
  };

  const handleSlugChange = (slug: string) => {
    slugManuallyEditedRef.current = true;
    setForm((prev) => ({ ...prev, slug: slug.toLowerCase() }));
    if (formErrors.slug) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next.slug;
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Plans</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage subscription entitlements and upgrade modal marketing content.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="text-sm font-bold text-indigo-600 transition hover:text-indigo-700"
        >
          + Add plan
        </button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">{error}</div>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-slate-100/50 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-1">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full h-9 rounded-md border border-slate-200 px-3 text-sm"
              placeholder="Search by name or slug..."
            />
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  status: e.target.value as "all" | "active" | "inactive",
                }))
              }
              className="h-9 rounded-md border border-slate-200 px-3 text-sm bg-white"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <span className="text-xs text-slate-400">
            {filtered.length} of {plans.length}
          </span>
        </div>
      </section>

      <section className="overflow-hidden">
        {loading ? (
          <PlanTableSkeleton />
        ) : plans.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No plans configured yet.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr className="border border-slate-200">
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Name</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Slug</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Price</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Bookings</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Order</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
                    <th className="px-6 py-4 text-right text-sm font-bold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginated.map((row) => (
                    <tr key={row.id} className="bg-white border border-slate-200 hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900">{row.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-mono">{row.slug}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatInr(row.price)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {formatBookingLimitLabel(row.booking_limit)}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{row.display_order}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
                          >
                            Edit
                          </button>
                          {row.slug !== "free" && row.is_active && (
                            <button
                              type="button"
                              onClick={() => {
                                setDeleting(row);
                                setIsDeleteModalOpen(true);
                              }}
                              className="rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalFiltered}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={handlePageChange}
              loading={loading}
              itemLabel="plans"
            />
          </>
        )}
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-40 flex m-0 justify-end">
          <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={closeModal} />
          <section className="relative h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">
                {editing ? "Edit plan" : "Add plan"}
              </h2>
              <button
                type="button"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
                onClick={closeModal}
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-8">
                {modalError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                    {modalError}
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Entitlements
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>Name *</label>
                      <input
                        className={`${inputClass} ${formErrors.name ? "border-red-500" : ""}`}
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Slug *</label>
                      <input
                        className={`${inputClass} font-mono ${
                          formErrors.slug
                            ? "border-red-500"
                            : slugDuplicateWarning
                              ? "border-amber-400"
                              : ""
                        }`}
                        value={form.slug}
                        disabled={editing?.slug === "free"}
                        onChange={(e) => handleSlugChange(e.target.value)}
                      />
                      {slugDuplicateWarning && (
                        <p className="mt-1 text-sm text-amber-700">{slugDuplicateWarning}</p>
                      )}
                      {formErrors.slug && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.slug}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Price (INR) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={`${inputClass} ${formErrors.price ? "border-red-500" : ""}`}
                        value={form.price}
                        onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <label className="block text-sm font-medium text-slate-700">
                          Booking limit *
                        </label>
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            checked={form.unlimited_bookings}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                unlimited_bookings: e.target.checked,
                                booking_limit: e.target.checked
                                  ? String(UNLIMITED_BOOKING_LIMIT)
                                  : p.booking_limit === String(UNLIMITED_BOOKING_LIMIT)
                                    ? "250"
                                    : p.booking_limit,
                              }))
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                          />
                          Unlimited
                        </label>
                      </div>
                      {!form.unlimited_bookings ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className={`${inputClass} ${formErrors.booking_limit ? "border-red-500" : ""}`}
                          value={
                            form.booking_limit === String(UNLIMITED_BOOKING_LIMIT)
                              ? "250"
                              : form.booking_limit
                          }
                          onChange={(e) =>
                            setForm((p) => ({ ...p, booking_limit: e.target.value }))
                          }
                          placeholder="e.g. 250"
                        />
                      ) : (
                        <p className={`${inputClass} bg-slate-50 text-slate-600`}>
                          No monthly booking cap
                        </p>
                      )}
                      {formErrors.booking_limit && (
                        <p className="mt-1 text-sm text-red-600">{formErrors.booking_limit}</p>
                      )}
                    </div>
                    <div>
                      <label className={labelClass}>Workspace limit</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={form.workspace_limit}
                        onChange={(e) => setForm((p) => ({ ...p, workspace_limit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Admin limit</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={form.admin_limit}
                        onChange={(e) => setForm((p) => ({ ...p, admin_limit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Included service providers</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={inputClass}
                        value={form.service_provider_limit}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, service_provider_limit: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Extra provider seat price (INR/mo)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={inputClass}
                        value={form.extra_service_provider_seat_price}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            extra_service_provider_seat_price: e.target.value,
                          }))
                        }
                        placeholder="e.g. 10"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Charged per provider above the included limit during upgrade.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Billing interval</label>
                      <input
                        className={inputClass}
                        value={form.billing_interval}
                        placeholder="month"
                        onChange={(e) => setForm((p) => ({ ...p, billing_interval: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Display order</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={form.display_order}
                        onChange={(e) => setForm((p) => ({ ...p, display_order: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ["is_active", "Active"],
                        ["google_calendar_sync", "Google Calendar sync"],
                        ["email_notifications", "Email notifications"],
                        ["public_booking_page", "Public booking page"],
                        ["whatsapp_automation", "WhatsApp automation"],
                        ["online_payments", "Online payments"],
                        ["additional_locations", "Multiple locations"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={form[key]}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, [key]: e.target.checked }))
                          }
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 border-t border-slate-200 pt-6">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Marketing content (upgrade modal)
                  </h3>
                  <div>
                    <label className={labelClass}>Subtitle</label>
                    <input
                      className={inputClass}
                      value={form.subtitle}
                      placeholder="For growing service teams."
                      onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Feature bullets</label>
                    <div className="space-y-2">
                      {form.features.map((feature, index) => (
                        <div key={index} className="flex gap-2">
                          <input
                            className={inputClass}
                            value={feature}
                            placeholder="Unlimited bookings"
                            onChange={(e) => updateFeature(index, e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => removeFeature(index)}
                            className="shrink-0 px-3 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addFeature}
                        className="text-sm font-medium text-indigo-600"
                      >
                        + Add feature
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={labelClass}>CTA label</label>
                      <input
                        className={inputClass}
                        value={form.cta_label}
                        placeholder="Continue with Professional"
                        onChange={(e) => setForm((p) => ({ ...p, cta_label: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>CTA variant</label>
                      <select
                        className={inputClass}
                        value={form.cta_variant}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            cta_variant: e.target.value as plan_cta_variant,
                          }))
                        }
                      >
                        <option value="primary">Primary (indigo)</option>
                        <option value="dark">Dark (slate)</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Badge label</label>
                      <input
                        className={inputClass}
                        value={form.badge_label}
                        placeholder="Most Popular"
                        onChange={(e) => setForm((p) => ({ ...p, badge_label: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Content display order</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={form.content_display_order}
                        onChange={(e) =>
                          setForm((p) => ({ ...p, content_display_order: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={form.is_highlighted}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, is_highlighted: e.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                    Highlight card (Most Popular styling)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-slate-100 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? "Saving…" : editing ? "Update plan" : "Create plan"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}

      {isDeleteModalOpen && deleting && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Deactivate plan</h2>
            <p className="text-slate-700 mb-4">
              Deactivate <strong>{deleting.name}</strong>? Existing subscriptions are kept; the
              plan will no longer appear in the catalog.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleting(null);
                }}
                className="px-4 py-2 bg-slate-100 rounded-lg"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeactivateConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? "Deactivating…" : "Deactivate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
