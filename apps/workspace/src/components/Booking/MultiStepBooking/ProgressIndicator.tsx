'use client';

import React from 'react';

interface ProgressIndicatorProps {
  step: number;
}

export function ProgressIndicator({ step }: ProgressIndicatorProps) {
  return (
    <div className="steps flex items-center justify-center gap-2 sm:gap-3 relative flex-wrap mb-6">
      {[1, 2, 3, 4, 5].map((s, index) => (
        <React.Fragment key={s}>
          <div className="relative">
            <div
              className={`w-8 h-8 sm:w-6 sm:h-6 md:w-8 md:h-8 lg:w-10 lg:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 relative z-10 ${
                s === step
                  ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-xl scale-110 ring-2 sm:ring-4 ring-indigo-200'
                  : s < step
                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
              }`}
            >
              {s < step ? (
                <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s
              )}
            </div>
            {s === step && (
              <div className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-75" />
            )}
          </div>
          {index < 4 && (
            <div
              className={`h-1 w-4 sm:w-5 md:w-6 lg:w-8 rounded-full transition-all duration-500 hidden sm:block ${
                s < step ? 'bg-gradient-to-r from-indigo-500 to-indigo-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
