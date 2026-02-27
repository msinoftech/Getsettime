'use client';

import React from 'react';
import type { Department, EventType, ServiceProvider } from '@/src/types/bookingForm';
import { BOOKING_EMPTY_MESSAGES, DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from '@/src/constants/booking';
import { formatDateWithTimezone, formatTimeWithTimezone } from '@/src/utils/bookingTime';

interface BookingPreviewSidebarProps {
  workspaceName: string;
  workspaceLogoUrl: string | null;
  workspacePrimaryColor: string;
  workspaceAccentColor: string | null;
  loadingSettings: boolean;
  departments: Department[];
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  selectedType: EventType | null;
  selectedDate: Date | null;
  selectedTime: string;
  step: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** IANA timezone for time display (workspace or browser); fixes Android 4pm→4am bug */
  displayTimezone?: string | null;
}

export function BookingPreviewSidebar({
  workspaceName,
  workspaceLogoUrl,
  workspacePrimaryColor,
  workspaceAccentColor,
  loadingSettings,
  departments,
  selectedDepartment,
  selectedProvider,
  selectedType,
  selectedDate,
  selectedTime,
  step,
  name,
  email,
  phone,
  notes,
  displayTimezone,
}: BookingPreviewSidebarProps) {
  const primary = workspacePrimaryColor || DEFAULT_PRIMARY_COLOR;
  const accent = workspaceAccentColor || workspacePrimaryColor || DEFAULT_ACCENT_COLOR;
  const isExternalLogoUrl = workspaceLogoUrl?.startsWith('http://') || workspaceLogoUrl?.startsWith('https://');
  const hasSelection = selectedDepartment || selectedProvider || selectedType;

  return (
    <div
      className="w-full lg:sticky lg:top-0 lg:overflow-y-auto bg-gradient-to-br p-4 sm:p-6 lg:p-8 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primary}08 0%, ${accent}08 100%)` }}
    >
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${primary} 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="mb-4 sm:mb-4 lg:mb-6">
          <div className="inline-flex items-center gap-2 mb-2 sm:mb-3">
            <div className="w-2 h-2 rounded-full animate-pulse bg-purple-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Preview</span>
          </div>
          <div className="py-2 z-10 relative">
            <div className="flex flex-wrap items-center gap-4">
              {!loadingSettings && workspaceLogoUrl ? (
                <img
                  src={workspaceLogoUrl}
                  alt={workspaceName}
                  className={`w-12 h-12 rounded-xl ${isExternalLogoUrl ? 'object-contain' : 'object-cover'}`}
                />
              ) : (
                <img
                  src="getsettime-icon.png"
                  alt={workspaceName}
                  className="w-12 h-12 rounded-xl object-cover"
                />
              )}
              <div>
                <div className="text-sm text-gray-600">Schedule with</div>
                <div className="text-lg font-semibold">{workspaceName}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 group space-y-6">
          {!hasSelection ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              <div className="relative bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border-2 border-dashed border-gray-200 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-sm sm:text-base text-gray-400 font-medium">{BOOKING_EMPTY_MESSAGES.noSelection}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {departments.length === 0 ? BOOKING_EMPTY_MESSAGES.noSelectionHintService : BOOKING_EMPTY_MESSAGES.noSelectionHintDept}
                </p>
              </div>
            </div>
          ) : (
            <>
              {selectedDepartment && !selectedProvider && (
                <div className="details-box">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 truncate">{selectedDepartment.name}</div>
                      <div className="text-xs sm:text-sm text-gray-600">Selected department</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedDepartment && selectedProvider && (
                <div className="details-box">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 truncate">{selectedDepartment.name}</div>
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 lowercase">
                        <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{selectedProvider.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedType && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {selectedType.title}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 pl-9 sm:pl-11 flex items-center gap-1.5 mt-1">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{selectedType.duration_minutes || 30} minutes</span>
                  </div>
                </div>
              )}

              {selectedDate && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {formatDateWithTimezone(selectedDate)}
                  </div>
                </div>
              )}

              {selectedTime && selectedDate && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {formatTimeWithTimezone(selectedDate, selectedTime, displayTimezone)}
                  </div>
                </div>
              )}

              {step === 4 && name && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 pl-9 sm:pl-11">
                    <div className="font-bold text-gray-900 text-sm sm:text-base truncate">{name}</div>
                    {email && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{email}</span>
                      </div>
                    )}
                    {phone && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="truncate">{phone}</span>
                      </div>
                    )}
                    {notes && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                        <span className="truncate">{notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
