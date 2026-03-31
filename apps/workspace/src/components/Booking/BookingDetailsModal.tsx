'use client';

import React from 'react';
import { formatDate, formatTime } from '@/src/utils/date';
import {
  getServiceProviderName,
  getDepartmentName,
  getDisplayName,
  getDisplayEmail,
  getDisplayPhone,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import { StatusBadge } from './StatusBadge';
import type {
  ServiceProvider,
  Department,
  Service,
} from '@/src/types/booking-entities';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import type { Booking } from '@/src/types/booking';

interface BookingDetailsModalProps {
  booking: Booking;
  onClose: () => void;
  intakeFormSettings: NormalizedIntakeForm | null;
  services: Service[];
  departments: Department[];
  serviceProviders: ServiceProvider[];
}

export function BookingDetailsModal({
  booking,
  onClose,
  intakeFormSettings,
  services,
  departments,
  serviceProviders,
}: BookingDetailsModalProps) {
  const eventDurationInner = getEventTypeDurationInner(
    booking.event_types?.duration_minutes
  );

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
  const displayNotes = notes || legacyNotes || metaDesc || 'N/A';

  const fileUploadUrl = intakeForm?.file_upload_url as string | undefined;
  const fileUploadName = fileUploadUrl ? decodeURIComponent(fileUploadUrl.split('/').pop() || 'file') : '';

  const showAdditionalInfo =
    intakeFormSettings?.additional_description === true ||
    intakeFormSettings === null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div>
            <h3 className="text-xl font-semibold text-slate-800">
              Booking Details
            </h3>
            {booking.created_at && (
              <p className="text-xs text-slate-500 mt-0.5">
                Created on {formatDate(booking.created_at)} at {formatTime(booking.created_at)}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close dialog"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Invitee Information
            </h4>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Name:
                </span>
                <span className="text-slate-800">{getDisplayName(booking)}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Email:
                </span>
                <span className="text-slate-800">
                  {getDisplayEmail(booking)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Phone:
                </span>
                <span className="text-slate-800">
                  {getDisplayPhone(booking)}
                </span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Booking Details
            </h4>
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Booking ID:
                </span>
                <span className="text-slate-800">{booking.id}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Event Type:
                </span>
                <span className="text-slate-800">
                  {booking.event_types?.title || 'N/A'}
                  {eventDurationInner != null && (
                    <span className="text-slate-500">
                      {' '}
                      ({eventDurationInner})
                    </span>
                  )}
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
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Department:
                </span>
                <span className="text-slate-800">
                  {getDepartmentName(booking.department_id, departments)}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center">
                <span className="text-sm font-medium text-slate-600 w-32">
                  Service Provider:
                </span>
                <span className="text-slate-800">
                  {getServiceProviderName(
                    booking.service_provider_id,
                    serviceProviders
                  )}
                </span>
              </div>
            </div>
          </div>

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
                  {formatDate(booking.start_at)},{' '}
                  {formatTime(booking.start_at)}
                </span>
              </div>
              {booking.end_at && (
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-sm font-medium text-slate-600 w-32">
                    End Date/Time:
                  </span>
                  <span className="text-slate-800">
                    {formatDate(booking.end_at)},{' '}
                    {formatTime(booking.end_at)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {intakeFormSettings?.services?.enabled &&
            selectedServiceNames.length > 0 && (
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

          {/* Uploaded File */}
          {fileUploadUrl && (
            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Uploaded File
              </h4>
              <a
                href={fileUploadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium truncate max-w-xs">{fileUploadName}</span>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}

          {showAdditionalInfo && (
            <div>
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Additional Information
              </h4>
              <p className="text-slate-800 whitespace-pre-wrap">
                {displayNotes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
