'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { EventType } from '@/src/types/bookingForm';
import {
  BOOKING_BUTTON_LABELS,
  BOOKING_EMPTY_MESSAGES,
  BOOKING_LOADING_MESSAGES,
  BOOKING_STEP_TITLES,
  DEFAULT_ACCENT_COLOR,
} from '@/src/constants/booking';
import { getServiceIcon, getServiceSubtitle } from './serviceIcons';

interface Step2ServiceSelectionProps {
  eventTypes: EventType[];
  selectedType: EventType | null;
  loadingEventTypes: boolean;
  onSelectType: (eventType: EventType) => void;
  onBack?: () => void;
  onContinue: () => void;
}

export function Step2ServiceSelection({
  eventTypes,
  selectedType,
  loadingEventTypes,
  onSelectType,
  onBack,
  onContinue,
}: Step2ServiceSelectionProps) {
  const continueSectionRef = useRef<HTMLDivElement | null>(null);

  const handleSelectType = useCallback(
    (eventType: EventType) => {
      onSelectType(eventType);
    },
    [onSelectType]
  );

  // Scroll after the parent re-render settles so a catalog refetch does not
  // unmount this step before the continue button is on screen.
  useEffect(() => {
    if (!selectedType) return;
    requestAnimationFrame(() => {
      continueSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, [selectedType?.id]);

  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="text-center lg:text-left">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl md:text-2xl">{BOOKING_STEP_TITLES.step2}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{BOOKING_STEP_TITLES.step2Subtitle}</p>
      </div>

      {loadingEventTypes ? (
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-3 text-gray-500">
            <div className="w-6 h-6 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
                onClick={() => handleSelectType(t)}
                className={`group relative w-full text-left px-4 py-4 rounded-xl border flex items-center justify-between gap-3 transition-all duration-300 overflow-hidden ${
                  isSelected
                    ? 'border-indigo-400 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg scale-[1.02]'
                    : 'border-gray-200 hover:border-indigo-400 bg-white hover:bg-gradient-to-br hover:from-white hover:to-indigo-50/30 hover:shadow-xl hover:scale-[1.02]'
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-r from-indigo-600/0 via-indigo-600/5 to-indigo-600/0 transition-opacity duration-500 ${
                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                />
                <div className="flex items-center gap-3">
                  <div
                    className={`relative bg-indigo-600 z-10 w-10 h-10 sm:w-12 sm:h-12 xl:w-14 xl:h-14 rounded-xl flex items-center justify-center text-white flex-shrink-0 transition-all duration-300 shadow-lg ${
                      isSelected ? 'scale-102 rotate-2 xl:scale-110 xl:rotate-3' : 'group-hover:scale-110 group-hover:rotate-3'
                    }`}
                  >
                    {getServiceIcon(duration)}
                  </div>
                  <div className="flex-1 relative z-10 min-w-0">
                    <div
                      className={`font-semibold text-md xl:text-lg transition-colors truncate ${
                        isSelected ? 'text-indigo-600' : 'text-gray-900 group-hover:text-indigo-700'
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="text-xs xl:text-sm text-gray-600">{getServiceSubtitle(duration)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className={`relative z-10 flex items-center gap-1.5 sm:gap-2 px-3 py-1 rounded-lg transition-colors flex-shrink-0 ${
                      isSelected ? 'bg-indigo-100' : 'bg-indigo-50 group-hover:bg-indigo-100'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: DEFAULT_ACCENT_COLOR }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs font-semibold whitespace-nowrap" style={{ color: DEFAULT_ACCENT_COLOR }}>
                      {duration} min
                    </span>
                  </div>
                  <div className={`relative z-10 transition-opacity hidden xl:block ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={continueSectionRef}
        className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 pt-4 scroll-mt-6"
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
          >
            {BOOKING_BUTTON_LABELS.back}
          </button>
        )}
        <button
          type="button"
          disabled={!selectedType || loadingEventTypes}
          onClick={onContinue}
          className={`w-full sm:w-auto sm:ml-auto px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all font-semibold ${
            !selectedType || loadingEventTypes
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-xl hover:shadow-2xl hover:scale-105'
          }`}
        >
          {BOOKING_BUTTON_LABELS.continue}
        </button>
      </div>
    </div>
  );
}
