'use client';

import React from 'react';
import { formatDate, formatTime } from '@/src/utils/date';
import {
  getServiceProviderName,
  getDepartmentName,
  getDisplayName,
  getDisplayEmail,
  getDisplayPhone,
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
          <h3 className="text-xl font-semibold text-slate-800">
            Booking Details
          </h3>
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
