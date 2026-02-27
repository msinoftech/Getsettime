"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { type Booking, BOOKING_STATUSES } from "@/src/types/booking";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { useEventTypes, useDepartments, useServices, useServiceProviders } from "@/src/hooks/useBookingLookups";
import { formatDateTimeLocal } from "@/src/utils/date";
import { normalizeIntakeForm } from "@/src/utils/intakeForm";

interface BookingFormProps {
  booking?: Booking | null;
  onSave: () => void;
  onCancel: () => void;
}

const BookingForm = ({ booking, onSave, onCancel }: BookingFormProps) => {
  const { settings } = useWorkspaceSettings();
  const { data: eventTypes, loading: loadingEventTypes } = useEventTypes();
  const { data: departments, loading: loadingDepartments } = useDepartments();
  const { data: serviceProviders, loading: loadingServiceProviders } =
    useServiceProviders();
  const { data: services } = useServices();

  const intakeFormSettings = useMemo(
    () => normalizeIntakeForm(settings?.intake_form),
    [settings?.intake_form]
  );

  const [formData, setFormData] = useState({
    invitee_name: "",
    invitee_email: "",
    invitee_phone: "",
    start_at: "",
    end_at: "",
    status: "pending",
    event_type_id: "",
    department_id: "",
    service_provider_id: "",
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<
    Record<string, string | number | string[]>
  >({});
  const [additionalDescription, setAdditionalDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allowedServices = useMemo(() => {
    if (!intakeFormSettings?.services?.enabled) return [];
    const ids = intakeFormSettings.services.allowed_service_ids;
    return ids.length === 0
      ? services
      : services.filter((s) => ids.includes(s.id));
  }, [intakeFormSettings?.services, services]);

  useEffect(() => {
    if (booking) {
      setFormData({
        invitee_name: booking.invitee_name || "",
        invitee_email: booking.invitee_email || "",
        invitee_phone: booking.invitee_phone || "",
        start_at: formatDateTimeLocal(booking.start_at),
        end_at: formatDateTimeLocal(booking.end_at),
        status: booking.status || "pending",
        event_type_id: booking.event_type_id || "",
        department_id: booking.department_id || "",
        service_provider_id: booking.service_provider_id || "",
      });

      const intakeForm = booking.metadata?.intake_form as
        | Record<string, unknown>
        | undefined;
      if (intakeForm) {
        if (Array.isArray(intakeForm.services)) {
          setSelectedServices(intakeForm.services as string[]);
        }
        const notes = intakeForm.additional_description as string | undefined;
        const legacyNotes = booking.metadata?.notes as string | undefined;
        setAdditionalDescription(notes || legacyNotes || "");

        const customValues: Record<string, string | number | string[]> = {};
        intakeFormSettings?.custom_fields?.forEach((field) => {
          const value = intakeForm[field.id];
          if (value !== undefined && value !== null) {
            customValues[field.id] = value as string | number | string[];
          }
        });
        setCustomFieldValues(customValues);
      } else {
        setSelectedServices([]);
        setCustomFieldValues({});
        setAdditionalDescription(
          (booking.metadata?.notes as string | undefined) || ""
        );
      }
    } else {
      setSelectedServices([]);
      setCustomFieldValues({});
      setAdditionalDescription("");
    }
  }, [booking, intakeFormSettings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error("Not authenticated");
        }

        const url = "/api/bookings";
        const method = booking ? "PATCH" : "POST";

        const submitData = {
          ...formData,
          start_at: formData.start_at
            ? new Date(formData.start_at).toISOString()
            : null,
          end_at: formData.end_at
            ? new Date(formData.end_at).toISOString()
            : null,
          event_type_id: formData.event_type_id || null,
          department_id: formData.department_id || null,
          service_provider_id: formData.service_provider_id || null,
        };

        const intakeFormData: Record<string, unknown> = {};
        if (
          intakeFormSettings?.services?.enabled &&
          selectedServices.length > 0
        ) {
          intakeFormData.services = selectedServices;
        }
        if (
          (intakeFormSettings === null ||
            intakeFormSettings.additional_description === true) &&
          additionalDescription.trim()
        ) {
          intakeFormData.additional_description = additionalDescription.trim();
        }
        if (intakeFormSettings?.custom_fields) {
          intakeFormSettings.custom_fields.forEach((field) => {
            const value = customFieldValues[field.id];
            if (
              value !== undefined &&
              value !== null &&
              value !== ""
            ) {
              intakeFormData[field.id] = value;
            }
          });
        }

        const existingMetadata = booking?.metadata || {};
        const metadataPayload: Record<string, unknown> = { ...existingMetadata };
        if (
          (intakeFormSettings === null ||
            intakeFormSettings.additional_description === true) &&
          additionalDescription.trim()
        ) {
          metadataPayload.notes = additionalDescription.trim();
        }
        if (Object.keys(intakeFormData).length > 0) {
          metadataPayload.intake_form = {
            ...(existingMetadata.intake_form as Record<string, unknown> || {}),
            ...intakeFormData,
          };
        }

        const body = booking
          ? { id: booking.id, ...submitData, metadata: metadataPayload }
          : { ...submitData, metadata: metadataPayload };

        const response = await fetch(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to save booking");
        }

        onSave();
      } catch (err) {
        setError((err as Error).message || "An error occurred");
      } finally {
        setLoading(false);
      }
    },
    [
      formData,
      booking,
      intakeFormSettings,
      selectedServices,
      additionalDescription,
      customFieldValues,
      onSave,
    ]
  );

  const updateFormField = useCallback(
    <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70"
    >
      {error && (
        <div className="md:col-span-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {(intakeFormSettings === null || intakeFormSettings.name !== false) && (
        <div>
          <label
            htmlFor="invitee_name"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Invitee Name *
          </label>
          <input
            id="invitee_name"
            type="text"
            value={formData.invitee_name}
            onChange={(e) => updateFormField("invitee_name", e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            required
          />
        </div>
      )}

      {(intakeFormSettings === null || intakeFormSettings.email !== false) && (
        <div>
          <label
            htmlFor="invitee_email"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Invitee Email
          </label>
          <input
            id="invitee_email"
            type="email"
            value={formData.invitee_email}
            onChange={(e) => updateFormField("invitee_email", e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      )}

      {intakeFormSettings?.phone === true && (
        <div>
          <label
            htmlFor="invitee_phone"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Invitee Phone
          </label>
          <input
            id="invitee_phone"
            type="tel"
            value={formData.invitee_phone}
            onChange={(e) => updateFormField("invitee_phone", e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      )}

      <div>
        <label
          htmlFor="status"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Status
        </label>
        <select
          id="status"
          value={formData.status}
          onChange={(e) => updateFormField("status", e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          {BOOKING_STATUSES.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="start_at"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Start Time *
        </label>
        <input
          id="start_at"
          type="datetime-local"
          value={formData.start_at}
          onChange={(e) => updateFormField("start_at", e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          required
        />
      </div>

      <div>
        <label
          htmlFor="end_at"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          End Time
        </label>
        <input
          id="end_at"
          type="datetime-local"
          value={formData.end_at}
          onChange={(e) => updateFormField("end_at", e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="event_type_id"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Event Type
        </label>
        <select
          id="event_type_id"
          value={formData.event_type_id}
          onChange={(e) => updateFormField("event_type_id", e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingEventTypes}
        >
          <option value="">Select an event type (Optional)</option>
          {eventTypes.map((eventType) => (
            <option key={eventType.id} value={eventType.id}>
              {eventType.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="department_id"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Department (Optional)
        </label>
        <select
          id="department_id"
          value={formData.department_id}
          onChange={(e) => updateFormField("department_id", e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingDepartments}
        >
          <option value="">Select</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="service_provider_id"
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          Service Provider (Optional)
        </label>
        <select
          id="service_provider_id"
          value={formData.service_provider_id}
          onChange={(e) =>
            updateFormField("service_provider_id", e.target.value)
          }
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
          disabled={loadingServiceProviders}
        >
          <option value="">Select</option>
          {serviceProviders.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.raw_user_meta_data?.full_name ||
                provider.raw_user_meta_data?.name ||
                provider.email}
            </option>
          ))}
        </select>
      </div>

      {intakeFormSettings?.services?.enabled && (
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Services{" "}
            {intakeFormSettings.services.allowed_service_ids.length > 0 &&
              "(Select from allowed services)"}
          </label>
          <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-slate-300 bg-white min-h-[60px]">
            {allowedServices.map((service) => {
              const isSelected = selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedServices((prev) =>
                        prev.filter((id) => id !== service.id)
                      );
                    } else {
                      setSelectedServices((prev) => [...prev, service.id]);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    isSelected
                      ? "bg-indigo-600 text-white border border-indigo-700"
                      : "bg-white text-slate-700 border border-slate-300 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  {isSelected ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  )}
                  <span>{service.name}</span>
                </button>
              );
            })}
            {allowedServices.length === 0 && (
              <p className="text-sm text-slate-500 italic">No services available</p>
            )}
          </div>
        </div>
      )}

      {(intakeFormSettings === null ||
        intakeFormSettings.additional_description === true) && (
        <div className="md:col-span-2">
          <label
            htmlFor="additional_description"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            Additional Information
          </label>
          <textarea
            id="additional_description"
            value={additionalDescription}
            onChange={(e) => setAdditionalDescription(e.target.value)}
            placeholder="Enter any additional notes or information..."
            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
            rows={4}
          />
        </div>
      )}

      {intakeFormSettings?.custom_fields &&
        intakeFormSettings.custom_fields.length > 0 && (
          <>
            {intakeFormSettings.custom_fields.map((field) => {
              const value = customFieldValues[field.id] || "";
              const isRequired = field.required;

              return (
                <div
                  key={field.id}
                  className={
                    (field.field_type ?? "text") === "textarea"
                      ? "md:col-span-2"
                      : ""
                  }
                >
                  <label
                    htmlFor={`custom_${field.id}`}
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    {field.label} {isRequired && <span className="text-red-500">*</span>}
                  </label>
                  {(field.field_type ?? "text") === "textarea" ? (
                    <textarea
                      id={`custom_${field.id}`}
                      value={String(value)}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                      required={isRequired}
                      rows={4}
                    />
                  ) : (
                    <input
                      id={`custom_${field.id}`}
                      type={
                        field.field_type === "number"
                          ? "number"
                          : field.field_type === "email"
                            ? "email"
                            : field.field_type === "tel"
                              ? "tel"
                              : field.field_type === "url"
                                ? "url"
                                : "text"
                      }
                      value={String(value)}
                      onChange={(e) => {
                        const newValue =
                          field.field_type === "number"
                            ? e.target.value === ""
                              ? ""
                              : Number(e.target.value)
                            : e.target.value;
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [field.id]: newValue,
                        }));
                      }}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                      required={isRequired}
                    />
                  )}
                </div>
              );
            })}
          </>
        )}

      <div className="md:col-span-2 flex justify-end gap-2 mt-2">
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium disabled:opacity-50"
        >
          {loading ? "Saving..." : booking ? "Update Booking" : "Create Booking"}
        </button>
      </div>
    </form>
  );
};

export default BookingForm;
