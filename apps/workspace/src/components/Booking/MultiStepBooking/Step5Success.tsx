'use client';

import React, { useState } from 'react';
import type { EventType } from '@/src/types/bookingForm';
import { BOOKING_STEP_TITLES, SUCCESS_CONFETTI_COLORS } from '@/src/constants/booking';
import { getServiceIcon } from './serviceIcons';

interface Step5SuccessProps {
  selectedType: EventType | null;
  selectedDate: Date | null;
  selectedTime: string;
  previewUrl?: string | null;
  isReschedule?: boolean;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Step5Success({ selectedType, selectedDate, selectedTime, previewUrl, isReschedule }: Step5SuccessProps) {
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
                <div className="text-xs sm:text-sm text-gray-600">
                  {selectedDate ? fmtDay(selectedDate) : ''} • {selectedTime}
                </div>
              </div>
            </div>
          </div>
        </div>

        {fullPreviewUrl && (
          <div className="mt-6 sm:mt-8 max-w-md mx-auto w-full">
            <p className="text-sm font-medium text-gray-600 mb-2">Share booking:</p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gradient-to-br from-indigo-50 to-blue-50 px-3 py-2">
              <a
                href={fullPreviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 truncate text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                {fullPreviewUrl}
              </a>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-shrink-0 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label="Copy link"
              >
                {copied ? (
                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-gray-400">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-gray-300" />
          <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-gray-300" />
        </div>
      </div>
    </div>
  );
}
