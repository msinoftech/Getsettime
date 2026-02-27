'use client';

import React from 'react';
import type { EventType } from '@/src/types/bookingForm';
import { BOOKING_STEP_TITLES, SUCCESS_CONFETTI_COLORS } from '@/src/constants/booking';
import { getServiceIcon } from './serviceIcons';

interface Step5SuccessProps {
  selectedType: EventType | null;
  selectedDate: Date | null;
  selectedTime: string;
}

function fmtDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Step5Success({ selectedType, selectedDate, selectedTime }: Step5SuccessProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 lg:py-16 animate-fadeIn">
      <div className="relative mb-6 sm:mb-8">
        <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full flex items-center justify-center shadow-2xl relative overflow-hidden bg-gradient-to-br from-purple-600 to-purple-700">
          <div className="absolute inset-0 rounded-full border-4 border-white/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-4 border-white/20" />
          <svg
            className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20"
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
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                background: SUCCESS_CONFETTI_COLORS[i % 4],
                left: '50%',
                top: '50%',
                transform: `rotate(${i * 30}deg) translateY(-60px)`,
                animation: `fadeIn 0.5s ease-out ${i * 0.1}s both`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="text-center space-y-3 sm:space-y-4 px-4">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-gray-900 via-purple-600 to-gray-900 bg-clip-text text-transparent">
          {BOOKING_STEP_TITLES.step5}
        </h2>
        <p className="text-lg sm:text-xl text-gray-600">{BOOKING_STEP_TITLES.step5Subtitle}</p>

        <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl sm:rounded-2xl border-2 border-purple-100 max-w-md mx-auto w-full">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center text-white flex-shrink-0 text-purple-600">
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

        <div className="mt-8 flex items-center justify-center gap-2 text-gray-400">
          <div className="w-12 h-px bg-gradient-to-r from-transparent to-gray-300" />
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          <div className="w-12 h-px bg-gradient-to-l from-transparent to-gray-300" />
        </div>
      </div>
    </div>
  );
}
