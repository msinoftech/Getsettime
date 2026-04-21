'use client';

import React, { useMemo, useState } from 'react';
import { LuCalendar as Calendar, LuUser as User } from 'react-icons/lu';
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
import type {
  ServiceProvider,
  Department,
  Service,
} from '@/src/types/booking-entities';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import type { Booking } from '@/src/types/booking';

export interface BookingDetailsCardProps {
  booking: Booking;
  intakeFormSettings: NormalizedIntakeForm | null;
  services: Service[];
  departments: Department[];
  serviceProviders: ServiceProvider[];
  workspace_owner?: service_provider_display_source | null;

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
  onEditInvitee?: () => void;
  onEditBooking?: () => void;
  onReschedule?: () => void;
  onViewActivityLog?: () => void;
  /**
   * Custom override for the "Copy Booking Link" button. If omitted, we fall
   * back to copying `${origin}/bookings/${booking.id}` to the clipboard.
   */
  onCopyBookingLink?: () => void;
  onMarkCompleted?: () => void;
  onMarkNoShow?: () => void;
  onCancelBooking?: () => void;
  onDeleteBooking?: () => void;
  onSaveAdminNotice?: (notice: string) => void;
}

export function BookingDetailsCard({
  booking,
  intakeFormSettings,
  services,
  departments,
  serviceProviders,
  workspace_owner,
  variant = 'modal',
  onClose,
  onPrint,
  onSendReminder,
  onScheduleFollowUp,
  onShareSummary,
  onEditInvitee,
  onEditBooking,
  onReschedule,
  onViewActivityLog,
  onCopyBookingLink,
  onMarkCompleted,
  onMarkNoShow,
  onCancelBooking,
  onDeleteBooking,
  onSaveAdminNotice,
}: BookingDetailsCardProps) {
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

  const selectedServiceIds = (intakeForm?.services as string[]) || [];
  const selectedServiceNames = selectedServiceIds
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

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

  const [copy_state, set_copy_state] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );

  const handle_copy_booking_link = async () => {
    if (onCopyBookingLink) {
      onCopyBookingLink();
      return;
    }
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/bookings/${booking.id}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      set_copy_state('copied');
    } catch (copyError) {
      console.error('Failed to copy booking link:', copyError);
      set_copy_state('error');
    } finally {
      window.setTimeout(() => set_copy_state('idle'), 2000);
    }
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
            <button
              type="button"
              onClick={onShareSummary}
              className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 shadow-sm transition hover:bg-green-100"
            >
              Share Summary
            </button>
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Customer Information
              </h2>
              <button
                type="button"
                onClick={onEditInvitee}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 print:hidden"
              >
                Edit Invitee
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InfoCard label="Name" value={getDisplayName(booking)} />
              <InfoCard label="Phone" value={getDisplayPhone(booking)} />
              <div className="sm:col-span-2">
                <InfoCard label="Email" value={getDisplayEmail(booking)} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                Booking Information
              </h2>
              <button
                type="button"
                onClick={onEditBooking}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 print:hidden"
              >
                Edit Booking
              </button>
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
              {show_department_row && (
                <div className="sm:col-span-2">
                  <InfoCard label="Department" value={department_name} />
                </div>
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

          {intakeFormSettings?.services?.enabled &&
            selectedServiceNames.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Services
                </h2>
                <div className="flex flex-wrap gap-2">
                  {selectedServiceNames.map((name, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center rounded-full border border-indigo-300 bg-indigo-100 px-3 py-1 text-sm text-indigo-700"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </section>
            )}

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
                onClick={handle_copy_booking_link}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <span>Copy Booking Link</span>
                {copy_state === 'copied' && (
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Copied
                  </span>
                )}
                {copy_state === 'error' && (
                  <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Failed
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onMarkCompleted}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                Mark as Completed
              </button>
              <button
                type="button"
                onClick={onMarkNoShow}
                className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-left text-sm font-medium text-yellow-700 transition hover:bg-yellow-100"
              >
                Mark as No-show
              </button>
              <button
                type="button"
                onClick={onCancelBooking}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 transition hover:bg-red-100"
              >
                Cancel Booking
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
