'use client';

import React from 'react';

interface ProgressIndicatorProps {
  step: number;
}

export function ProgressIndicator({ step }: ProgressIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 lg:mb-10 relative flex-wrap">
      {[1, 2, 3, 4, 5].map((s, index) => (
        <React.Fragment key={s}>
          <div className="relative">
            <div
              className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 relative z-10 ${
                s === step
                  ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-xl scale-110 ring-2 sm:ring-4 ring-purple-200'
                  : s < step
                    ? 'bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg'
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
              <div className="absolute inset-0 rounded-full bg-purple-400 animate-ping opacity-75" />
            )}
          </div>
          {index < 4 && (
            <div
              className={`h-1 w-6 sm:w-8 lg:w-12 rounded-full transition-all duration-500 hidden sm:block ${
                s < step ? 'bg-gradient-to-r from-purple-500 to-purple-600' : 'bg-gray-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
