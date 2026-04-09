'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDate, formatTime } from '@/src/utils/date';
import { StatusBadge } from '@/src/components/Booking/StatusBadge';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import { normalizeIntakeForm } from '@/src/utils/intakeForm';
import type { Service, Department, ServiceProvider } from '@/src/types/booking-entities';
import type { Booking } from '@/src/types/booking';
import {
  capitalize_booking_display_label,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import { get_service_provider_display_name } from '@/src/utils/service_provider_display';

type BookingPreviewData = Omit<Booking, 'id' | 'workspace_id' | 'host_user_id'>;

const HIDDEN_ACTION_STATUSES = ['cancelled', 'completed'];

/** URL-encoded `{{1}}` sometimes pasted into booking links by mistake. */
const BOOKING_CODE_PLACEHOLDER = '%7B%7B1%7D%7D';

const PAGE_SHELL_CLASS =
  'min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]';

interface ApiResponse {
  booking: BookingPreviewData;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  workspaceOwner: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: Record<string, unknown> | null;
  workspace_slug: string | null;
}

/** First HTTPS/HTTP URL found on common keys (location + metadata). */
function resolveMeetingJoinUrl(
  location: Record<string, unknown> | null,
  metadata: Record<string, unknown> | null
): string | null {
  const fromValue = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    if (t.startsWith('http://') || t.startsWith('https://')) return t;
    return null;
  };

  const keys = [
    'url',
    'link',
    'meeting_url',
    'join_url',
    'hangoutLink',
    'hangout_link',
    'meet_link',
    'conference_url',
  ];

  if (location && typeof location === 'object') {
    for (const key of keys) {
      const u = fromValue(location[key]);
      if (u) return u;
    }
  }

  if (metadata && typeof metadata === 'object') {
    for (const key of keys) {
      const u = fromValue(metadata[key]);
      if (u) return u;
    }
  }

  return null;
}

