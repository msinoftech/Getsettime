'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatDate, formatTime } from '@/src/utils/date';
import { StatusBadge } from '@/src/components/Booking/StatusBadge';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import {
  normalizeIntakeForm,
  buildIntakeCustomFieldsForPreviewDisplay,
} from '@/src/utils/intakeForm';
import type { Service, Department, ServiceProvider } from '@/src/types/booking-entities';
import type { Booking } from '@/src/types/booking';
import {
  capitalize_booking_display_label,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import {
  get_service_provider_display_name,
  get_service_provider_display_phone,
} from '@/src/utils/service_provider_display';

type BookingPreviewData = Omit<Booking, 'id' | 'workspace_id' | 'host_user_id'>;

const HIDDEN_ACTION_STATUSES = ['cancelled', 'completed'];

/** URL-encoded `{{1}}` sometimes pasted into booking links by mistake. */
const BOOKING_CODE_PLACEHOLDER = '%7B%7B1%7D%7D';

const PAGE_SHELL_CLASS = 'min-h-screen bg-slate-100 text-slate-900 print:bg-white print:p-0';

/**
 * Popup print windows use ~about:blank; relative /_next/ stylesheet URLs resolve incorrectly
 * unless overridden. Keeps Tailwind/layout when saving as PDF.
 */
function serialize_document_styles(origin: string): string {
  return Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
    .map((node) => {
      if (node.nodeName === 'LINK') {
        const el = node as HTMLLinkElement;
        const raw_href = el.getAttribute('href');
        if (!raw_href?.trim()) {
          return node.outerHTML;
        }
        let absolute_url: string;
        try {
          absolute_url = new URL(raw_href, origin).href.replace(/"/g, '&quot;');
        } catch {
          return node.outerHTML;
        }
        const media = el.getAttribute('media');
        const media_attr = media ? ` media="${media.replace(/"/g, '&quot;')}"` : '';
        return `<link rel="stylesheet"${media_attr} href="${absolute_url}" />`;
      }
      return node.outerHTML;
    })
    .join('\n');
}

function booking_preview_supplement_css(): string {
  return `@media print {
  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #print-area, #print-area * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #print-area .bp-print-hero-row {
    display: flex !important;
    flex-direction: row !important;
    align-items: flex-start !important;
    justify-content: space-between !important;
    gap: 1.5rem !important;
    flex-wrap: nowrap !important;
  }
  #print-area .bp-print-brand-grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 0.75rem !important;
    min-width: 280px !important;
    max-width: 400px !important;
    align-content: start !important;
  }
  #print-area .bp-print-meta-row > span {
    display: inline-flex !important;
    align-items: center !important;
    gap: 0.5rem !important;
    margin-right: 1rem !important;
    white-space: normal !important;
  }
  #print-area .bp-print-status-row {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 1rem !important;
    flex-wrap: nowrap !important;
  }
  #print-area .bp-print-main {
    display: grid !important;
    grid-template-columns: 1.55fr 0.95fr !important;
    gap: 1.5rem !important;
    align-items: start !important;
  }
  #print-area .bp-print-fields-grid {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 1rem !important;
  }
  #print-area .bp-print-label {
    letter-spacing: 0.035em !important;
  }
  }
`;
}

async function wait_for_print_documents(doc: Document): Promise<void> {
  try {
    await doc.fonts?.ready;
  } catch {
    /* ignore */
  }
  const sheets = [...doc.querySelectorAll('link[rel="stylesheet"]')] as HTMLLinkElement[];
  await Promise.all(
    sheets.map(
      (link) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const finish = (): void => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };

          try {
            if (link.sheet != null) {
              finish();
              return;
            }
          } catch {
            finish();
            return;
          }

          window.setTimeout(finish, 2500);
          link.addEventListener('load', finish, { once: true });
          link.addEventListener('error', finish, { once: true });
        })
    )
  );
}

