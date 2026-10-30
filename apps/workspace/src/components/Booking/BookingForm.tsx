"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { type Booking, BOOKING_STATUSES } from "@/src/types/booking";
import { supabase } from "@/lib/supabaseClient";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { useEventTypes, useDepartments, useServices, useServiceProviders } from "@/src/hooks/useBookingLookups";
import { formatDateTimeLocal } from "@/src/utils/date";
import { normalizeIntakeForm } from "@/src/utils/intakeForm";
import { BookingDetailDatetimeModal } from "@/src/components/Booking/BookingDetailDatetimeModal";
import { DateTimePicker } from "@/src/components/molecules/DateTimePicker";
import { now_datetime_local } from "@/src/features/event-types/event_type_availability";
import { map_event_types_for_booking_flow } from "@/src/features/booking-flow";
import {
  BookingFormSubmitError,
  throw_if_booking_api_error,
} from "@/src/utils/bookingFormDuplicateInvitee";
import { toast } from "@/src/components/ui/toast";
import type { EventType as BookingFormEventType } from "@/src/types/bookingForm";
import type { Department, ServiceProvider } from "@/src/types/booking-entities";
import {
  eventTypeAssignedDepartmentId,
  eventTypeAssignedProviderIds,
  isDepartmentAssignedToEventType,
  isProviderAssignedToEventType,
  providerAssignedToDepartment,
} from "@/src/utils/bookingFormUtils";

const SELECT_CLASS =
  "w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none";
const SELECT_INVALID_CLASS =
  "w-full px-4 py-2 rounded-lg border border-amber-400 focus:ring-2 focus:ring-amber-500 outline-none";

function include_current_option<T extends { id: string | number }>(
  compatible: T[],
  all: T[],
  current_id: string
): T[] {
  if (!current_id) return compatible;
  if (compatible.some((row) => String(row.id) === current_id)) return compatible;
  const current = all.find((row) => String(row.id) === current_id);
  return current ? [current, ...compatible] : compatible;
}

function department_option_label(
  department: Department,
  compatible_ids: Set<string>,
  event_type_selected: boolean
): string {
  if (!event_type_selected || compatible_ids.has(String(department.id))) {
    return department.name;
  }
  return `${department.name} — not available for this Event Type`;
}

function provider_option_label(
  provider: ServiceProvider,
  compatible_ids: Set<string>,
  event_type_selected: boolean
): string {
  const name =
    provider.raw_user_meta_data?.full_name ||
    provider.raw_user_meta_data?.name ||
    provider.email;
  if (!event_type_selected || compatible_ids.has(provider.id)) {
    return name;
  }
  return `${name} — not available for this Event Type`;
}

const CANCELLED_STATUS_OPTIONS = BOOKING_STATUSES.filter(
  (s) => s.value === "cancelled" || s.value === "reschedule"
);

const DEFAULT_EVENT_DURATION_MINUTES = 30;

/** Add minutes to a datetime-local value and return the same input format. */
function end_at_from_start(
  start_local: string,
  duration_minutes: number
): string {
  if (!start_local) return "";
  const start = new Date(start_local);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start.getTime() + duration_minutes * 60_000);
  return formatDateTimeLocal(end.toISOString());
}

