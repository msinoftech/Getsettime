'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LuCalendar as Calendar,
  LuCircleCheck as CircleCheck,
  LuLoader as LoaderIcon,
  LuUser as User,
} from 'react-icons/lu';
import { formatDate, formatTime } from '@/src/utils/date';
import {
  capitalize_booking_display_label,
  getServiceProviderName,
  getDepartmentName,
  getDisplayName,
  getDisplayEmail,
  getDisplayPhone,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import {
  get_service_provider_display_name,
  get_service_provider_display_phone,
  type service_provider_display_source,
} from '@/src/utils/service_provider_display';
import { StatusBadge } from './StatusBadge';
import { serviceIdsFromUserServiceAssignments } from '@/src/utils/bookingServiceAssignments';
import type {
  ServiceProvider,
  Department,
  Service,
} from '@/src/types/booking-entities';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import { BOOKING_STATUSES, type Booking } from '@/src/types/booking';

async function copy_text_to_clipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    return true;
  } catch {
    return false;
  }
}

const BOOKING_STATUS_EDIT_OPTIONS = BOOKING_STATUSES.filter(
  (s) => s.value !== 'deleted'
);

function normalize_booking_status_for_edit(
  status: string | null | undefined
): string {
  const t = (status || '').trim().toLowerCase();
  if (BOOKING_STATUS_EDIT_OPTIONS.some((o) => o.value === t)) return t;
  return 'pending';
}

export type BookingInviteeSavePayload = {
  invitee_name: string;
  invitee_email: string;
  invitee_phone: string;
};

export type BookingDetailsSavePayload = {
  department_id: string | null;
  service_provider_id: string | null;
  status: string;
  /** Catalog service ids persisted under `metadata.intake_form.services` */
  intake_form_services: string[];
};

/** Status quick actions share loading / success affordances in Quick Actions */
export type BookingQuickActionFeedback =
  | null
  | {
      action: 'completed' | 'no-show' | 'cancelled';
      phase: 'loading' | 'success';
    };

export interface BookingDetailsCardProps {
  booking: Booking;
  intakeFormSettings: NormalizedIntakeForm | null;
  services: Service[];
  departments: Department[];
  serviceProviders: ServiceProvider[];
  workspace_owner?: service_provider_display_source | null;
  /**
   * Auth user id of the workspace owner; used when the booking host is “None”
   * so department/service scopes match intake Step 1 (implicit owner host).
   */
  workspace_owner_user_id?: string | null;

  /**
   * `modal` renders a close ✕ button in the header and a "Close" button in
   * the footer. `page` hides those because the parent page provides its own
   * back / navigation affordances.
   */
  variant?: 'modal' | 'page';

  /** Only used when `variant === 'modal'`. */
  onClose?: () => void;

  /** Optional action handlers. When omitted, buttons remain visible as no-ops. */
  onPrint?: () => void;
  onSendReminder?: () => void;
  onShareSummary?: () => void;
  onScheduleFollowUp?: () => void;
  /**
   * When provided, “Edit Invitee” toggles inline fields with Save/Cancel in place.
   * When omitted but `onEditInvitee` is set, clicking still opens the parent’s modal flow.
   */
  onSaveInvitee?: (payload: BookingInviteeSavePayload) => void | Promise<void>;
  /** @deprecated Prefer `onSaveInvitee` for inline editing on the bookings page. */
  onEditInvitee?: () => void;
  /**
   * When set, “Edit Booking” edits department, service provider, and status inline
   * (Save/Cancel). Date/time still uses `onReschedule`.
   */
  onSaveBookingDetails?: (
    payload: BookingDetailsSavePayload
  ) => void | Promise<void>;
  /** Legacy: opens an external flow when `onSaveBookingDetails` is not provided. */
  onEditBooking?: () => void;
  onReschedule?: () => void;
  onViewActivityLog?: () => void;
  /**
   * Override the default "Copy Booking Link" behaviour. When omitted, a modal
   * offers admin dashboard link vs customer public preview link (when present).
   */
  onCopyBookingLink?: () => void;
  onMarkCompleted?: () => void;
  onMarkNoShow?: () => void;
  onCancelBooking?: () => void;
  onDeleteBooking?: () => void;
  onSaveAdminNotice?: (notice: string) => void;
  /** Per-button loader + green checkmark after PATCH for status shortcuts */
  quickActionFeedback?: BookingQuickActionFeedback;
}

