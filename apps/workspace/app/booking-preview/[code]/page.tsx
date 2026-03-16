'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatDate, formatTime } from '@/src/utils/date';
import { StatusBadge } from '@/src/components/Booking/StatusBadge';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import { normalizeIntakeForm } from '@/src/utils/intakeForm';
import type { Service, Department, ServiceProvider } from '@/src/types/booking-entities';
import type { Booking } from '@/src/types/booking';

type BookingPreviewData = Omit<Booking, 'id' | 'workspace_id' | 'host_user_id'>;

interface ApiResponse {
  booking: BookingPreviewData;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: Record<string, unknown> | null;
}

export default function BookingPreviewPage() {
  const { code } = useParams<{ code: string }>();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!code) return;

    const fetchBooking = async () => {
      try {
        const res = await fetch(`/api/booking-preview/${code}`);
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('Failed to fetch');
        const json: ApiResponse = await res.json();
        setData(json);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [code]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center bg-white rounded-xl shadow-lg p-10 max-w-md mx-4">
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
          <p className="text-slate-500">
            The booking you are looking for does not exist or the link is invalid.
          </p>
        </div>
      </div>
    );
  }

  const { booking, department, serviceProvider, services, intakeFormSettings } = data;
  const intakeForm = normalizeIntakeForm(
    intakeFormSettings as Parameters<typeof normalizeIntakeForm>[0]
  );

  return (
    <div className="flex items-start justify-center min-h-screen bg-gray-100 py-8 px-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden">
        <BookingPreviewContent
          booking={booking}
          department={department}
          serviceProvider={serviceProvider}
          services={services}
          intakeFormSettings={intakeForm}
        />
      </div>
    </div>
  );
}

function BookingPreviewContent({
  booking,
  department,
  serviceProvider,
  services,
  intakeFormSettings,
}: {
  booking: BookingPreviewData;
  department: Department | null;
  serviceProvider: ServiceProvider | null;
  services: Service[];
  intakeFormSettings: NormalizedIntakeForm | null;
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

  const showAdditionalInfo =
    intakeFormSettings?.additional_description === true ||
    intakeFormSettings === null;

  const displayName =
    booking.invitee_name?.trim() || booking.contacts?.name?.trim() || 'N/A';
  const displayEmail =
    booking.invitee_email?.trim() || booking.contacts?.email?.trim() || 'N/A';
  const displayPhone =
    booking.invitee_phone?.trim() || booking.contacts?.phone?.trim() || 'N/A';

  const departmentName = department?.name || 'N/A';
  const providerName =
    serviceProvider?.raw_user_meta_data?.full_name ||
    serviceProvider?.raw_user_meta_data?.name ||
    serviceProvider?.email ||
    'N/A';

  return (
    <>
      <div className="border-b border-slate-200 px-6 py-4">
        <h3 className="text-xl font-semibold text-slate-800">Booking Details</h3>
        {booking.created_at && (
          <p className="text-xs text-slate-500 mt-0.5">
            Created on {formatDate(booking.created_at)} at{' '}
            {formatTime(booking.created_at)}
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Invitee Information */}
        <div>
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Invitee Information
          </h4>
          <div className="space-y-3">
            <DetailRow label="Name" value={displayName} />
            <DetailRow label="Email" value={displayEmail} />
            <DetailRow label="Phone" value={displayPhone} />
          </div>
        </div>

        {/* Booking Details */}
        <div>
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Booking Details
          </h4>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-slate-600 w-32">
                Event Type:
              </span>
              <span className="text-slate-800">
                {booking.event_types?.title || 'N/A'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-slate-600 w-32">
                Status:
              </span>
              <StatusBadge
                status={booking.status || 'Pending'}
                className="inline-flex px-3 py-1 rounded-full"
              />
            </div>
            <DetailRow label="Department" value={departmentName} />
            <DetailRow label="Service Provider" value={providerName} />
          </div>
        </div>

        {/* Date & Time */}
        <div>
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Date & Time
          </h4>
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center">
              <span className="text-sm font-medium text-slate-600 w-32">
                Start Date/Time:
              </span>
              <span className="text-slate-800">
                {booking.start_at
                  ? `${formatDate(booking.start_at)}, ${formatTime(booking.start_at)}`
                  : 'N/A'}
              </span>
            </div>
            {booking.end_at && (
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  End Date/Time:
                </span>
                <span className="text-slate-800">
                  {formatDate(booking.end_at)}, {formatTime(booking.end_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Services */}
        {intakeFormSettings?.services?.enabled && selectedServiceNames.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Services
            </h4>
            <div className="flex flex-wrap gap-2">
              {selectedServiceNames.map((name, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-300 text-sm"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {fieldsToShow.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Custom Fields
            </h4>
            <div className="space-y-3">
              {fieldsToShow.map((field) => {
                const value = customFieldValues[field.id];
                return (
                  <div
                    key={field.id}
                    className="flex flex-col sm:flex-row sm:items-center"
                  >
                    <span className="text-sm font-medium text-slate-600 w-32">
                      {field.label}:
                    </span>
                    <span className="text-slate-800">
                      {typeof value === 'string' || typeof value === 'number'
                        ? String(value)
                        : Array.isArray(value)
                          ? value.join(', ')
                          : 'N/A'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Information */}
        {showAdditionalInfo && (
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Additional Information
            </h4>
            <p className="text-slate-800 whitespace-pre-wrap">{displayNotes}</p>
          </div>
        )}
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center">
      <span className="text-sm font-medium text-slate-600 w-32">{label}:</span>
      <span className="text-slate-800">{value}</span>
    </div>
  );
}