function parse_datetime_local(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function booking_span_minutes(
  start_local: string,
  end_local: string
): number | null {
  const start = parse_datetime_local(start_local);
  const end = parse_datetime_local(end_local);
  if (!start || !end) return null;
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

interface BookingFormProps {
  booking?: Booking | null;
  onSave: () => void;
  onCancel: () => void;
  onRescheduleStart?: () => void;
}

const BookingForm = ({
  booking,
  onSave,
  onCancel,
  onRescheduleStart,
}: BookingFormProps) => {
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
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleDuplicatePreviewPath, setRescheduleDuplicatePreviewPath] =
    useState<string | null>(null);
  const [datetimeNeedsReview, setDatetimeNeedsReview] = useState(false);
  const [datetimeModalOpen, setDatetimeModalOpen] = useState(false);
  const [seriesScope, setSeriesScope] = useState<'this' | 'series'>('this');
  const errorRef = useRef<HTMLDivElement | null>(null);
  const warningRef = useRef<HTMLDivElement | null>(null);

  const isCancelledBooking = booking?.status === "cancelled";
  const statusOptions = isCancelledBooking
    ? CANCELLED_STATUS_OPTIONS
    : BOOKING_STATUSES;

  const general = settings?.general as Record<string, unknown> | undefined;
  const workspaceTimezone =
    typeof general?.timezone === "string" && general.timezone.trim()
      ? general.timezone.trim()
      : null;
  const workspacePrimaryColor =
    typeof general?.primary_color === "string"
      ? general.primary_color
      : "#4f46e5";
  const workspaceAccentColor =
    typeof general?.accent_color === "string" ? general.accent_color : null;

  const rescheduleEventTypes = useMemo<BookingFormEventType[]>(
    () => map_event_types_for_booking_flow(eventTypes),
    [eventTypes]
  );

  const useEventTypeAwarePicker = Boolean(booking && formData.event_type_id);

  const pickerBooking = useMemo((): Booking | null => {
    if (!booking) return null;
    const original_start_local = formatDateTimeLocal(booking.start_at);
    const original_end_local = formatDateTimeLocal(booking.end_at);
    const start_unchanged =
      !formData.start_at || formData.start_at === original_start_local;
    const end_unchanged =
      !formData.end_at || formData.end_at === original_end_local;
    return {
      ...booking,
      event_type_id: formData.event_type_id || booking.event_type_id,
      department_id: formData.department_id || booking.department_id,
      service_provider_id:
        formData.service_provider_id || booking.service_provider_id,
      invitee_email: formData.invitee_email || booking.invitee_email,
      invitee_phone: formData.invitee_phone || booking.invitee_phone,
      start_at: start_unchanged
        ? booking.start_at
        : formData.start_at
          ? new Date(formData.start_at).toISOString()
          : booking.start_at,
      end_at: end_unchanged
        ? booking.end_at
        : formData.end_at
          ? new Date(formData.end_at).toISOString()
          : booking.end_at,
    };
  }, [
    booking,
    formData.event_type_id,
    formData.department_id,
    formData.service_provider_id,
    formData.invitee_email,
    formData.invitee_phone,
    formData.start_at,
    formData.end_at,
  ]);

  useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const allowedServices = useMemo(() => {
    if (!intakeFormSettings?.services?.enabled) return [];
    const ids = intakeFormSettings.services.allowed_service_ids;
    return ids.length === 0
      ? services
      : services.filter((s) => ids.includes(s.id));
  }, [intakeFormSettings?.services, services]);

  useEffect(() => {
    setDatetimeNeedsReview(false);
    setSeriesScope('this');
  }, [booking?.id]);

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

  const selectedEventType = useMemo(
    () =>
      eventTypes.find(
        (eventType) => String(eventType.id) === String(formData.event_type_id)
      ) ?? null,
    [eventTypes, formData.event_type_id]
  );

  const assignedDepartmentId = useMemo(
    () => eventTypeAssignedDepartmentId(selectedEventType),
    [selectedEventType]
  );
  const assignedProviderIds = useMemo(
    () => eventTypeAssignedProviderIds(selectedEventType),
    [selectedEventType]
  );

  const compatibleDepartments = useMemo(() => {
    if (!selectedEventType || !assignedDepartmentId) return departments;
    return departments.filter(
      (department) => String(department.id) === assignedDepartmentId
    );
  }, [assignedDepartmentId, departments, selectedEventType]);

  const departmentIsCompatible = useMemo(
    () =>
      !formData.department_id ||
      isDepartmentAssignedToEventType(formData.department_id, selectedEventType),
    [formData.department_id, selectedEventType]
  );

  const compatibleProviders = useMemo(() => {
    let list = serviceProviders.filter((provider) => !provider.deactivated);
    if (selectedEventType && assignedProviderIds.length > 0) {
      const allow = new Set(assignedProviderIds);
      list = list.filter((provider) => allow.has(provider.id));
    }
    if (formData.department_id && departmentIsCompatible) {
      list = list.filter((provider) =>
        providerAssignedToDepartment(provider, formData.department_id)
      );
    }
    return list;
  }, [
    assignedProviderIds,
    departmentIsCompatible,
    formData.department_id,
    selectedEventType,
    serviceProviders,
  ]);

  const departmentOptions = useMemo(
    () =>
      include_current_option(
        compatibleDepartments,
        departments,
        formData.department_id
      ),
    [compatibleDepartments, departments, formData.department_id]
  );

  const providerOptions = useMemo(
    () =>
      include_current_option(
        compatibleProviders,
        serviceProviders,
        formData.service_provider_id
      ),
    [compatibleProviders, formData.service_provider_id, serviceProviders]
  );

  const compatibleDepartmentIds = useMemo(
    () => new Set(compatibleDepartments.map((department) => String(department.id))),
    [compatibleDepartments]
  );
  const compatibleProviderIds = useMemo(
    () => new Set(compatibleProviders.map((provider) => provider.id)),
    [compatibleProviders]
  );

  const eventTypeChangedFromSaved = Boolean(
    booking &&
      String(formData.event_type_id || "") !== String(booking.event_type_id || "")
  );
  const shouldFlagEventTypeSync = !booking || eventTypeChangedFromSaved;

  const departmentInvalid = Boolean(
    shouldFlagEventTypeSync &&
      selectedEventType &&
      formData.department_id &&
      !compatibleDepartmentIds.has(String(formData.department_id))
  );

  const providerInvalid = Boolean(
    shouldFlagEventTypeSync &&
      selectedEventType &&
      formData.service_provider_id &&
      (!isProviderAssignedToEventType(
        formData.service_provider_id,
        selectedEventType
      ) ||
        (formData.department_id &&
          departmentIsCompatible &&
          !providerAssignedToDepartment(
            serviceProviders.find(
              (provider) => provider.id === formData.service_provider_id
            ) ?? { departments: [] },
            formData.department_id
          )))
  );

  const duration_for_event_type = useCallback(
    (event_type_id: string) => {
      const selected = eventTypes.find(
        (eventType) => String(eventType.id) === String(event_type_id)
      );
      const minutes = selected?.duration_minutes;
      if (typeof minutes === "number" && Number.isFinite(minutes) && minutes >= 1) {
        return Math.trunc(minutes);
      }
      return DEFAULT_EVENT_DURATION_MINUTES;
    },
    [eventTypes]
  );

  const eventDurationMinutes = useMemo(
    () => duration_for_event_type(formData.event_type_id),
    [duration_for_event_type, formData.event_type_id]
  );

  const datetimeValidation = useMemo(() => {
    if (!selectedEventType) {
      return {
        start_invalid: false,
        end_invalid: false,
        messages: [] as string[],
      };
    }
    if (booking && !eventTypeChangedFromSaved) {
      return {
        start_invalid: false,
        end_invalid: false,
        messages: [] as string[],
      };
    }
    if (!booking && !formData.start_at) {
      return {
        start_invalid: false,
        end_invalid: false,
        messages: [] as string[],
      };
    }

    const start = parse_datetime_local(formData.start_at);
    const end = parse_datetime_local(formData.end_at);
    const span = booking_span_minutes(formData.start_at, formData.end_at);
    const messages: string[] = [];
    let start_invalid = false;
    let end_invalid = false;

    if (!start) {
      start_invalid = true;
      messages.push("Please select a valid start date and time.");
    }
    if (!end) {
      end_invalid = true;
      messages.push(
        "End date and time could not be calculated for this Event Type."
      );
    }
    if (start && end && end.getTime() <= start.getTime()) {
      start_invalid = true;
      end_invalid = true;
      messages.push(
        "End date and time must be after the start date and time."
      );
    } else if (span != null && span !== eventDurationMinutes) {
      start_invalid = true;
      end_invalid = true;
      messages.push(
        `The booking date and time must be ${eventDurationMinutes} minutes for the selected Event Type. Please choose a new start time.`
      );
    }
    if (datetimeNeedsReview) {
      start_invalid = true;
      end_invalid = true;
      messages.push(
        "The previously selected time slot is no longer available for the selected Event Type."
      );
    }

    return { start_invalid, end_invalid, messages };
  }, [
    datetimeNeedsReview,
    eventDurationMinutes,
    eventTypeChangedFromSaved,
    formData.end_at,
    formData.start_at,
    selectedEventType,
    booking,
  ]);

  const eventTypeSyncWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (departmentInvalid) {
      warnings.push(
        "The selected department is not available for this Event Type. Please choose another department."
      );
    }
    if (providerInvalid) {
      warnings.push(
        "The selected Service Provider is not assigned to this Event Type."
      );
    }
    if (datetimeValidation.messages.length > 0) {
      warnings.push(...datetimeValidation.messages);
    }
    return warnings;
  }, [datetimeValidation.messages, departmentInvalid, providerInvalid]);

  const hasEventTypeSyncIssues = eventTypeSyncWarnings.length > 0;

  useEffect(() => {
    if (eventTypeSyncWarnings.length > 0) {
      warningRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [eventTypeSyncWarnings]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (hasEventTypeSyncIssues) {
        setError(
          "Please choose valid replacements for the highlighted fields before saving."
        );
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const { session } = await getWorkspaceSession();

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
          ? {
              id: booking.id,
              ...submitData,
              metadata: metadataPayload,
              ...(booking.series_id ? { series_scope: seriesScope } : {}),
            }
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

        // The booking row is already persisted at this point; remaining work
        // (notifications, calendar sync, etc.) runs in the background on the server.
        toast.success(
          booking
            ? "Booking updated successfully."
            : "Booking created successfully."
        );
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
      seriesScope,
      intakeFormSettings,
      selectedServices,
      additionalDescription,
      customFieldValues,
      hasEventTypeSyncIssues,
      onSave,
    ]
  );

  const updateFormField = useCallback(
    <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleStartAtChange = useCallback(
    (value: string) => {
      setDatetimeNeedsReview(false);
      setFormData((prev) => {
        const duration = duration_for_event_type(prev.event_type_id);
        const next_end = end_at_from_start(value, duration);
        const previous_start = booking
          ? formatDateTimeLocal(booking.start_at)
          : "";
        const start_changed =
          Boolean(booking) && Boolean(value) && value !== previous_start;

        return {
          ...prev,
          start_at: value,
          end_at: next_end || prev.end_at,
          status: start_changed ? "reschedule" : prev.status,
        };
      });
    },
    [booking, duration_for_event_type]
  );

  const handleEventTypeChange = useCallback(
    (value: string) => {
      const next_type =
        eventTypes.find((eventType) => String(eventType.id) === String(value)) ??
        null;
      const next_duration = duration_for_event_type(value);
      const assigned_department_id = eventTypeAssignedDepartmentId(next_type);
      const assigned_provider_ids = eventTypeAssignedProviderIds(next_type);
      const has_datetime = Boolean(formData.start_at);
      const next_end = formData.start_at
        ? end_at_from_start(formData.start_at, next_duration)
        : formData.end_at;

      const needs_review = Boolean(value) && has_datetime;
      setDatetimeNeedsReview(needs_review);
      if (needs_review && booking) {
        setDatetimeModalOpen(true);
      }

      setFormData((prev) => {
        let next_department_id = prev.department_id;
        if (!next_department_id && assigned_department_id) {
          next_department_id = assigned_department_id;
        }

        let next_provider_id = prev.service_provider_id;
        if (!next_provider_id && assigned_provider_ids.length === 1) {
          next_provider_id = assigned_provider_ids[0];
        }

        return {
          ...prev,
          event_type_id: value,
          end_at: next_end || prev.end_at,
          department_id: next_department_id,
          service_provider_id: next_provider_id,
        };
      });
    },
    [
      booking,
      duration_for_event_type,
      eventTypes,
      formData.end_at,
      formData.start_at,
    ]
  );

  const handleDatetimePickConfirm = useCallback(
    (payload: {
      start_at: string;
      end_at: string;
      status?: string;
      customer_timezone?: string;
      provider_timezone?: string;
    }) => {
      const start_local = formatDateTimeLocal(payload.start_at);
      const end_local = formatDateTimeLocal(payload.end_at);
      setFormData((prev) => {
        const previous_start = booking
          ? formatDateTimeLocal(booking.start_at)
          : "";
        const start_changed =
          Boolean(booking) && Boolean(start_local) && start_local !== previous_start;
        return {
          ...prev,
          start_at: start_local,
          end_at: end_local,
          status: start_changed ? "reschedule" : prev.status,
        };
      });
      setDatetimeNeedsReview(false);
      setDatetimeModalOpen(false);
    },
    [booking]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      if (isCancelledBooking && value === "reschedule") {
        setRescheduleError(null);
        setRescheduleDuplicatePreviewPath(null);
        onRescheduleStart?.();
        setRescheduleModalOpen(true);
        return;
      }
      updateFormField("status", value);
    },
    [isCancelledBooking, onRescheduleStart, updateFormField]
  );

  const handleRescheduleConfirm = useCallback(
    async (payload: {
      start_at: string;
      end_at: string;
      status?: string;
      customer_timezone?: string;
      provider_timezone?: string;
    }) => {
      if (!booking) return;

      setRescheduleSaving(true);
      setRescheduleError(null);
      setRescheduleDuplicatePreviewPath(null);

      try {
        const { session } = await getWorkspaceSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const existingMetadata = booking.metadata ?? {};
        const existingHistory = Array.isArray(existingMetadata.reschedule_history)
          ? existingMetadata.reschedule_history
          : [];
        const metadata = {
          ...existingMetadata,
          was_previously_cancelled: true,
          reschedule_history: [
            ...existingHistory,
            {
              previous_status: "cancelled",
              previous_start_at: booking.start_at,
              previous_end_at: booking.end_at,
              new_start_at: payload.start_at,
              new_end_at: payload.end_at,
              rescheduled_at: new Date().toISOString(),
            },
          ],
        };

        const response = await fetch("/api/bookings", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: booking.id,
            start_at: payload.start_at,
            end_at: payload.end_at,
            status: "reschedule",
            customer_timezone: payload.customer_timezone,
            provider_timezone: payload.provider_timezone,
            metadata,
            ...(booking.series_id ? { series_scope: seriesScope } : {}),
          }),
        });

        const responseData = await response.json().catch(() => ({}));
        throw_if_booking_api_error(
          response,
          responseData,
          "Failed to reschedule booking"
        );

        setRescheduleModalOpen(false);
        onSave();
      } catch (err) {
        if (err instanceof BookingFormSubmitError) {
          setRescheduleError(err.message);
          setRescheduleDuplicatePreviewPath(err.duplicatePreviewPath ?? null);
        } else {
          setRescheduleError(
            err instanceof Error ? err.message : "Failed to reschedule booking"
          );
          setRescheduleDuplicatePreviewPath(null);
        }
      } finally {
        setRescheduleSaving(false);
      }
    },
    [booking, onSave, seriesScope]
  );

  const handleRescheduleClose = useCallback(() => {
    setRescheduleModalOpen(false);
    setRescheduleError(null);
    setRescheduleDuplicatePreviewPath(null);
    onCancel();
  }, [onCancel]);

  return (
    <>
    <form
      onSubmit={handleSubmit}
      className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70"
    >
      {error && (
        <div
          ref={errorRef}
          className="md:col-span-2 p-3 bg-red-100 text-red-700 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {eventTypeSyncWarnings.length > 0 && (
        <div
          ref={warningRef}
          className="md:col-span-2 p-3 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-sm"
          role="alert"
        >
          <p className="font-medium mb-1">
            This Event Type is not fully compatible with the current booking
            details. Update the highlighted fields before saving.
          </p>
          <ul className="list-disc pl-5 space-y-1">
            {eventTypeSyncWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
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
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
        >
          {statusOptions.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Start date & time<span className="text-red-500">*</span>
        </span>
        <DateTimePicker
          id="start_at"
          value={formData.start_at}
          min={useEventTypeAwarePicker ? undefined : now_datetime_local()}
          onChange={
            useEventTypeAwarePicker ? () => undefined : handleStartAtChange
          }
          onTriggerClick={
            useEventTypeAwarePicker
              ? () => setDatetimeModalOpen(true)
              : undefined
          }
          invalid={datetimeValidation.start_invalid}
          error_id="start_at_warning"
        />
        <input
          type="hidden"
          name="start_at"
          value={formData.start_at}
          required
          tabIndex={-1}
          aria-hidden
        />
        {datetimeValidation.start_invalid && (
          <p id="start_at_warning" className="mt-1 text-xs text-amber-700">
            {datetimeValidation.messages[0] ??
              "The previously selected time slot is no longer available for the selected Event Type. Please choose a new start date and time."}
          </p>
        )}
        {useEventTypeAwarePicker && datetimeNeedsReview && (
          <p className="mt-1 text-xs text-amber-700">
            The current date and time may not match this Event Type&apos;s
            availability. Click the field above to pick a valid slot.
          </p>
        )}
        
        {booking?.series_id ? (
          <fieldset className="mt-3">
            <legend className="mb-1 text-xs font-medium text-slate-600">
              Apply changes to
            </legend>
            <label className="mr-4 inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="series_scope"
                checked={seriesScope === 'this'}
                onChange={() => setSeriesScope('this')}
              />
              This occurrence only
            </label>
            <label className="inline-flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="radio"
                name="series_scope"
                checked={seriesScope === 'series'}
                onChange={() => setSeriesScope('series')}
              />
              Entire series
            </label>
          </fieldset>
        ) : null}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-700">
          End date & time
        </span>
        <DateTimePicker
          id="end_at"
          value={formData.end_at}
          onChange={() => undefined}
          disabled
          invalid={datetimeValidation.end_invalid}
          error_id={
            datetimeValidation.end_invalid ? "end_at_warning" : "end_at_hint"
          }
        />
        {datetimeValidation.end_invalid ? (
          <p id="end_at_warning" className="mt-1 text-xs text-amber-700">
            End date and time must match the selected Event Type duration
            {` (${eventDurationMinutes} min)`}. Choose a valid start date and time
            to recalculate the end time.
          </p>
        ) : (
          <p id="end_at_hint" className="mt-1 text-xs text-slate-500">
            {useEventTypeAwarePicker
              ? "Set automatically from the chosen slot and Event Type duration"
              : "Calculated from start time and event type duration"}
            {formData.event_type_id
              ? ` (${duration_for_event_type(formData.event_type_id)} min)`
              : ` (${DEFAULT_EVENT_DURATION_MINUTES} min default)`}
            .
          </p>
        )}
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
          onChange={(e) => handleEventTypeChange(e.target.value)}
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
          className={departmentInvalid ? SELECT_INVALID_CLASS : SELECT_CLASS}
          disabled={loadingDepartments}
          aria-invalid={departmentInvalid}
          aria-describedby={departmentInvalid ? "department_id_warning" : undefined}
        >
          <option value="">Select</option>
          {departmentOptions.map((department) => (
            <option key={department.id} value={department.id}>
              {department_option_label(
                department,
                compatibleDepartmentIds,
                Boolean(selectedEventType)
              )}
            </option>
          ))}
        </select>
        {departmentInvalid && (
          <p id="department_id_warning" className="mt-1 text-xs text-amber-700">
            The selected department is not available for this Event Type. Please
            choose another department.
          </p>
        )}
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
          className={providerInvalid ? SELECT_INVALID_CLASS : SELECT_CLASS}
          disabled={loadingServiceProviders}
          aria-invalid={providerInvalid}
          aria-describedby={
            providerInvalid ? "service_provider_id_warning" : undefined
          }
        >
          <option value="">Select</option>
          {providerOptions.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider_option_label(
                provider,
                compatibleProviderIds,
                Boolean(selectedEventType)
              )}
            </option>
          ))}
        </select>
        {providerInvalid && (
          <p id="service_provider_id_warning" className="mt-1 text-xs text-amber-700">
            The selected Service Provider is not assigned to this Event Type.
          </p>
        )}
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
          disabled={loading || hasEventTypeSyncIssues}
          className="px-5 py-2.5 cursor-pointer rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium disabled:opacity-50"
        >
          {loading
            ? "Saving..."
            : booking
              ? "Update Booking"
              : "Create Booking"}
        </button>
      </div>
    </form>

    {pickerBooking &&
      datetimeModalOpen &&
      typeof document !== "undefined" &&
      createPortal(
        <BookingDetailDatetimeModal
          open={datetimeModalOpen}
          mode="pick_datetime"
          booking={pickerBooking}
          departments={departments as unknown[]}
          eventTypes={rescheduleEventTypes}
          intakeForm={intakeFormSettings}
          workspacePrimaryColor={workspacePrimaryColor}
          workspaceAccentColor={workspaceAccentColor}
          clientTimezone={workspaceTimezone}
          onClose={() => setDatetimeModalOpen(false)}
          onConfirm={handleDatetimePickConfirm}
          saving={false}
        />,
        document.body
      )}
    {booking &&
      rescheduleModalOpen &&
      typeof document !== "undefined" &&
      createPortal(
        <BookingDetailDatetimeModal
          open={rescheduleModalOpen}
          mode="reschedule"
          booking={booking}
          departments={departments as unknown[]}
          eventTypes={rescheduleEventTypes}
          intakeForm={intakeFormSettings}
          workspacePrimaryColor={workspacePrimaryColor}
          workspaceAccentColor={workspaceAccentColor}
          clientTimezone={workspaceTimezone}
          onClose={handleRescheduleClose}
          onConfirm={handleRescheduleConfirm}
          saving={rescheduleSaving}
          saveError={rescheduleError}
          saveDuplicatePreviewPath={rescheduleDuplicatePreviewPath}
        />,
        document.body
      )}
    </>
  );
};

export default BookingForm;
