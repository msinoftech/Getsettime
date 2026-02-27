'use client';

import React from 'react';
import type { Department, ServiceProvider } from '@/src/types/bookingForm';
import { BOOKING_BUTTON_LABELS, BOOKING_EMPTY_MESSAGES, BOOKING_LOADING_MESSAGES } from '@/src/constants/booking';

interface Step1DepartmentProviderProps {
  departments: Department[];
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  serviceProviders: ServiceProvider[];
  loadingDepartments: boolean;
  loadingProviders: boolean;
  onSelectDepartment: (dept: Department) => void;
  onSelectProvider: (provider: ServiceProvider) => void;
  onContinue: () => void;
}

export function Step1DepartmentProvider({
  departments,
  selectedDepartment,
  selectedProvider,
  serviceProviders,
  loadingDepartments,
  loadingProviders,
  onSelectDepartment,
  onSelectProvider,
  onContinue,
}: Step1DepartmentProviderProps) {
  return (
    <div className="space-y-4 sm:space-y-6 animate-fadeIn">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-gray-900">Select Department & Provider</h2>
        <p className="text-xs sm:text-sm text-gray-500">Choose the department and who you&apos;d like to book with</p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">1. Choose Department</h3>
        {loadingDepartments ? (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <div className="w-5 h-5 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span>{BOOKING_LOADING_MESSAGES.departments}</span>
            </div>
          </div>
        ) : departments.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <p className="text-gray-600 font-medium text-sm">{BOOKING_EMPTY_MESSAGES.noDepartments}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {departments.map((dept) => {
              const isSelected = selectedDepartment?.id === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => onSelectDepartment(dept)}
                  className={`group relative w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
                    isSelected
                      ? 'border-indigo-400 bg-gradient-to-br from-white to-indigo-50/30 shadow-lg'
                      : 'border-gray-200 hover:border-indigo-300 bg-white hover:bg-indigo-50/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                      {dept.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-gray-900">{dept.name}</div>
                      {dept.description && (
                        <div className="text-xs text-gray-600 mt-0.5">{dept.description}</div>
                      )}
                    </div>
                    {isSelected && (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {selectedDepartment && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">2. Choose Provider</h3>
          {loadingProviders ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 text-gray-500">
                <div className="w-5 h-5 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
                <span>{BOOKING_LOADING_MESSAGES.providers}</span>
              </div>
            </div>
          ) : serviceProviders.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-gray-600 font-medium text-sm">{BOOKING_EMPTY_MESSAGES.noProviders}</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {serviceProviders.map((provider) => {
                const isSelected = selectedProvider?.id === provider.id;
                return (
                  <button
                    key={provider.id}
                    onClick={() => onSelectProvider(provider)}
                    className={`group relative w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-300 ${
                      isSelected
                        ? 'border-teal-400 bg-gradient-to-br from-white to-teal-50/30 shadow-lg'
                        : 'border-gray-200 hover:border-teal-300 bg-white hover:bg-teal-50/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold">
                        {provider.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-900 capitalize">{provider.name}</div>
                      </div>
                      {isSelected && (
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {selectedDepartment && selectedProvider && (
        <div className="flex justify-end pt-4">
          <button
            onClick={onContinue}
            className="px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-semibold"
          >
            {BOOKING_BUTTON_LABELS.continueToServices}
          </button>
        </div>
      )}
    </div>
  );
}
