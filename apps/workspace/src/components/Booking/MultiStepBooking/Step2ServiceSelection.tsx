'use client';

import React from 'react';
import type { EventType } from '@/src/types/bookingForm';
import { BOOKING_EMPTY_MESSAGES, BOOKING_LOADING_MESSAGES, DEFAULT_ACCENT_COLOR } from '@/src/constants/booking';
import { getServiceIcon, getServiceSubtitle } from './serviceIcons';

interface Step2ServiceSelectionProps {
  eventTypes: EventType[];
  selectedType: EventType | null;
  loadingEventTypes: boolean;
  onSelectType: (eventType: EventType) => void;
}

export function Step2ServiceSelection({
  eventTypes,
  selectedType,
  loadingEventTypes,
  onSelectType,
}: Step2ServiceSelectionProps) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-gray-900">Choose a service</h2>
        <p className="text-xs sm:text-sm text-gray-500">What would you like to book?</p>
      </div>

      {loadingEventTypes ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-3 text-gray-500">
            <div className="w-6 h-6 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
            <span>{BOOKING_LOADING_MESSAGES.eventTypes}</span>
          </div>
        </div>
      ) : eventTypes.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">{BOOKING_EMPTY_MESSAGES.noEventTypes}</p>
          <p className="text-sm text-gray-400 mt-2">{BOOKING_EMPTY_MESSAGES.noEventTypesHint}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {eventTypes.map((t, index) => {
            const duration = t.duration_minutes || 30;
            const isSelected = selectedType?.id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onSelectType(t)}
                className={`group relative w-full text-left p-4 sm:p-5 lg:p-6 rounded-xl sm:rounded-2xl border-2 flex items-center gap-3 sm:gap-4 lg:gap-5 transition-all duration-300 overflow-hidden ${
                  isSelected
                    ? 'border-purple-400 bg-gradient-to-br from-white to-purple-50/30 shadow-2xl scale-[1.02]'
                    : 'border-gray-200 hover:border-purple-400 bg-white hover:bg-gradient-to-br hover:from-white hover:to-purple-50/30 hover:shadow-2xl hover:scale-[1.02]'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/5 to-purple-600/0 transition-opacity duration-500 ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                />
                <div
                  className={`relative bg-purple-600 z-10 w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center text-white flex-shrink-0 transition-all duration-300 shadow-lg ${
                    isSelected ? 'scale-110 rotate-3' : 'group-hover:scale-110 group-hover:rotate-3'
                  }`}
                >
                  {getServiceIcon(duration)}
                </div>
                <div className="flex-1 relative z-10 min-w-0">
                  <div
                    className={`font-bold text-base sm:text-lg lg:text-xl mb-1 sm:mb-2 transition-colors truncate ${
                      isSelected ? 'text-purple-700' : 'text-gray-900 group-hover:text-purple-700'
                    }`}
                  >
                    {t.title}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 line-clamp-2">{getServiceSubtitle(duration)}</div>
                </div>
                <div
                  className={`relative z-10 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl transition-colors flex-shrink-0 ${
                    isSelected ? 'bg-blue-100' : 'bg-blue-50 group-hover:bg-blue-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: DEFAULT_ACCENT_COLOR }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-bold whitespace-nowrap" style={{ color: DEFAULT_ACCENT_COLOR }}>
                    {duration} min
                  </span>
                </div>
                <div className={`relative z-10 transition-opacity hidden sm:block ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
