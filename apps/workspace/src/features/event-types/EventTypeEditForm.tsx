"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { EventTypeSkeleton } from "@/src/components/ui/EventTypeSkeleton";
import {
  EventTypeFormLayout,
  parse_location_types_from_storage,
  serialize_location_types,
  split_duration_minutes,
  total_duration_minutes,
  type event_type_form_state,
  type event_type_service_provider_option,
} from "@/src/features/event-types/EventTypeFormLayout";
import {
  check_event_type_slug_available,
  parse_short_description_from_settings,
  validate_event_type_slug_input,
} from "@/src/features/event-types/event_type_slug";
import { parse_event_type_status } from "@/src/features/event-types/event_type_status";
import {
  ROLE_MANAGER,
  ROLE_SERVICE_PROVIDER,
  ROLE_WORKSPACE_ADMIN,
} from "@/src/constants/roles";
import {
  userActsAsServiceProviderFromMetadata,
  userActsAsServiceProviderFromSupabaseUser,
} from "@/lib/service_provider_role";
import { useServiceProviders } from "@/src/hooks/useBookingLookups";
import {
  capitalize_booking_display_label,
  getServiceProviderName,
} from "@/src/utils/booking";

type event_type_record = {
  id: number;
  title: string;
  slug: string | null;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  location_type: string | null;
  is_public: boolean | null;
  status?: string | null;
  owner_id?: string | null;
  settings?: unknown;
};

type load_state =
  | { status: "loading" }
  | { status: "ready"; item: event_type_record }
  | { status: "not_found" }
  | { status: "error"; message: string };

type EventTypeEditFormProps = {
  eventTypeId: number;
  embedded?: boolean;
  variant?: "page" | "panel";
  onClose?: () => void;
};