interface ApiResponse {
  booking: BookingPreviewData;
  booking_id: string;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  workspaceOwner: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: Record<string, unknown> | null;
  workspace_slug: string | null;
  workspace_name: string | null;
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

function resolvePhysicalAddress(
  location: Record<string, unknown> | null,
  metadata: Record<string, unknown> | null
): string | null {
  const keys = ['address', 'physical_address', 'location_address', 'venue'];
  for (const src of [location, metadata]) {
    if (!src || typeof src !== 'object') continue;
    for (const key of keys) {
      const v = src[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
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

function humanize_workspace_title(slug: string | null, name: string | null): string {
  if (name?.trim()) return name.trim();
  if (!slug) return 'Workspace';
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function workspace_brand_initials(name: string | null, slug: string | null): string {
  const source = (name?.trim() || slug?.replace(/-/g, ' ') || 'GS').slice(0, 48);
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase() || 'GS';
}

function to_google_calendar_utc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
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
        workspace_name: json.workspace_name ?? null,
        workspace_slug: json.workspace_slug ?? null,
        booking_id: json.booking_id ?? '',
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
        <div className="text-center rounded-[28px] border border-slate-200 bg-white px-10 py-12 shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600 text-sm font-medium">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className={`flex items-center justify-center ${PAGE_SHELL_CLASS} p-4 md:p-8`}>
        <div className="text-center rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)] p-10 max-w-md w-full mx-4">
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

  const { booking, department, serviceProvider, workspaceOwner, services, intakeFormSettings } =
    data;
  const intakeForm = normalizeIntakeForm(
    intakeFormSettings as Parameters<typeof normalizeIntakeForm>[0]
  );

  return (
    <div className={`${PAGE_SHELL_CLASS} p-4 md:p-8`}>
      <BookingPreviewContent
        previewCode={code}
        booking_id={data.booking_id}
        workspace_name={data.workspace_name}
        workspace_slug={data.workspace_slug}
        booking={booking}
        department={department}
        serviceProvider={serviceProvider}
        workspaceOwner={workspaceOwner}
        services={services}
        intakeFormSettings={intakeForm}
        intakeFormRaw={intakeFormSettings}
        showActions={!!showActions}
        onCancel={() => setShowCancelDialog(true)}
        onReschedule={handleReschedule}
      />

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
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 shadow-sm transition hover:bg-rose-100 disabled:opacity-50"
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
  previewCode,
  booking_id,
  workspace_name,
  workspace_slug,
  booking,
  department,
  serviceProvider,
  workspaceOwner,
  services,
  intakeFormSettings,
  intakeFormRaw,
  showActions,
  onCancel,
  onReschedule,
}: {
  previewCode: string;
  booking_id: string;
  workspace_name: string | null;
  workspace_slug: string | null;
  booking: BookingPreviewData;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  workspaceOwner: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: NormalizedIntakeForm | null;
  intakeFormRaw: Record<string, unknown> | null;
  showActions: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const bookingLink = useMemo(() => {
    if (typeof window === 'undefined') return `/booking-preview/${previewCode}`;
    return `${window.location.origin}/booking-preview/${previewCode}`;
  }, [previewCode]);

  const intakeFormData = booking.metadata?.intake_form as Record<string, unknown> | undefined;

  const rawServices = intakeFormData?.services;
  const selectedServiceNames = (
    Array.isArray(rawServices)
      ? rawServices.filter((x): x is string => typeof x === 'string')
      : []
  )
    .map((id) => services.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];
  const intakeServicesDisplay =
    selectedServiceNames.length > 0 ? selectedServiceNames.join(', ') : '—';

  const intakePayload = intakeFormData ?? {};
  const intakeCustomFieldRows = buildIntakeCustomFieldsForPreviewDisplay(
    intakePayload,
    intakeFormRaw,
    intakeFormSettings?.custom_fields ?? null
  );

  const notes = intakeFormData?.additional_description as string | undefined;
  const legacyNotes = booking.metadata?.notes as string | undefined;
  const metaDesc = booking.metadata?.additional_description as string | undefined;
  const displayNotes = notes || legacyNotes || metaDesc || 'N/A';

  const fileUploadUrl = intakeFormData?.file_upload_url as string | undefined;
  const fileUploadName = fileUploadUrl
    ? decodeURIComponent(fileUploadUrl.split('/').pop() || 'file')
    : '';

  const showNotesInAdditional =
    (intakeFormSettings?.additional_description === true || intakeFormSettings === null) &&
    Boolean(displayNotes.trim()) &&
    displayNotes !== 'N/A';

  /** Custom fields / uploads only — notes stay in Your Note card to avoid duplication. */
  const showAdditionalInformationSection =
    intakeCustomFieldRows.length > 0 || !!fileUploadUrl;

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
  const hostContactPhone = get_service_provider_display_phone(
    serviceProvider,
    workspaceOwner,
    ''
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
  const physicalAddress = resolvePhysicalAddress(booking.location, booking.metadata);

  const workspaceTitle = humanize_workspace_title(workspace_slug, workspace_name);
  const brandInitials = workspace_brand_initials(workspace_name, workspace_slug);
  const appointmentRefDisplay = booking_id || previewCode;

  const durationMins = booking.event_types?.duration_minutes;
  const durationDisplay =
    typeof durationMins === 'number' && Number.isFinite(durationMins) && durationMins > 0
      ? `${Math.round(durationMins)} mins`
      : '—';

  const serviceFieldValue =
    intakeServicesDisplay !== '—' ? intakeServicesDisplay : booking.event_types?.title ?? '—';

  const departmentFieldValue = has_department ? departmentName : '—';

  const createdAtDisplay =
    booking.created_at != null
      ? `${formatDate(booking.created_at)} at ${formatTime(booking.created_at)}`
      : '—';

  const statusLower = (booking.status || '').toLowerCase();
  const heroTitle =
    statusLower === 'cancelled'
      ? 'This appointment was cancelled'
      : statusLower === 'confirmed' || statusLower === 'completed'
        ? 'Your Appointment is Confirmed'
        : 'Your appointment details';

  const statusCardHeadline =
    statusLower === 'cancelled'
      ? 'This booking is no longer active'
      : statusLower === 'confirmed' || statusLower === 'completed'
        ? 'Confirmed and ready for your visit'
        : `Status: ${statusLabel}`;

  const workspaceEmail = workspaceOwner?.email?.trim() || '—';
  const workspacePhone =
    get_service_provider_display_phone(null, workspaceOwner, '') || '—';

  const setFlashMessage = (message: string) => {
    setNoticeMessage(message);
    window.setTimeout(() => {
      setNoticeMessage((current) => (current === message ? null : current));
    }, 2200);
  };

  const handlePrint = () => {
    if (typeof window === 'undefined') return;

    const printableNode = printRef.current;
    if (!printableNode) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=960');
    if (!printWindow) {
      window.print();
      return;
    }

    const origin = window.location.origin;
    const styles_blob = serialize_document_styles(origin);

    const print_html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1280" />
  <base href="${origin}/" />
  <title>Appointment-${String(appointmentRefDisplay).replace(/</g, '')}</title>
  ${styles_blob}
  <style>
    ${booking_preview_supplement_css()}
    @page { size: A4; margin: 14mm 12mm; }
    html, body {
      background: #f8fafc;
      margin: 0;
      padding: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, Helvetica, sans-serif;
    }
    .no-print { display: none !important; }
    .print-shell {
      max-width: 100% !important;
      box-shadow: none !important;
      margin: 0 auto !important;
      overflow: visible !important;
    }
    .print-card { break-inside: avoid; page-break-inside: avoid; }
    @media print {
      html, body {
        background: #fff !important;
      }
      .no-print { display: none !important; }
      .print-shell {
        overflow: visible !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 24px !important;
      }
    }
  </style>
</head>
<body>
${printableNode.outerHTML}
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(print_html);
    printWindow.document.close();

    try {
      printWindow.resizeTo(1280, 960);
    } catch {
      /* ignore resize restrictions */
    }

    void wait_for_print_documents(printWindow.document).then(() => {
      window.requestAnimationFrame(() => {
        printWindow.focus();
        printWindow.print();
        window.setTimeout(() => printWindow.close(), 500);
      });
    });
  };

  const handleShareSummary = async () => {
    const shareText = `Appointment ${appointmentRefDisplay} for ${displayName} on ${startDisplay} with ${providerDisplayName}`;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Appointment ${appointmentRefDisplay}`,
          text: shareText,
          url: bookingLink,
        });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${bookingLink}`);
      }
      setFlashMessage('Appointment details shared successfully.');
    } catch {
      setFlashMessage('Share was cancelled.');
    }
  };

  const handleCopyBookingLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingLink);
      setFlashMessage('Appointment link copied.');
    } catch {
      window.alert(`Copy this appointment link manually:\n${bookingLink}`);
    }
  };

  const handleAddToCalendar = () => {
    const title = encodeURIComponent(`${serviceFieldValue} with ${providerDisplayName}`);
    const details = encodeURIComponent(
      `Reference: ${appointmentRefDisplay}\n${workspaceTitle}\n${departmentFieldValue !== '—' ? `Department: ${departmentFieldValue}\n` : ''}`
    );
    const location = encodeURIComponent(physicalAddress || workspaceTitle || '');
    let calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    if (booking.start_at && booking.end_at) {
      const s = to_google_calendar_utc(booking.start_at);
      const e = to_google_calendar_utc(booking.end_at);
      if (s && e) calendarUrl += `&dates=${s}/${e}`;
    }
    window.open(calendarUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCallWorkspace = () => {
    const raw = workspacePhone.replace(/\s/g, '');
    if (!raw || raw === '—') return;
    window.location.href = `tel:${raw}`;
  };

  const handleCallProvider = () => {
    const raw = hostContactPhone.replace(/\s/g, '');
    if (!raw) return;
    window.location.href = `tel:${raw}`;
  };

  const handleGetDirections = () => {
    const query = encodeURIComponent(physicalAddress || '');
    if (!query) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const canDirections = Boolean(physicalAddress);

  return (
    <>
      <style>{`
${booking_preview_supplement_css()}
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-shell {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            max-width: 100% !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .print-card { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div
        ref={printRef}
        id="print-area"
        className="print-shell mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.12)] print:overflow-visible"
      >
          <div className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.22),_transparent_30%),linear-gradient(135deg,#0f172a_0%,#172554_50%,#1d4ed8_100%)] px-6 py-7 text-white md:px-8 md:py-8">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:28px_28px] opacity-20" />

            <div className="bp-print-hero-row relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="bp-print-label flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-xl font-bold tracking-[0.2em] text-white shadow-lg backdrop-blur">
                  {brandInitials}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{heroTitle}</h1>
                    <span className="bp-print-label inline-flex items-center rounded-full border border-emerald-300/30 bg-emerald-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-100">
                      {statusLabel}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="bp-print-label inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
                      Appointment #{appointmentRefDisplay}
                    </span>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                    Keep this page for your records. You can print your appointment slip, call the
                    clinic, get directions, or share these details anytime.
                  </p>

                  <div className="bp-print-meta-row mt-4 flex flex-wrap items-center gap-4 text-sm text-blue-50">
                    <span className="inline-flex items-center gap-2">
                      <PreviewIcon name="building" className="h-4 w-4" />
                      {capitalize_booking_display_label(workspaceTitle)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <PreviewIcon name="calendar" className="h-4 w-4" />
                      Booked on {createdAtDisplay}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <PreviewIcon name="user" className="h-4 w-4" />
                      Booked by {displayName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bp-print-brand-grid grid gap-3 sm:grid-cols-2 xl:min-w-[360px] xl:max-w-[400px]">
                {departmentFieldValue !== '—' && (
                  <BrandBadge label="Department" value={departmentFieldValue} />
                )}
                <BrandBadge label="Service" value={serviceFieldValue} />
                <BrandBadge
                  label="Doctor / Provider"
                  value={providerDisplayName}
                  className="sm:col-span-2"
                />
              </div>
            </div>
          </div>

          <div className="no-print border-b border-slate-200 bg-white/90 px-6 py-4 backdrop-blur md:px-8">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                type="button"
              >
                <PreviewIcon name="print" className="h-4 w-4" />
                Print Appointment Slip
              </button>
              <button
                onClick={handleAddToCalendar}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100"
                type="button"
              >
                <PreviewIcon name="calendar" className="h-4 w-4" />
                Add to Calendar
              </button>
              <button
                onClick={handleShareSummary}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800 shadow-sm transition hover:bg-emerald-100"
                type="button"
              >
                <PreviewIcon name="share" className="h-4 w-4" />
                Share Details
              </button>
              <button
                onClick={handleCopyBookingLink}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                type="button"
              >
                Copy Link
              </button>
            </div>
            {noticeMessage && (
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-medium text-slate-700">
                  {noticeMessage}
                </span>
              </div>
            )}
          </div>

          <div className="bp-print-main grid items-start gap-6 p-6 md:p-8 xl:grid-cols-[1.55fr_0.95fr]">
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[24px] border border-emerald-200 bg-emerald-50 shadow-sm">
                <div className="p-5">
                  <div className="bp-print-status-row flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="bp-print-label text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
                        Appointment Status
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-emerald-950">{statusCardHeadline}</h2>
                      <p className="mt-2 text-sm leading-6 text-emerald-800">
                        Please arrive a few minutes early and carry any relevant reports or documents.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-center shadow-sm">
                      <p className="bp-print-label text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Appointment ID
                      </p>
                      <p className="mt-1 text-2xl font-bold text-emerald-950">#{appointmentRefDisplay}</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  icon={<PreviewIcon name="calendar" className="h-4 w-4" />}
                  title="Appointment Schedule"
                />
                <div className="bp-print-fields-grid grid gap-4 p-5 sm:grid-cols-2">
                  <InfoCard label="Start Date / Time" value={startDisplay} accent="indigo" />
                  <InfoCard label="End Date / Time" value={endDisplay} />
                  <InfoCard label="Duration" value={durationDisplay} />
                  <InfoCard
                    label="Status"
                    badge={
                      <StatusBadge
                        status={booking.status || 'Pending'}
                        className="inline-flex px-3 py-1 rounded-full text-sm font-semibold"
                      />
                    }
                  />
                </div>
              </section>

              <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                  icon={<PreviewIcon name="stethoscope" className="h-4 w-4" />}
                  title="Visit details"
                />
                <div className="bp-print-fields-grid grid gap-4 p-5 sm:grid-cols-2">
                  <InfoCard label="Appointment Type" value={eventTypeDisplay} accent="slate" />
                  <InfoCard label="Host Contact" value={hostContactPhone || '—'} accent="slate" />
                </div>
              </section>

              <div className="booking-preview-extra space-y-6 border-t border-slate-200 pt-8">
                <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                  <SectionHeader
                    icon={<PreviewIcon name="user" className="h-4 w-4" />}
                    title="Your Details"
                  />
                  <div className="bp-print-fields-grid grid gap-4 p-5 sm:grid-cols-2">
                    <InfoCard label="Full Name" value={displayName} />
                    <InfoCard label="Phone Number" value={displayPhone} />
                    <InfoCard label="Email Address" value={displayEmail} className="sm:col-span-2" />
                  </div>
                </section>

                <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                  <SectionHeader
                    icon={<PreviewIcon name="file" className="h-4 w-4" />}
                    title="Your Note"
                  />
                  <div className="p-5">
                    <div className="whitespace-pre-line rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                      {showNotesInAdditional ? displayNotes : '—'}
                    </div>
                  </div>
                </section>

                {showAdditionalInformationSection && (
                  <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                    <SectionHeader
                      icon={<PreviewIcon name="file" className="h-4 w-4" />}
                      title="Additional Information"
                    />
                    <div className="space-y-4 p-5">
                      {intakeCustomFieldRows.length > 0 && (
                        <div className="space-y-2 text-sm leading-7 text-slate-800">
                          {intakeCustomFieldRows.map((row) => (
                            <p key={row.id} className="break-words">
                              <span className="font-bold text-slate-900">{row.label}:</span>{' '}
                              <span className="font-normal">{row.value}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      {fileUploadUrl && (
                        <div>
                          <div className="bp-print-label mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Uploaded file
                          </div>
                          <a
                            href={fileUploadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 shadow-sm transition hover:bg-blue-100"
                          >
                            <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="max-w-xs truncate">{fileUploadName}</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <section className="print-card overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                      <PreviewIcon name="building" className="h-4 w-4" />
                    </div>
                    <div>
                      <h2 className="bp-print-label text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                        Clinic / Business Information
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        Location and contact details for your visit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold leading-snug text-slate-900">
                        {capitalize_booking_display_label(workspaceTitle)}
                      </h3>
                      <span className="bp-print-label shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Verified
                      </span>
                    </div>
                    {physicalAddress ? (
                      <p className="mt-2 text-sm font-medium text-blue-700">{physicalAddress}</p>
                    ) : null}
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      Thank you for booking with{' '}
                      <strong className="font-semibold text-slate-800">
                        {capitalize_booking_display_label(workspaceTitle)}
                      </strong>
                      . Reach out using the details below if you need anything before your visit.
                    </p>
                  </div>

                  {physicalAddress && (
                    <InfoMini
                      icon={<PreviewIcon name="map" className="h-4 w-4" />}
                      label="Address"
                      value={physicalAddress}
                    />
                  )}
                  <InfoMini
                    icon={<PreviewIcon name="phone" className="h-4 w-4" />}
                    label="Workspace phone"
                    value={workspacePhone}
                  />
                  <InfoMini
                    icon={<PreviewIcon name="mail" className="h-4 w-4" />}
                    label="Email"
                    value={workspaceEmail}
                  />
                </div>
              </section>

              <section className="print-card rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="bp-print-label mb-4 text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                  Need Help?
                </h2>
                <div className="grid gap-3">
                  <ActionButton
                    label="Call Clinic"
                    tone="primary"
                    disabled={!workspacePhone || workspacePhone === '—'}
                    onClick={handleCallWorkspace}
                  />
                  <ActionButton
                    label="Call Provider"
                    disabled={!hostContactPhone}
                    onClick={handleCallProvider}
                  />
                  <ActionButton
                    label="Get Directions"
                    disabled={!canDirections}
                    onClick={handleGetDirections}
                  />
                  {joinUrl && (
                    <a
                      href={joinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Join / Open Meeting Link
                    </a>
                  )}
                  {showActions && (
                    <>
                      <ActionButton label="Reschedule" tone="warning" onClick={onReschedule} />
                      <ActionButton label="Cancel" tone="danger" onClick={onCancel} />
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="no-print border-t border-slate-200 bg-slate-50 px-6 py-4 md:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={handleGetDirections}
                disabled={!canDirections}
                className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                type="button"
              >
                Get Directions
              </button>
              <button
                onClick={handleShareSummary}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-5 py-2.5 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100"
                type="button"
              >
                <PreviewIcon name="share" className="h-4 w-4" />
                Share Details
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                type="button"
              >
                <PreviewIcon name="print" className="h-4 w-4" />
                Print Appointment Slip
              </button>
            </div>
          </div>
      </div>
    </>
  );
}

function SectionHeader({
  icon,
  title,
  action,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/90 px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          {icon}
        </div>
        <h2 className="bp-print-label text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{title}</h2>
      </div>
      {action ? (
        <button
          className="no-print text-sm font-medium text-indigo-600 hover:text-indigo-700"
          type="button"
          onClick={onAction}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

function BrandBadge({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur ${className}`}
    >
      <p className="bp-print-label text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  badge,
  accent = 'slate',
  className = '',
}: {
  label: string;
  value?: string;
  badge?: ReactNode;
  accent?: 'slate' | 'indigo' | 'violet';
  className?: string;
}) {
  const accentClasses: Record<'slate' | 'indigo' | 'violet', string> = {
    slate: 'border-slate-200 bg-slate-50',
    indigo: 'border-blue-200 bg-blue-50/70',
    violet: 'border-violet-200 bg-violet-50/70',
  };

  return (
    <div className={`rounded-2xl border p-4 ${accentClasses[accent]} ${className}`.trim()}>
      <p className="bp-print-label text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      {badge != null ? (
        <div className="mt-2">{badge}</div>
      ) : (
        <p className="mt-2 text-base font-medium leading-6 text-slate-800">{value ?? ''}</p>
      )}
    </div>
  );
}

function InfoMini({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="bp-print-label text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 break-words text-sm font-medium leading-6 text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  tone = 'default',
  disabled,
  onClick,
}: {
  label: string;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const toneClasses: Record<'default' | 'primary' | 'success' | 'warning' | 'danger', string> = {
    default: 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    primary: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    warning: 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
    danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  };

  return (
    <button
      className={`rounded-xl border px-4 py-3 text-left text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]}`}
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}

type IconName =
  | 'building'
  | 'calendar'
  | 'file'
  | 'mail'
  | 'map'
  | 'phone'
  | 'print'
  | 'share'
  | 'stethoscope'
  | 'user';

function PreviewIcon({ name, className = 'h-4 w-4' }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    viewBox: '0 0 24 24',
    xmlns: 'http://www.w3.org/2000/svg',
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16" />
          <path d="M9 21v-4h3v4" />
          <path d="M8 7h1" />
          <path d="M12 7h1" />
          <path d="M8 11h1" />
          <path d="M12 11h1" />
          <path d="M3 21h18" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      );
    case 'mail':
      return (
        <svg {...common}>
          <rect width="20" height="16" x="2" y="4" rx="2" ry="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="M12 21s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...common}>
          <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.5 2.1L8 9.5a16 16 0 0 0 6.5 6.5l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.5.6A2 2 0 0 1 22 16.9z" />
        </svg>
      );
    case 'print':
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <path d="M6 14h12v8H6z" />
        </svg>
      );
    case 'share':
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="m8.59 13.51 6.82 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      );
    case 'stethoscope':
      return (
        <svg {...common}>
          <path d="M6 3v5a4 4 0 0 0 8 0V3" />
          <path d="M6 3H4" />
          <path d="M14 3h2" />
          <path d="M10 12v2a5 5 0 0 0 10 0v-1" />
          <circle cx="20" cy="10" r="2" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    default:
      return null;
  }
}
