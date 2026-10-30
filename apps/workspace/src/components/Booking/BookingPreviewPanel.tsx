'use client';

import { getWorkspaceSession } from '@/src/lib/auth_session';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  LuExternalLink as ExternalLink,
  LuLoader as LoaderIcon,
  LuX as X,
} from 'react-icons/lu';
import { supabase } from '@/lib/supabaseClient';
import { StatusBadge } from '@/src/components/Booking/StatusBadge';
import { PreviousAppointmentTimes } from '@/src/components/Booking/PreviousAppointmentTimes';
import {
  useDepartments,
  useServiceProviders,
  useServices,
} from '@/src/hooks/useBookingLookups';
import type { Booking } from '@/src/types/booking';
import type {
  Department,
  Service,
  ServiceProvider,
} from '@/src/types/booking-entities';
import {
  format_booking_location_type_display,
  parse_booking_location_meeting_option,
} from '@/src/types/event_type_location';
import { get_department_gradient } from '@/src/features/departments/department_colors';
import {
  getDisplayEmail,
  getDisplayName,
  getDisplayPhone,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import { get_previous_appointment_times } from '@/src/utils/booking_reschedule';
import { formatDate, formatTime } from '@/src/utils/date';
import { resolve_meeting_join_url_from_booking } from '@/src/utils/google_meet';
import {
  booking_service_provider_display_name,
  get_service_provider_display_phone,
  type service_provider_display_source,
} from '@/src/utils/service_provider_display';

const PANEL_CLOSE_MS = 300;

type preview_fetch_state =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; booking: Booking }
  | { status: 'error'; message: string }
  | { status: 'not_found' };

export type BookingPreviewPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Used when `booking` is omitted. Accepts the same id as `/bookings/[id]`. */
  bookingId?: string | number | null;
  /** Full booking record. When set, it is shown immediately (no extra fetch). */
  booking?: Booking | null;
};

function to_booking_id(
  bookingId?: string | number | null,
  booking?: Booking | null
): string | null {
  if (booking?.id != null && String(booking.id).trim() !== '') {
    return String(booking.id).trim();
  }
  if (bookingId == null) return null;
  const trimmed = String(bookingId).trim();
  return trimmed === '' ? null : trimmed;
}

