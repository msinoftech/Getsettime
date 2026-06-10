'use client';

import React, { useState } from 'react';
import type { EventType } from '@/src/types/bookingForm';
import { BOOKING_STEP_TITLES, SUCCESS_CONFETTI_COLORS } from '@/src/constants/booking';
import { getServiceIcon } from './serviceIcons';
import { formatFullDateTimeInTimezone } from '@/lib/date-timezone';
import { needsTimezoneConversion } from '@/src/utils/timezone';

interface Step5SuccessProps {
  selectedType: EventType | null;
  selectedDate: Date | null;
  selectedTime: string;
  selectedStartUtc?: string | null;
  customerTimezone?: string | null;
  providerTimezone?: string | null;
  previewUrl?: string | null;
  isReschedule?: boolean;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Step5Success({
  selectedType,
  selectedDate,
  selectedTime,
  selectedStartUtc,
  customerTimezone,
  providerTimezone,
  previewUrl,
  isReschedule,
}: Step5SuccessProps) {
  const [copied, setCopied] = useState(false);

  const fullPreviewUrl = previewUrl
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${previewUrl}`
    : null;

  const handleCopy = async () => {
    if (!fullPreviewUrl) return;
    try {
      await navigator.clipboard.writeText(fullPreviewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const customerTimeLabel =
    selectedStartUtc && customerTimezone
      ? formatFullDateTimeInTimezone(selectedStartUtc, customerTimezone)
      : selectedDate
        ? `${fmtDay(selectedDate)} • ${selectedTime}`
        : selectedTime;

  const showHostTime =
    selectedStartUtc &&
    customerTimezone &&
    providerTimezone &&
    needsTimezoneConversion(providerTimezone, customerTimezone);

  return (
    <div className="flex flex-col items-center justify-center pt-8 sm:pt-12 lg:pt-16 animate-fadeIn">
      <div className="relative mb-6 sm:mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full flex items-center justify-center shadow-2xl overflow-hidden bg-indigo-600">
          <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
          <svg
            className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <div className="text-center space-y-3 sm:space-y-4 px-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-indigo-700">
          {isReschedule ? 'Booking Rescheduled!' : BOOKING_STEP_TITLES.step5}
        </h2>
        <p className="text-lg sm:text-xl text-gray-600">
          {isReschedule ? 'Your booking has been updated with the new time.' : BOOKING_STEP_TITLES.step5Subtitle}
        </p>

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl sm:rounded-2xl border-2 border-indigo-100 max-w-md mx-auto w-full">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-indigo-600">
                {selectedType && getServiceIcon(selectedType.duration_minutes || 30)}
              </div>
              <div className="text-left min-w-0 flex-1">
                <div className="font-bold text-gray-900 text-base sm:text-lg truncate">{selectedType?.title}</div>
                <div className="text-xs sm:text-sm text-gray-600">{customerTimeLabel}</div>
                {showHostTime ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Host: {formatFullDateTimeInTimezone(selectedStartUtc!, providerTimezone!)}
                  </div>
                ) : null}
                {customerTimezone ? (
                  <div className="text-xs text-gray-400 mt-1">Timezone: {customerTimezone}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {fullPreviewUrl && (
          <div className="mt-6 sm:mt-8 max-w-md mx-auto w-full">
            <p className="text-sm text-gray-600 mb-3">Share your booking link:</p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={fullPreviewUrl}
                className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 truncate"
              />
              <button
                onClick={handleCopy}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-2 mt-8">
          {SUCCESS_CONFETTI_COLORS.map((color, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full animate-bounce"
              style={{ backgroundColor: color, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