export function EventTypeEditForm({
  eventTypeId,
  embedded = false,
  variant = "page",
  onClose,
}: EventTypeEditFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const user_role =
    typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : "";
  const can_assign_event_type_owner =
    user_role === ROLE_WORKSPACE_ADMIN || user_role === ROLE_MANAGER;

  const [load_state, set_load_state] = useState<load_state>({ status: "loading" });
  const [form, setForm] = useState<event_type_form_state>({
    title: "",
    slug: "",
    short_description: "",
    duration_hours: "",
    duration_minutes_part: "",
    buffer_before: "",
    buffer_after: "",
    location_types: [],
    is_public: false,
    status: "active",
    service_provider_id: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [slug_error, set_slug_error] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serviceProviderOwnerIds, setServiceProviderOwnerIds] = useState<Set<string>>(
    () => new Set()
  );
  const submitInFlightRef = useRef(false);

  const { data: serviceProviders, loading: service_providers_loading } =
    useServiceProviders();

  const logged_in_user_acts_as_service_provider = useMemo(() => {
    if (!user?.id) return false;
    if (userActsAsServiceProviderFromSupabaseUser(user)) return true;
    return serviceProviders.some((provider) => provider.id === user.id);
  }, [user, serviceProviders]);

  const logged_in_user_display_name = useMemo(() => {
    if (!user?.id) return "";
    const from_roster = capitalize_booking_display_label(
      getServiceProviderName(user.id, serviceProviders)
    );
    if (from_roster !== "N/A") return from_roster;
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    const name = typeof meta?.name === "string" ? meta.name.trim() : "";
    const full_name =
      typeof meta?.full_name === "string" ? meta.full_name.trim() : "";
    if (full_name) return capitalize_booking_display_label(full_name);
    if (name) return capitalize_booking_display_label(name);
    const email_prefix = user.email?.split("@")[0]?.trim();
    return email_prefix
      ? capitalize_booking_display_label(email_prefix)
      : "Current user";
  }, [user, serviceProviders]);

  const event_type_self_assign_option = useMemo(() => {
    if (logged_in_user_acts_as_service_provider) return null;
    if (!logged_in_user_display_name) return null;
    return { label: logged_in_user_display_name };
  }, [logged_in_user_acts_as_service_provider, logged_in_user_display_name]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const load_event_type = async () => {
      set_load_state({ status: "loading" });
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) {
          if (!cancelled) {
            set_load_state({ status: "error", message: "Not authenticated" });
          }
          return;
        }

        const response = await fetch(`/api/event-types/${eventTypeId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.status === 404) {
          if (!cancelled) set_load_state({ status: "not_found" });
          return;
        }

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (!cancelled) {
            set_load_state({
              status: "error",
              message:
                typeof body?.error === "string"
                  ? body.error
                  : "Failed to load event type",
            });
          }
          return;
        }

        const result = await response.json();
        const item = result.data as event_type_record | undefined;
        if (!item || cancelled) {
          if (!cancelled) set_load_state({ status: "not_found" });
          return;
        }

        const { duration_hours, duration_minutes_part } = split_duration_minutes(
          item.duration_minutes ?? undefined
        );

        if (!cancelled) {
          setForm({
            title: item.title,
            slug: item.slug ?? "",
            short_description: parse_short_description_from_settings(item.settings),
            duration_hours,
            duration_minutes_part,
            buffer_before: item.buffer_before?.toString() || "",
            buffer_after: item.buffer_after?.toString() || "",
            location_types: parse_location_types_from_storage(item.location_type),
            is_public: item.is_public || false,
            status: parse_event_type_status(item.status),
            service_provider_id: "",
          });
          set_load_state({ status: "ready", item });
        }
      } catch (err) {
        console.error("Error loading event type:", err);
        if (!cancelled) {
          set_load_state({
            status: "error",
            message: "Failed to load event type",
          });
        }
      }
    };

    load_event_type();
    return () => {
      cancelled = true;
    };
  }, [user, eventTypeId]);

  useEffect(() => {
    if (!user) {
      setServiceProviderOwnerIds(new Set());
      return;
    }

    let cancelled = false;

    const load_team_members = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;

        const response = await fetch("/api/team-members", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!response.ok || cancelled) return;

        const data = await response.json();
        const service_provider_ids = new Set<string>();

        for (const member of (data.teamMembers || []) as Array<{
          id?: string;
          role?: string | null;
          is_workspace_owner?: boolean;
          additional_roles?: string[] | null;
        }>) {
          const acts_as_service_provider = Boolean(
            member.id &&
              userActsAsServiceProviderFromMetadata({
                role: member.role,
                is_workspace_owner: member.is_workspace_owner,
                additional_roles: member.additional_roles,
              })
          );
          if (acts_as_service_provider && member.id) {
            service_provider_ids.add(member.id);
          }
        }

        if (user?.user_metadata?.role === ROLE_SERVICE_PROVIDER && user.id) {
          service_provider_ids.add(user.id);
        }

        if (!cancelled) {
          setServiceProviderOwnerIds(service_provider_ids);
        }
      } catch (err) {
        console.error("Error loading team members:", err);
      }
    };

    load_team_members();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (load_state.status !== "ready") return;
    const owner_id = load_state.item.owner_id;
    setForm((prev) => ({
      ...prev,
      service_provider_id:
        owner_id && serviceProviderOwnerIds.has(owner_id) ? owner_id : "",
    }));
  }, [load_state, serviceProviderOwnerIds]);

  const active_service_providers = useMemo(
    () => serviceProviders.filter((provider) => !provider.deactivated),
    [serviceProviders]
  );

  const event_type_service_provider_options = useMemo((): event_type_service_provider_option[] => {
    const active_options = active_service_providers.map((provider) => ({
      id: provider.id,
      label: capitalize_booking_display_label(
        getServiceProviderName(provider.id, serviceProviders)
      ),
    }));

    const selected_id = form.service_provider_id.trim();
    if (
      !selected_id ||
      active_options.some((option) => option.id === selected_id)
    ) {
      return active_options;
    }

    const selected_provider = serviceProviders.find(
      (provider) => provider.id === selected_id
    );
    if (!selected_provider) return active_options;

    return [
      ...active_options,
      {
        id: selected_provider.id,
        label: `${capitalize_booking_display_label(
          getServiceProviderName(selected_provider.id, serviceProviders)
        )} (Inactive)`,
      },
    ];
  }, [active_service_providers, form.service_provider_id, serviceProviders]);

  const verify_slug = async (
    accessToken: string,
    slug: string
  ): Promise<string | null> => {
    const parsed = validate_event_type_slug_input(slug);
    if (!parsed.ok) {
      set_slug_error(parsed.message);
      return null;
    }
    const result = await check_event_type_slug_available(
      accessToken,
      parsed.value,
      eventTypeId
    );
    if (!result.available) {
      set_slug_error(result.message ?? "This URL slug is already in use.");
      return null;
    }
    set_slug_error(null);
    return parsed.value;
  };

  const handle_slug_blur = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token || !form.slug.trim()) return;
    await verify_slug(session.access_token, form.slug);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSuccessMessage(null);

    if (!form.title.trim()) return;

    const durationMinutes = total_duration_minutes(
      form.duration_hours,
      form.duration_minutes_part
    );
    if (durationMinutes < 1) {
      setFormError(
        "Duration must be at least 1 minute (set hours and/or minutes)."
      );
      return;
    }

    const {
      data: { session: precheckSession },
    } = await supabase.auth.getSession();
    if (!precheckSession?.access_token) {
      setFormError("You are not signed in. Please refresh and try again.");
      return;
    }

    const normalized_slug = await verify_slug(precheckSession.access_token, form.slug);
    if (!normalized_slug) return;

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);

    let succeeded = false;
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFormError("You are not signed in. Please refresh and try again.");
        return;
      }

      const payload = {
        id: eventTypeId,
        title: form.title,
        slug: normalized_slug,
        short_description: form.short_description.trim() || null,
        duration_minutes: durationMinutes,
        buffer_before: form.buffer_before || null,
        buffer_after: form.buffer_after || null,
        location_type: serialize_location_types(form.location_types),
        is_public: form.is_public,
        status: form.status,
        ...(can_assign_event_type_owner && {
          owner_id: form.service_provider_id.trim() || null,
        }),
      };

      const response = await fetch("/api/event-types", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        const message =
          typeof error?.error === "string"
            ? error.error
            : "Could not update event type.";
        if (message.toLowerCase().includes("slug")) {
          set_slug_error(message);
        } else {
          setFormError(message);
        }
        return;
      }

      succeeded = true;
      if (onClose) {
        onClose();
      } else {
        setSuccessMessage("Event type updated successfully.");
        setTimeout(() => {
          router.push("/event-type");
        }, 1200);
      }
    } catch (err) {
      console.error("Error:", err);
      setFormError("Something went wrong. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      // Keep the submit button disabled while the success message shows and we
      // redirect, so the form cannot be submitted again.
      if (!succeeded) setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onClose) {
      onClose();
    } else {
      router.push("/event-type");
    }
  };

  const wrapper_class = embedded
    ? "flex h-full min-h-0 flex-col"
    : "mr-auto space-y-6 rounded-2xl";

  if (load_state.status === "loading") {
    return (
      <div className={wrapper_class}>
        <EventTypeSkeleton variant={embedded ? "panel" : "page"} />
      </div>
    );
  }

  if (load_state.status === "not_found") {
    return (
      <div className={wrapper_class}>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-base font-bold text-slate-900">Event type not found</h2>
          <p className="mt-2 text-sm text-slate-500">
            This event type may have been deleted or you do not have access.
          </p>
          <button
            type="button"
            onClick={handleCancel}
            className="mt-4 inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  if (load_state.status === "error") {
    return (
      <div className={wrapper_class}>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
          {load_state.message}
        </div>
      </div>
    );
  }

  return (
    <div className={wrapper_class}>
      <EventTypeFormLayout
        value={form}
        onChange={(next) => {
          setForm(next);
          if (formError) setFormError(null);
          if (slug_error) set_slug_error(null);
        }}
        editingId={eventTypeId}
        formError={formError}
        successMessage={successMessage}
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        show_service_provider_field={can_assign_event_type_owner}
        service_provider_options={event_type_service_provider_options}
        service_providers_loading={service_providers_loading}
        self_assign_option={event_type_self_assign_option}
        variant={variant}
        slug_error={slug_error}
        on_slug_blur={() => void handle_slug_blur()}
      />
    </div>
  );
}