export function BookingPreviewPanel({
  open,
  onClose,
  bookingId = null,
  booking: booking_prop = null,
}: BookingPreviewPanelProps) {
  const [panel_animated_open, set_panel_animated_open] = useState(false);
  const [fetch_state, set_fetch_state] = useState<preview_fetch_state>({
    status: 'idle',
  });
  const close_timer_ref = useRef<number | null>(null);

  const { data: departments } = useDepartments();
  const { data: services } = useServices();
  const { data: serviceProviders, workspaceOwner } = useServiceProviders();

  const resolved_id = to_booking_id(bookingId, booking_prop);
  const panel_visible = open || panel_animated_open;

  const clear_close_timer = useCallback(() => {
    if (close_timer_ref.current != null) {
      window.clearTimeout(close_timer_ref.current);
      close_timer_ref.current = null;
    }
  }, []);

  const handle_close = useCallback(() => {
    set_panel_animated_open(false);
    clear_close_timer();
    close_timer_ref.current = window.setTimeout(() => {
      close_timer_ref.current = null;
      onClose();
    }, PANEL_CLOSE_MS);
  }, [clear_close_timer, onClose]);

  useEffect(() => {
    return () => clear_close_timer();
  }, [clear_close_timer]);

  useEffect(() => {
    if (!open) {
      set_panel_animated_open(false);
      return;
    }
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => set_panel_animated_open(true));
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const on_key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handle_close();
    };
    window.addEventListener('keydown', on_key);
    return () => window.removeEventListener('keydown', on_key);
  }, [handle_close, open]);

  useEffect(() => {
    if (!open) {
      set_fetch_state({ status: 'idle' });
      return;
    }
    if (booking_prop) {
      set_fetch_state({ status: 'ready', booking: booking_prop });
      return;
    }
    if (!resolved_id) {
      set_fetch_state({
        status: 'error',
        message: 'A booking id or booking object is required.',
      });
      return;
    }

    let cancelled = false;
    set_fetch_state({ status: 'loading' });

    const load = async () => {
      const { session } = await getWorkspaceSession();
      if (!session?.access_token) {
        if (!cancelled) {
          set_fetch_state({ status: 'error', message: 'Not authenticated' });
        }
        return;
      }

      try {
        const response = await fetch(`/api/bookings/${resolved_id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (cancelled) return;

        if (response.status === 404) {
          set_fetch_state({ status: 'not_found' });
          return;
        }

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          set_fetch_state({
            status: 'error',
            message: payload?.error || 'Failed to load booking',
          });
          return;
        }

        const result = (await response.json()) as { data?: Booking };
        if (!result?.data) {
          set_fetch_state({ status: 'not_found' });
          return;
        }
        set_fetch_state({ status: 'ready', booking: result.data });
      } catch {
        if (!cancelled) {
          set_fetch_state({
            status: 'error',
            message: 'An unexpected error occurred while loading the booking.',
          });
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [booking_prop, open, resolved_id]);

  const booking = booking_prop ?? (fetch_state.status === 'ready' ? fetch_state.booking : null);
  const details_href = resolved_id ? `/bookings/${resolved_id}` : null;
  const is_loading =
    open && !booking_prop && fetch_state.status === 'loading';
  const assigned_department: Department | null = booking
    ? departments.find(
        (d) => String(d.id) === String(booking.department_id)
      ) ?? null
    : null;

  return (
    <aside
      className={`fixed top-16 right-0 bottom-0 z-10001 flex w-full h-full flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:w-[32rem] transform transition-transform duration-300 ease-in-out will-change-transform ${
        panel_animated_open
          ? 'translate-x-0'
          : 'pointer-events-none translate-x-full'
      }`}
      aria-hidden={!panel_visible}
      aria-label="Booking preview"
    >
      {panel_visible ? (
        <div className="flex flex-col overflow-y-auto pb-[60px]">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900">
                Booking preview
              </h2>
              {booking || resolved_id ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {booking ? (
                    <StatusBadge
                      status={booking.status || 'Pending'}
                      className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                    />
                  ) : null}
                  <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    ID #{booking?.id ?? resolved_id}
                  </span>
                  {assigned_department ? (
                    <span
                      className={`inline-flex items-center rounded-full bg-gradient-to-br px-3 py-1 text-xs font-medium text-white ${get_department_gradient(
                        {
                          id: Number(assigned_department.id) || 0,
                          meta_data: assigned_department.meta_data,
                        }
                      )}`}
                    >
                      {assigned_department.name}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handle_close}
              className="cursor-pointer rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close booking preview"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div className="overflow-y-scroll px-5 py-5">
            {is_loading ? (
              <PreviewLoadingState />
            ) : fetch_state.status === 'not_found' ? (
              <PreviewMessage title="Booking not found">
                This booking may have been deleted or is not available in this
                workspace.
              </PreviewMessage>
            ) : fetch_state.status === 'error' ? (
              <PreviewMessage title="Unable to load booking">
                {fetch_state.message}
              </PreviewMessage>
            ) : booking ? (
              <BookingPreviewBody
                booking={booking}
                services={services}
                serviceProviders={serviceProviders}
                workspaceOwner={workspaceOwner}
              />
            ) : null}
          </div>

          <div className="shrink-0 border-t border-slate-200 px-5 py-4">
            {details_href ? (
              <a
                href={details_href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              >
                View more details
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white opacity-50"
              >
                View more details
              </button>
            )}
          </div>
          
        </div>
      ) : null}
    </aside>
  );
}

function BookingPreviewBody({
  booking,
  services,
  serviceProviders,
  workspaceOwner,
}: {
  booking: Booking;
  services: Service[];
  serviceProviders: ServiceProvider[];
  workspaceOwner: service_provider_display_source | null;
}) {
  const intake_form = booking.metadata?.intake_form as
    | Record<string, unknown>
    | undefined;

  const has_service_provider_id =
    booking.service_provider_id != null && booking.service_provider_id !== '';
  const assigned_service_provider = has_service_provider_id
    ? serviceProviders.find((sp) => sp.id === booking.service_provider_id) ??
      null
    : null;

  const service_provider_display = booking_service_provider_display_name(
    booking,
    assigned_service_provider,
    workspaceOwner ?? undefined
  );
  const host_contact_phone = has_service_provider_id
    ? get_service_provider_display_phone(
        assigned_service_provider,
        undefined,
        'N/A'
      )
    : get_service_provider_display_phone(
        null,
        workspaceOwner ?? undefined,
        'N/A'
      );

  const event_duration_inner = getEventTypeDurationInner(
    booking.event_types?.duration_minutes
  );
  const event_type_label = booking.event_types?.title
    ? event_duration_inner != null
      ? `${booking.event_types.title} (${event_duration_inner})`
      : booking.event_types.title
    : 'N/A';

  const meeting_type_label = format_booking_location_type_display(
    booking.location,
    booking.event_types?.location_type ?? null
  );
  const google_meet_join_url =
    parse_booking_location_meeting_option(booking.location) === 'google_meet'
      ? resolve_meeting_join_url_from_booking(
          booking.location,
          booking.metadata
        ) ?? null
      : null;

  const raw_intake_services = intake_form?.services;
  const selected_service_names = (
    Array.isArray(raw_intake_services)
      ? raw_intake_services.filter((x): x is string => typeof x === 'string')
      : []
  )
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter((name): name is string => Boolean(name));

  const previous_appointment_times = get_previous_appointment_times(
    booking.metadata
  );

  const booking_status_label = booking.status || 'Pending';

  return (
    <div className="space-y-4">
      <PreviewSection title="Customer information">
        <PreviewField label="Name" value={getDisplayName(booking)} />
        <PreviewField label="Phone" value={getDisplayPhone(booking)} />
        <PreviewField label="Email" value={getDisplayEmail(booking)} />
      </PreviewSection>

      <PreviewSection title="Booking information">
        <PreviewField label="Event type" value={event_type_label} />
        <PreviewField
          label="Meeting type"
          value={
            google_meet_join_url ? (
              <span className="inline-flex flex-wrap items-center justify-end gap-x-2">
                <span>{meeting_type_label}</span>
                <a
                  href={google_meet_join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-indigo-600 underline decoration-indigo-400 underline-offset-2 hover:text-indigo-800"
                >
                  Open meeting
                </a>
              </span>
            ) : (
              meeting_type_label
            )
          }
        />
        <PreviewField label="Service provider" value={service_provider_display} />
        {selected_service_names.length > 0 ? (
          <PreviewField
            label="Services"
            value={selected_service_names.join(', ')}
          />
        ) : null}
      </PreviewSection>

      <PreviewSection title="Date & time">
        <PreviewField
          label="Start"
          value={`${formatDate(booking.start_at)}, ${formatTime(booking.start_at)}`}
        />
        {booking.end_at ? (
          <PreviewField
            label="End"
            value={`${formatDate(booking.end_at)}, ${formatTime(booking.end_at)}`}
          />
        ) : null}
      </PreviewSection>
    </div>
  );
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="gap-3">
      <span className="shrink-0 text-sm font-medium text-slate-500">{label}: </span>
      <span className="min-w-0 break-words text-left text-sm font-semibold text-slate-800">
        {value}
      </span>
    </div>
  );
}

function PreviewLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
      <LoaderIcon className="h-6 w-6 animate-spin text-indigo-600" aria-hidden />
      <p className="text-sm">Loading booking…</p>
    </div>
  );
}

function PreviewMessage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{children}</p>
    </div>
  );
}