export function BookingDetailsCard({
  booking,
  intakeFormSettings,
  services,
  departments,
  serviceProviders,
  workspace_owner,
  workspace_owner_user_id = null,
  variant = 'modal',
  onClose,
  onPrint,
  onSendReminder,
  onScheduleFollowUp,
  onShareSummary,
  onSaveInvitee,
  onEditInvitee,
  onSaveBookingDetails,
  onEditBooking,
  onReschedule,
  onViewActivityLog,
  onCopyBookingLink,
  onMarkCompleted,
  onMarkNoShow,
  onCancelBooking,
  onDeleteBooking,
  onSaveAdminNotice,
  quickActionFeedback = null,
}: BookingDetailsCardProps) {
  const invitee_inline_edit = typeof onSaveInvitee === 'function';
  const booking_inline_edit = typeof onSaveBookingDetails === 'function';

  const [invitee_editing, set_invitee_editing] = useState(false);
  const [invitee_save_pending, set_invitee_save_pending] = useState(false);
  const [invitee_name_draft, set_invitee_name_draft] = useState('');
  const [invitee_email_draft, set_invitee_email_draft] = useState('');
  const [invitee_phone_draft, set_invitee_phone_draft] = useState('');

  const start_invitee_edit = useCallback(() => {
    set_invitee_name_draft(booking.invitee_name?.trim() ?? '');
    set_invitee_email_draft(booking.invitee_email?.trim() ?? '');
    set_invitee_phone_draft(booking.invitee_phone?.trim() ?? '');
    set_invitee_editing(true);
  }, [
    booking.invitee_email,
    booking.invitee_name,
    booking.invitee_phone,
  ]);

  const cancel_invitee_edit = useCallback(() => {
    set_invitee_editing(false);
  }, []);

  const submit_invitee_edit = useCallback(async () => {
    if (!onSaveInvitee) return;
    try {
      set_invitee_save_pending(true);
      await onSaveInvitee({
        invitee_name: invitee_name_draft,
        invitee_email: invitee_email_draft,
        invitee_phone: invitee_phone_draft,
      });
      set_invitee_editing(false);
    } catch {
      /* parent shows alert */
    } finally {
      set_invitee_save_pending(false);
    }
  }, [
    invitee_email_draft,
    invitee_name_draft,
    invitee_phone_draft,
    onSaveInvitee,
  ]);

  useEffect(() => {
    if (invitee_editing) return;
    set_invitee_name_draft(booking.invitee_name?.trim() ?? '');
    set_invitee_email_draft(booking.invitee_email?.trim() ?? '');
    set_invitee_phone_draft(booking.invitee_phone?.trim() ?? '');
  }, [
    booking.id,
    booking.invitee_email,
    booking.invitee_name,
    booking.invitee_phone,
    invitee_editing,
  ]);

  const [booking_info_editing, set_booking_info_editing] = useState(false);
  const [booking_info_save_pending, set_booking_info_save_pending] =
    useState(false);
  const [draft_department_id, set_draft_department_id] = useState('');
  const [draft_service_provider_id, set_draft_service_provider_id] =
    useState('');
  const [draft_status, set_draft_status] = useState('pending');
  const [draft_intake_service_ids, set_draft_intake_service_ids] = useState<
    string[]
  >([]);

  const start_booking_info_edit = useCallback(() => {
    set_draft_department_id(
      booking.department_id != null && String(booking.department_id) !== ''
        ? String(booking.department_id)
        : ''
    );
    set_draft_service_provider_id(booking.service_provider_id?.trim() ?? '');
    set_draft_status(normalize_booking_status_for_edit(booking.status));
    const intake = booking.metadata?.intake_form as
      | Record<string, unknown>
      | undefined;
    const svc = intake?.services;
    set_draft_intake_service_ids(
      Array.isArray(svc) ? svc.filter((x): x is string => typeof x === 'string') : []
    );
    set_booking_info_editing(true);
  }, [
    booking.department_id,
    booking.metadata,
    booking.service_provider_id,
    booking.status,
  ]);

  const cancel_booking_info_edit = useCallback(() => {
    set_booking_info_editing(false);
  }, []);

  const submit_booking_info_edit = useCallback(async () => {
    if (!onSaveBookingDetails) return;
    try {
      set_booking_info_save_pending(true);
      await onSaveBookingDetails({
        department_id: draft_department_id.trim()
          ? draft_department_id.trim()
          : null,
        service_provider_id: draft_service_provider_id.trim()
          ? draft_service_provider_id.trim()
          : null,
        status: draft_status,
        intake_form_services: draft_intake_service_ids,
      });
      set_booking_info_editing(false);
    } catch {
      /* parent shows alert */
    } finally {
      set_booking_info_save_pending(false);
    }
  }, [
    draft_department_id,
    draft_intake_service_ids,
    draft_service_provider_id,
    draft_status,
    onSaveBookingDetails,
  ]);

  useEffect(() => {
    if (booking_info_editing) return;
    set_draft_department_id(
      booking.department_id != null && String(booking.department_id) !== ''
        ? String(booking.department_id)
        : ''
    );
    set_draft_service_provider_id(booking.service_provider_id?.trim() ?? '');
    set_draft_status(normalize_booking_status_for_edit(booking.status));
    const intake = booking.metadata?.intake_form as
      | Record<string, unknown>
      | undefined;
    const svc = intake?.services;
    set_draft_intake_service_ids(
      Array.isArray(svc) ? svc.filter((x): x is string => typeof x === 'string') : []
    );
  }, [
    booking.id,
    booking.department_id,
    booking.metadata,
    booking.service_provider_id,
    booking.status,
    booking_info_editing,
  ]);

  const host_contact_preview = useMemo(() => {
    const sp_id =
      booking_info_editing && booking_inline_edit
        ? draft_service_provider_id.trim() || null
        : booking.service_provider_id;
    const has_id = sp_id != null && sp_id !== '';
    const sp = has_id
      ? serviceProviders.find((p) => p.id === sp_id) ?? null
      : null;
    return has_id
      ? get_service_provider_display_phone(sp, undefined, 'N/A')
      : get_service_provider_display_phone(
          null,
          workspace_owner ?? undefined,
          'N/A'
        );
  }, [
    booking_info_editing,
    booking_inline_edit,
    booking.service_provider_id,
    draft_service_provider_id,
    serviceProviders,
    workspace_owner,
  ]);

  const booking_select_class =
    'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800';

  /** Explicit draft host UUID, else workspace owner when host is unset (matches intake form). */
  const booking_edit_effective_provider_id = useMemo(() => {
    const explicit = draft_service_provider_id.trim();
    if (explicit) return explicit;
    const oid = workspace_owner_user_id?.trim();
    return oid || null;
  }, [draft_service_provider_id, workspace_owner_user_id]);

  /** Team member row for the effective host — drives allowed departments */
  const booking_edit_provider_record = useMemo((): ServiceProvider | null => {
    if (!booking_inline_edit || !booking_edit_effective_provider_id) return null;
    return (
      serviceProviders.find((p) => p.id === booking_edit_effective_provider_id) ??
      null
    );
  }, [
    booking_inline_edit,
    booking_edit_effective_provider_id,
    serviceProviders,
  ]);

  const [provider_edit_assigned_service_ids, set_provider_edit_assigned_service_ids] =
    useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!booking_inline_edit || !booking_edit_effective_provider_id) {
      set_provider_edit_assigned_service_ids(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { supabase } = await import('@/lib/supabaseClient');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(
        `/api/user-services?user_id=${encodeURIComponent(booking_edit_effective_provider_id)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const j = res.ok
        ? ((await res.json()) as { assignments?: { user_id: string; service_id: string }[] })
        : { assignments: [] };
      if (cancelled) return;
      set_provider_edit_assigned_service_ids(
        serviceIdsFromUserServiceAssignments(
          j.assignments ?? [],
          booking_edit_effective_provider_id
        )
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [booking_inline_edit, booking_edit_effective_provider_id]);

  const departments_for_booking_edit = useMemo(() => {
    if (!booking_inline_edit) return departments;
    const p = booking_edit_provider_record;
    if (!p) return departments;
    const ids = p.departments ?? [];
    if (p.is_workspace_owner === true && ids.length === 0) return departments;
    if (ids.length === 0) return [];
    const want = new Set(ids.map(String));
    return departments.filter((d) => want.has(String(d.id)));
  }, [booking_inline_edit, booking_edit_provider_record, departments]);

  const catalog_services_for_booking_edit = useMemo(() => {
    if (!booking_inline_edit) return [];
    const d = draft_department_id.trim();
    const effId = booking_edit_effective_provider_id;
    if (!d || !effId) return [];
    return services.filter(
      (s) =>
        String(s.department_id ?? '') === d &&
        (s.status == null || s.status === '' || s.status === 'active') &&
        provider_edit_assigned_service_ids.has(s.id)
    );
  }, [
    booking_inline_edit,
    services,
    draft_department_id,
    booking_edit_effective_provider_id,
    provider_edit_assigned_service_ids,
  ]);

  useEffect(() => {
    if (!booking_info_editing || !booking_inline_edit) return;
    if (departments_for_booking_edit.length === 0) {
      if (draft_department_id.trim() !== '')
        set_draft_department_id('');
      return;
    }
    if (draft_department_id.trim() === '') return;
    const ok = departments_for_booking_edit.some(
      (dept) => String(dept.id) === draft_department_id.trim()
    );
    if (!ok) set_draft_department_id('');
  }, [
    booking_info_editing,
    booking_inline_edit,
    draft_department_id,
    departments_for_booking_edit,
  ]);

  useEffect(() => {
    if (!booking_info_editing || !booking_inline_edit) return;
    if (!draft_department_id.trim() || !booking_edit_effective_provider_id) return;
    set_draft_intake_service_ids((ids) =>
      ids.filter((id) =>
        catalog_services_for_booking_edit.some((s) => s.id === id)
      )
    );
  }, [
    booking_info_editing,
    booking_inline_edit,
    draft_department_id,
    booking_edit_effective_provider_id,
    catalog_services_for_booking_edit,
  ]);

  const toggle_draft_intake_service = useCallback((id: string) => {
    set_draft_intake_service_ids((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const eventDurationInner = getEventTypeDurationInner(
    booking.event_types?.duration_minutes
  );

  const has_service_provider_id =
    booking.service_provider_id != null &&
    booking.service_provider_id !== '';
  const service_provider_display = has_service_provider_id
    ? capitalize_booking_display_label(
        getServiceProviderName(booking.service_provider_id, serviceProviders)
      )
    : get_service_provider_display_name(null, workspace_owner ?? undefined);

  const assigned_service_provider = has_service_provider_id
    ? serviceProviders.find((sp) => sp.id === booking.service_provider_id) ??
      null
    : null;
  const host_contact_phone = has_service_provider_id
    ? get_service_provider_display_phone(
        assigned_service_provider,
        undefined,
        'N/A'
      )
    : get_service_provider_display_phone(
        null,
        workspace_owner ?? undefined,
        'N/A'
      );

  const department_name = getDepartmentName(booking.department_id, departments);
  const show_department_row = department_name !== 'N/A';

  const intakeForm = booking.metadata?.intake_form as
    | Record<string, unknown>
    | undefined;

  const raw_intake_services = intakeForm?.services;
  const selectedServiceIds = Array.isArray(raw_intake_services)
    ? raw_intake_services.filter((x): x is string => typeof x === 'string')
    : [];
  const selectedServiceNames = selectedServiceIds
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const intake_services_display =
    selectedServiceNames.length > 0 ? selectedServiceNames.join(', ') : '';

  const show_services_row = selectedServiceNames.length > 0;

  const customFieldValues = intakeForm || {};
  const fieldsToShow =
    intakeFormSettings?.custom_fields?.filter((field) => {
      const value = customFieldValues[field.id];
      return value !== undefined && value !== null && value !== '';
    }) ?? [];

  const notes = intakeForm?.additional_description as string | undefined;
  const legacyNotes = booking.metadata?.notes as string | undefined;
  const metaDesc = booking.metadata?.additional_description as string | undefined;
  const displayNotes = notes || legacyNotes || metaDesc || '';

  const fileUploadUrl = intakeForm?.file_upload_url as string | undefined;
  const fileUploadName = fileUploadUrl
    ? decodeURIComponent(fileUploadUrl.split('/').pop() || 'file')
    : '';

  const showAdditionalInfo =
    intakeFormSettings?.additional_description === true ||
    intakeFormSettings === null;

  const initial_admin_notice = useMemo(() => {
    const raw = (booking.metadata as Record<string, unknown> | undefined)
      ?.admin_notice;
    return typeof raw === 'string' ? raw : '';
  }, [booking.metadata]);
  const [admin_notice, set_admin_notice] = useState<string>(initial_admin_notice);
  const [admin_notice_saving, set_admin_notice_saving] = useState(false);

  const creator_name =
    booking.creator?.name && booking.creator.name.trim()
      ? booking.creator.name.trim()
      : null;
  const guest_name =
    (booking.invitee_name && booking.invitee_name.trim()) ||
    (booking.contacts?.name && booking.contacts.name.trim()) ||
    '';
  const created_by_type: 'admin' | 'guest' = creator_name ? 'admin' : 'guest';
  const created_by_raw = creator_name || guest_name;
  const created_by_label = created_by_raw
    ? capitalize_booking_display_label(created_by_raw)
    : '';

  const booking_status_label = booking.status || 'Pending';

  const handle_save_admin_notice = async () => {
    if (!onSaveAdminNotice) return;
    try {
      set_admin_notice_saving(true);
      await onSaveAdminNotice(admin_notice);
    } finally {
      set_admin_notice_saving(false);
    }
  };

  const [copy_booking_links_modal_open, set_copy_booking_links_modal_open] =
    useState(false);
  const [copy_modal_feedback, set_copy_modal_feedback] = useState<
    | null
    | { target: 'admin' | 'public'; phase: 'success' | 'error' }
  >(null);
  const copy_modal_feedback_timer_ref = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copy_modal_feedback_timer_ref.current) {
        clearTimeout(copy_modal_feedback_timer_ref.current);
      }
    };
  }, []);

  const bump_copy_modal_feedback = useCallback(
    (patch: Parameters<typeof set_copy_modal_feedback>[0]) => {
      if (copy_modal_feedback_timer_ref.current) {
        clearTimeout(copy_modal_feedback_timer_ref.current);
        copy_modal_feedback_timer_ref.current = null;
      }
      set_copy_modal_feedback(patch);
      copy_modal_feedback_timer_ref.current = window.setTimeout(() => {
        set_copy_modal_feedback(null);
        copy_modal_feedback_timer_ref.current = null;
      }, 2200);
    },
    []
  );

  const close_copy_booking_links_modal = useCallback(() => {
    if (copy_modal_feedback_timer_ref.current) {
      clearTimeout(copy_modal_feedback_timer_ref.current);
      copy_modal_feedback_timer_ref.current = null;
    }
    set_copy_modal_feedback(null);
    set_copy_booking_links_modal_open(false);
  }, []);

  const handle_copy_booking_link_quick_action = () => {
    if (onCopyBookingLink) {
      onCopyBookingLink();
      return;
    }
    set_copy_modal_feedback(null);
    set_copy_booking_links_modal_open(true);
  };

  const public_code_trim = booking.public_code?.trim() ?? '';

  const handle_modal_copy_admin = async () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/bookings/${booking.id}`;
    const ok = await copy_text_to_clipboard(url);
    bump_copy_modal_feedback(
      ok
        ? { target: 'admin', phase: 'success' }
        : { target: 'admin', phase: 'error' }
    );
  };

  const handle_modal_copy_public = async () => {
    if (typeof window === 'undefined' || !public_code_trim) return;
    const url = `${window.location.origin}/booking-preview/${public_code_trim}`;
    const ok = await copy_text_to_clipboard(url);
    bump_copy_modal_feedback(
      ok
        ? { target: 'public', phase: 'success' }
        : { target: 'public', phase: 'error' }
    );
  };

  const show_modal_close = variant === 'modal';

  const handle_print = () => {
    if (onPrint) {
      onPrint();
      return;
    }
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const PRINT_CLASS = 'print-mode-booking';
    root.classList.add(PRINT_CLASS);
    const cleanup = () => {
      root.classList.remove(PRINT_CLASS);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Fallback for browsers/PDF dialogs that don't fire `afterprint` reliably.
    window.setTimeout(cleanup, 2000);
    window.print();
  };

  return (
    <>
    <div
      data-print-root="booking-details"
      className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-slate-200 bg-white ${
        variant === 'page' ? 'shadow-sm' : 'max-w-5xl shadow-2xl'
      }`}
    >
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-slate-50 px-6 py-5 md:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                Booking Details
              </h1>
              <StatusBadge
                status={booking_status_label}
                className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
              />
              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-700">
                ID #{booking.id}
              </span>
            </div>
            {(booking.created_at || created_by_label) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-slate-500">
                {booking.created_at && (
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
                    Created on {formatDate(booking.created_at)} at{' '}
                    {formatTime(booking.created_at)}
                  </span>
                )}
                {created_by_label && (
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-400" aria-hidden />
                    Created by {created_by_label}
                    <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          created_by_type === 'guest'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {created_by_type}
                      </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={handle_print}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Print
            </button>
            <button
              type="button"
              onClick={onSendReminder}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
            >
              Send Reminder
            </button>
            <button
              type="button"
              onClick={onScheduleFollowUp}
              className="rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
            >
              Schedule Follow-up
            </button>
            {/* <button
              type="button"
              onClick={onShareSummary}
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition hover:bg-green-100"
            >
              Share Summary
            </button> */}
            {show_modal_close && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-500 transition hover:bg-slate-50"
                aria-label="Close dialog"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 bg-slate-50/40 p-6 md:grid-cols-3 md:p-8">
        <div className="space-y-6 md:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Customer Information
              </h2>
              {(invitee_inline_edit || onEditInvitee) && (
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  {invitee_editing && invitee_inline_edit ? (
                    <>
                      <button
                        type="button"
                        disabled={invitee_save_pending}
                        onClick={() => void submit_invitee_edit()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {invitee_save_pending && (
                          <LoaderIcon
                            aria-hidden
                            className="h-4 w-4 shrink-0 animate-spin"
                          />
                        )}
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={invitee_save_pending}
                        onClick={cancel_invitee_edit}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        invitee_inline_edit
                          ? start_invitee_edit
                          : onEditInvitee
                      }
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Edit Invitee
                    </button>
                  )}
                </div>
              )}
            </div>

            {invitee_editing && invitee_inline_edit ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <InviteeEditField label="Name">
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    value={invitee_name_draft}
                    onChange={(e) => set_invitee_name_draft(e.target.value)}
                    autoComplete="name"
                  />
                </InviteeEditField>
                <InviteeEditField label="Phone">
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    value={invitee_phone_draft}
                    onChange={(e) => set_invitee_phone_draft(e.target.value)}
                    autoComplete="tel"
                  />
                </InviteeEditField>
                <div className="sm:col-span-2">
                  <InviteeEditField label="Email">
                    <input
                      type="email"
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                      value={invitee_email_draft}
                      onChange={(e) =>
                        set_invitee_email_draft(e.target.value)
                      }
                      autoComplete="email"
                    />
                  </InviteeEditField>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoCard label="Name" value={getDisplayName(booking)} />
                <InfoCard label="Phone" value={getDisplayPhone(booking)} />
                <div className="sm:col-span-2">
                  <InfoCard label="Email" value={getDisplayEmail(booking)} />
                </div>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Booking Information
              </h2>
              {(booking_inline_edit || onEditBooking) && (
                <div className="flex shrink-0 items-center gap-2 print:hidden">
                  {booking_info_editing && booking_inline_edit ? (
                    <>
                      <button
                        type="button"
                        disabled={booking_info_save_pending}
                        onClick={() => void submit_booking_info_edit()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {booking_info_save_pending && (
                          <LoaderIcon
                            aria-hidden
                            className="h-4 w-4 shrink-0 animate-spin"
                          />
                        )}
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={booking_info_save_pending}
                        onClick={cancel_booking_info_edit}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        booking_inline_edit
                          ? start_booking_info_edit
                          : onEditBooking
                      }
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      Edit Booking
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                label="Event Type"
                value={
                  booking.event_types?.title
                    ? eventDurationInner != null
                      ? `${booking.event_types.title} (${eventDurationInner})`
                      : booking.event_types.title
                    : 'N/A'
                }
              />
              {booking_info_editing && booking_inline_edit ? (
                <>
                  <InviteeEditField label="Service Provider">
                    <select
                      className={booking_select_class}
                      value={draft_service_provider_id}
                      onChange={(e) =>
                        set_draft_service_provider_id(e.target.value)
                      }
                    >
                      <option value="">None</option>
                      {serviceProviders.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {capitalize_booking_display_label(
                            getServiceProviderName(sp.id, serviceProviders)
                          )}
                        </option>
                      ))}
                    </select>
                  </InviteeEditField>
                  <InfoCard
                    label="Host Contact"
                    value={host_contact_preview}
                  />
                  <InviteeEditField label="Status">
                    <select
                      className={booking_select_class}
                      value={draft_status}
                      onChange={(e) => set_draft_status(e.target.value)}
                    >
                      {BOOKING_STATUS_EDIT_OPTIONS.map(({ value, label }) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </InviteeEditField>
                  <InviteeEditField label="Department">
                    {departments_for_booking_edit.length === 0 ? (
                      <>
                        <select
                          className={booking_select_class}
                          value=""
                          disabled
                          aria-describedby="booking-edit-dept-empty"
                        >
                          <option value="">No departments for this host</option>
                        </select>
                        <p
                          id="booking-edit-dept-empty"
                          className="mt-1 text-xs text-amber-800"
                        >
                          This host has no department assignments. Update Team
                          member departments so they match intake booking setup.
                        </p>
                      </>
                    ) : (
                      <select
                        className={booking_select_class}
                        value={draft_department_id}
                        onChange={(e) =>
                          set_draft_department_id(e.target.value)
                        }
                      >
                        <option value="">None</option>
                        {departments_for_booking_edit.map((dept) => (
                          <option
                            key={String(dept.id)}
                            value={String(dept.id)}
                          >
                            {dept.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </InviteeEditField>
                  <InviteeEditField label="Services">
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!draft_department_id.trim() ||
                      catalog_services_for_booking_edit.length === 0 ? (
                        <span className="text-sm text-slate-500">
                          {!draft_department_id.trim()
                            ? 'Choose a department to see eligible services.'
                            : !booking_edit_effective_provider_id
                              ? 'Set a Service Provider (or workspace owner fallback) so services can resolve.'
                              : 'No catalog services assigned to this host for this department.'}
                        </span>
                      ) : (
                        catalog_services_for_booking_edit.map((s) => {
                          const on = draft_intake_service_ids.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggle_draft_intake_service(s.id)}
                              className={`inline-flex items-center rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-all ${
                                on
                                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                              }`}
                            >
                              {s.name}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </InviteeEditField>
                </>
              ) : (
                <>
                  <InfoCard
                    label="Service Provider"
                    value={service_provider_display}
                  />
                  <InfoCard label="Host Contact" value={host_contact_phone} />
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Status
                    </p>
                    <div className="mt-2">
                      <StatusBadge
                        status={booking_status_label}
                        className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold"
                      />
                    </div>
                  </div>
                  {show_department_row && show_services_row ? (
                    <>
                      <InfoCard label="Department" value={department_name} />
                      <InfoCard
                        label="Services"
                        value={intake_services_display}
                      />
                    </>
                  ) : show_department_row ? (
                    <InfoCard label="Department" value={department_name} />
                  ) : show_services_row ? (
                    <div className="sm:col-span-2">
                      <InfoCard
                        label="Services"
                        value={intake_services_display}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Date &amp; Time
              </h2>
              <button
                type="button"
                onClick={onReschedule}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 print:hidden"
              >
                Reschedule
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard
                label="Start Date / Time"
                value={`${formatDate(booking.start_at)}, ${formatTime(booking.start_at)}`}
              />
              {booking.end_at && (
                <InfoCard
                  label="End Date / Time"
                  value={`${formatDate(booking.end_at)}, ${formatTime(booking.end_at)}`}
                />
              )}
            </div>
          </section>

          {fieldsToShow.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Custom Fields
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {fieldsToShow.map((field) => {
                  const value = customFieldValues[field.id];
                  const rendered =
                    typeof value === 'string' || typeof value === 'number'
                      ? String(value)
                      : Array.isArray(value)
                        ? value.join(', ')
                        : 'N/A';
                  return (
                    <InfoCard
                      key={field.id}
                      label={field.label}
                      value={rendered}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {fileUploadUrl && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Uploaded File
              </h2>
              <a
                href={fileUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <svg
                  className="h-5 w-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="max-w-xs truncate text-sm font-medium">
                  {fileUploadName}
                </span>
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </section>
          )}

          {showAdditionalInfo && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
              <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Notes &amp; Additional Information
              </h2>
              <div className="whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                {displayNotes || 'N/A'}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm print:hidden">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-800">
                Admin Notice
              </h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                Internal Only
              </span>
            </div>

            <textarea
              value={admin_notice}
              onChange={(e) => set_admin_notice(e.target.value)}
              className="min-h-[180px] w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-400"
              placeholder="Add internal remarks for admins or staff..."
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={admin_notice_saving}
                onClick={handle_save_admin_notice}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {admin_notice_saving ? 'Saving…' : 'Save Notice'}
              </button>
              <button
                type="button"
                onClick={() => set_admin_notice('')}
                className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
              Quick Actions
            </h2>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={onViewActivityLog}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                View Activity Log
              </button>
              <button
                type="button"
                onClick={handle_copy_booking_link_quick_action}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Copy Booking Link
              </button>
              <button
                type="button"
                onClick={onMarkCompleted}
                disabled={quickActionFeedback?.phase === 'loading'}
                aria-busy={
                  quickActionFeedback?.action === 'completed' &&
                  quickActionFeedback.phase === 'loading'
                }
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Mark as Completed</span>
                {quickActionFeedback?.action === 'completed' &&
                  quickActionFeedback.phase === 'loading' && (
                    <LoaderIcon
                      aria-hidden
                      className="h-5 w-5 shrink-0 animate-spin text-emerald-600"
                    />
                  )}
                {quickActionFeedback?.action === 'completed' &&
                  quickActionFeedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-emerald-600"
                    />
                  )}
              </button>
              <button
                type="button"
                onClick={onMarkNoShow}
                disabled={quickActionFeedback?.phase === 'loading'}
                aria-busy={
                  quickActionFeedback?.action === 'no-show' &&
                  quickActionFeedback.phase === 'loading'
                }
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-left text-sm font-medium text-yellow-700 transition hover:bg-yellow-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Mark as No-show</span>
                {quickActionFeedback?.action === 'no-show' &&
                  quickActionFeedback.phase === 'loading' && (
                    <LoaderIcon
                      aria-hidden
                      className="h-5 w-5 shrink-0 animate-spin text-amber-600"
                    />
                  )}
                {quickActionFeedback?.action === 'no-show' &&
                  quickActionFeedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-emerald-600"
                    />
                  )}
              </button>
              <button
                type="button"
                onClick={onCancelBooking}
                disabled={quickActionFeedback?.phase === 'loading'}
                aria-busy={
                  quickActionFeedback?.action === 'cancelled' &&
                  quickActionFeedback.phase === 'loading'
                }
                className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>Cancel Booking</span>
                {quickActionFeedback?.action === 'cancelled' &&
                  quickActionFeedback.phase === 'loading' && (
                    <LoaderIcon
                      aria-hidden
                      className="h-5 w-5 shrink-0 animate-spin text-red-600"
                    />
                  )}
                {quickActionFeedback?.action === 'cancelled' &&
                  quickActionFeedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-emerald-600"
                    />
                  )}
              </button>
              <button
                type="button"
                onClick={onDeleteBooking}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Delete Booking
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
              Booking Summary
            </h2>
            <div className="space-y-3 text-sm text-slate-600">
              <SummaryRow label="Booking ID" value={`#${booking.id}`} />
              <SummaryRow label="Department" value={department_name} />
              {selectedServiceNames.length > 0 && (
                <SummaryRow
                  label="Service"
                  value={selectedServiceNames.join(', ')}
                />
              )}
              <SummaryRow
                label="Provider"
                value={service_provider_display || 'N/A'}
              />
              <SummaryRow
                label="Status"
                value={<span className="capitalize">{booking_status_label}</span>}
              />
              <SummaryRow
                label="Created By"
                value={
                  <span className="inline-flex items-center gap-2">
                    {created_by_label || 'N/A'}
                    {created_by_label && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          created_by_type === 'guest'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {created_by_type}
                      </span>
                    )}
                  </span>
                }
              />
              <SummaryRow
                label="Created On"
                value={`${formatDate(booking.created_at)} at ${formatTime(
                        booking.created_at
                      )}`}
              />
            </div>
          </section>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8 print:hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {show_modal_close && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>

    {copy_booking_links_modal_open && (
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/40 p-4 print:hidden"
        role="dialog"
        aria-modal
        aria-labelledby="copy-booking-links-title"
        onClick={() => close_copy_booking_links_modal()}
      >
        <div
          className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3
            id="copy-booking-links-title"
            className="text-lg font-semibold text-slate-900"
          >
            Copy booking link
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Choose whether to share the dashboard page (team) or the public
            preview (customer).
          </p>

          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handle_modal_copy_admin()}
              className="flex min-h-[52px] w-full flex-col items-stretch rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-left transition hover:bg-indigo-100"
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-indigo-900">
                    Admin (workspace) link
                  </span>
                  <span className="mt-0.5 block text-xs text-indigo-700/85">
                    Opens this booking in the dashboard when signed in.
                  </span>
                </span>
                {copy_modal_feedback?.target === 'admin' &&
                  copy_modal_feedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-6 w-6 shrink-0 text-emerald-600"
                    />
                  )}
                {copy_modal_feedback?.target === 'admin' &&
                  copy_modal_feedback.phase === 'error' && (
                    <span className="shrink-0 text-xs font-semibold text-red-600">
                      Failed
                    </span>
                  )}
              </span>
            </button>

            <button
              type="button"
              disabled={!public_code_trim}
              onClick={() => void handle_modal_copy_public()}
              className={`flex min-h-[52px] w-full flex-col items-stretch rounded-xl border px-4 py-3 text-left transition ${
                public_code_trim
                  ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'
              }`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-semibold ${
                      public_code_trim ? 'text-emerald-900' : 'text-slate-600'
                    }`}
                  >
                    Customer public link
                  </span>
                  <span
                    className={`mt-0.5 block text-xs ${
                      public_code_trim
                        ? 'text-emerald-800/90'
                        : 'text-slate-500'
                    }`}
                  >
                    {public_code_trim
                      ? 'Share with your invitee — no sign-in required.'
                      : 'No public preview code on this booking — use the admin link.'}
                  </span>
                </span>
                {copy_modal_feedback?.target === 'public' &&
                  copy_modal_feedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-6 w-6 shrink-0 text-emerald-600"
                    />
                  )}
                {copy_modal_feedback?.target === 'public' &&
                  copy_modal_feedback.phase === 'error' && (
                    <span className="shrink-0 text-xs font-semibold text-red-600">
                      Failed
                    </span>
                  )}
              </span>
            </button>
          </div>

          <button
            type="button"
            className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => close_copy_booking_links_modal()}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}

function InviteeEditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-base font-medium text-slate-800 break-words">
        {value}
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-800">{value}</span>
    </div>
  );
}