function formatStatusLabel(status: string | null | undefined): string {
  if (!status?.trim()) return 'Pending';
  return status
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-sm backdrop-blur">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-gradient-to-b from-violet-500 to-sky-500" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 border-b border-slate-100 py-4 last:border-b-0 md:grid-cols-[180px_1fr] md:gap-4">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="text-base font-semibold text-slate-800">
        {highlight ? (
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
            {value}
          </span>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

export default function BookingPreviewPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchBooking = useCallback(async () => {
    if (!code) return;
    if (code.includes(BOOKING_CODE_PLACEHOLDER)) {
      const cleanCode = code.replaceAll(BOOKING_CODE_PLACEHOLDER, '');
      if (cleanCode) {
        router.replace(`/booking-preview/${cleanCode}`);
        return;
      }
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/booking-preview/${code}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch');
      const json = (await res.json()) as ApiResponse;
      setData({
        ...json,
        workspaceOwner: json.workspaceOwner ?? null,
      });
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  const handleCancel = async () => {
    if (!code) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/booking-preview/${code}/cancel`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || 'Failed to cancel booking');
        return;
      }
      setShowCancelDialog(false);
      await fetchBooking();
    } catch {
      alert('An error occurred while cancelling.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReschedule = () => {
    if (!data?.workspace_slug || !code) return;
    router.push(`/${data.workspace_slug}?reschedule=${code}`);
  };

  const showActions =
    data?.booking && !HIDDEN_ACTION_STATUSES.includes(data.booking.status?.toLowerCase() ?? '');

  if (loading) {
    return (
      <div className={`flex items-center justify-center ${PAGE_SHELL_CLASS} p-4 md:p-8`}>
        <div className="text-center rounded-[32px] border border-white/60 bg-white/70 px-10 py-12 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-violet-200 border-t-violet-600 mx-auto" />
          <p className="mt-4 text-slate-600 text-sm font-medium">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className={`flex items-center justify-center ${PAGE_SHELL_CLASS} p-4 md:p-8`}>
        <div className="text-center rounded-[32px] border border-white/60 bg-white/80 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl p-10 max-w-md w-full mx-4">
          <svg
            className="h-16 w-16 text-slate-300 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <h2 className="text-2xl font-semibold text-slate-800 mb-2">Booking Not Found</h2>
          <p className="text-slate-500 text-sm">
            The booking you are looking for does not exist or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const { booking, department, serviceProvider, workspaceOwner, services, intakeFormSettings } = data;
  const intakeForm = normalizeIntakeForm(
    intakeFormSettings as Parameters<typeof normalizeIntakeForm>[0]
  );

  return (
    <div className={`${PAGE_SHELL_CLASS} p-4 md:p-8`}>
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[32px] border border-white/60 bg-white/70 shadow-[0_25px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl">
          <BookingPreviewContent
            booking={booking}
            department={department}
            serviceProvider={serviceProvider}
            workspaceOwner={workspaceOwner}
            services={services}
            intakeFormSettings={intakeForm}
            showActions={!!showActions}
            onCancel={() => setShowCancelDialog(true)}
            onReschedule={handleReschedule}
          />
        </div>
      </div>

      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Cancel Booking</h3>
            <p className="text-sm text-slate-600 mb-6">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCancelDialog(false)}
                disabled={cancelling}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingPreviewContent({
  booking,
  department,
  serviceProvider,
  workspaceOwner,
  services,
  intakeFormSettings,
  showActions,
  onCancel,
  onReschedule,
}: {
  booking: BookingPreviewData;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  workspaceOwner: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: NormalizedIntakeForm | null;
  showActions: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const intakeFormData = booking.metadata?.intake_form as Record<string, unknown> | undefined;

  const selectedServiceIds = (intakeFormData?.services as string[]) || [];
  const selectedServiceNames = selectedServiceIds
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const customFieldValues = intakeFormData || {};
  const fieldsToShow =
    intakeFormSettings?.custom_fields?.filter((field) => {
      const value = customFieldValues[field.id];
      return value !== undefined && value !== null && value !== '';
    }) ?? [];

  const notes = intakeFormData?.additional_description as string | undefined;
  const legacyNotes = booking.metadata?.notes as string | undefined;
  const metaDesc = booking.metadata?.additional_description as string | undefined;
  const displayNotes = notes || legacyNotes || metaDesc || 'N/A';

  const fileUploadUrl = intakeFormData?.file_upload_url as string | undefined;
  const fileUploadName = fileUploadUrl ? decodeURIComponent(fileUploadUrl.split('/').pop() || 'file') : '';

  const showAdditionalInfo =
    intakeFormSettings?.additional_description === true || intakeFormSettings === null;

  const displayName =
    booking.invitee_name?.trim() || booking.contacts?.name?.trim() || 'N/A';
  const displayEmail =
    booking.invitee_email?.trim() || booking.contacts?.email?.trim() || 'N/A';
  const displayPhone =
    booking.invitee_phone?.trim() || booking.contacts?.phone?.trim() || 'N/A';

  const eventDurationInner = getEventTypeDurationInner(booking.event_types?.duration_minutes);

  const has_department = Boolean(department?.name?.trim());
  const departmentName = has_department
    ? capitalize_booking_display_label(department?.name?.trim() ?? '')
    : '';
  const providerDisplayName = get_service_provider_display_name(
    serviceProvider,
    workspaceOwner
  );

  const eventTypeDisplay =
    booking.event_types?.title != null
      ? `${booking.event_types.title}${eventDurationInner != null ? ` (${eventDurationInner})` : ''}`
      : 'N/A';

  const startDisplay =
    booking.start_at != null
      ? `${formatDate(booking.start_at)}, ${formatTime(booking.start_at)}`
      : 'N/A';
  const endDisplay =
    booking.end_at != null ? `${formatDate(booking.end_at)}, ${formatTime(booking.end_at)}` : 'N/A';

  const statusLabel = formatStatusLabel(booking.status);
  const joinUrl = resolveMeetingJoinUrl(booking.location, booking.metadata);

  return (
    <>
      <div className="relative overflow-hidden border-b border-slate-200/70 px-6 py-6 md:px-8 md:py-7">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),rgba(14,165,233,0.05),rgba(255,255,255,0.6))]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
              GetSetTime Booking
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Booking Details</h1>
            {booking.created_at && (
              <p className="mt-2 text-sm text-slate-500 md:text-base">
                Created on {formatDate(booking.created_at)} at {formatTime(booking.created_at)}
              </p>
            )}
          </div>

          {showActions && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onReschedule}
                className="rounded-2xl border border-violet-200 bg-white px-5 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-600 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                Cancel Booking
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <PreviewSection title="Invitee Information">
            <PreviewRow label="Name" value={displayName} />
            <PreviewRow label="Email" value={displayEmail} />
            <PreviewRow label="Phone" value={displayPhone} />
          </PreviewSection>

          <PreviewSection title="Booking Details">
            <PreviewRow label="Event Type" value={eventTypeDisplay} />
            <PreviewRow
              label="Status"
              value={
                <StatusBadge status={booking.status || 'Pending'} className="inline-flex px-3 py-1 rounded-full" />
              }
            />
            {has_department && <PreviewRow label="Department" value={departmentName} />}
            <PreviewRow label="Service Provider" value={providerDisplayName} />
          </PreviewSection>

          {intakeFormSettings?.services?.enabled && selectedServiceNames.length > 0 && (
            <PreviewSection title="Services">
              <div className="flex flex-wrap gap-2">
                {selectedServiceNames.map((name, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-800"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </PreviewSection>
          )}

          {fieldsToShow.length > 0 && (
            <PreviewSection title="Custom Fields">
              {fieldsToShow.map((field) => {
                const value = customFieldValues[field.id];
                const text =
                  typeof value === 'string' || typeof value === 'number'
                    ? String(value)
                    : Array.isArray(value)
                      ? value.join(', ')
                      : 'N/A';
                return <PreviewRow key={field.id} label={field.label} value={text} />;
              })}
            </PreviewSection>
          )}

          {fileUploadUrl && (
            <PreviewSection title="Uploaded File">
              <a
                href={fileUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <svg className="h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span className="truncate max-w-xs">{fileUploadName}</span>
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </PreviewSection>
          )}

          {showAdditionalInfo && (
            <PreviewSection title="Additional Information">
              <div className="rounded-3xl border border-slate-100 bg-slate-50/80 p-5 text-slate-700">
                <p className="whitespace-pre-wrap text-[15px] leading-7">{displayNotes}</p>
              </div>
            </PreviewSection>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200/70 bg-slate-900 p-6 text-white shadow-[0_18px_60px_rgba(15,23,42,0.18)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Session Summary</p>
                <h2 className="mt-2 text-xl font-semibold break-words md:text-2xl">
                  {booking.event_types?.title || 'Booking'}
                </h2>
              </div>
              <span className="flex-shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                {statusLabel}
              </span>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Start</div>
                <div className="mt-2 text-base font-semibold">{startDisplay}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">End</div>
                <div className="mt-2 text-base font-semibold">{endDisplay}</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-gradient-to-r from-violet-500/20 to-sky-500/20 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Assigned Provider</div>
                <div className="mt-2 text-lg font-semibold break-words">{providerDisplayName}</div>
                {has_department && (
                  <div className="mt-1 text-sm text-slate-300">Department: {departmentName}</div>
                )}
              </div>
            </div>
          </div>

          {joinUrl && (
            <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Quick Actions</p>
              <div className="mt-5 grid gap-3">
                <a
                  href={joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:-translate-y-0.5"
                >
                  Join / Open Meeting Link
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
