'use client';

import React from 'react';
import type { Department, Service, ServiceProvider } from '@/src/types/bookingForm';
import { BOOKING_BUTTON_LABELS, BOOKING_EMPTY_MESSAGES, BOOKING_LOADING_MESSAGES } from '@/src/constants/booking';

interface Step1DepartmentProviderProps {
  departments: Department[];
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  serviceProviders: ServiceProvider[];
  /** When false, skip provider list (general availability); booking assigns workspace owner. */
  showProviderPicker: boolean;
  loadingDepartments: boolean;
  loadingProviders: boolean;
  providerScopedCatalogServices: Service[];
  loadingProviderScopedCatalog: boolean;
  selectedOptionalServiceIds: string[];
  onToggleOptionalService: (id: string) => void;
  onSelectDepartment: (dept: Department) => void;
  onSelectProvider: (provider: ServiceProvider) => void;
  onContinue: () => void;
}

export function Step1DepartmentProvider({
  departments,
  selectedDepartment,
  selectedProvider,
  serviceProviders,
  showProviderPicker,
  loadingDepartments,
  loadingProviders,
  providerScopedCatalogServices,
  loadingProviderScopedCatalog,
  selectedOptionalServiceIds,
  onToggleOptionalService,
  onSelectDepartment,
  onSelectProvider,
  onContinue,
}: Step1DepartmentProviderProps) {
  const canContinue =
    !!selectedDepartment &&
    (!showProviderPicker || !!selectedProvider);

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
              <div className="w-5 h-5 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
                  type="button"
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

      {selectedDepartment && showProviderPicker && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">2. Choose Provider</h3>
          {loadingProviders ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center gap-3 text-gray-500">
                <div className="w-5 h-5 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
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
                    type="button"
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

      {selectedDepartment && providerScopedCatalogServices.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            {showProviderPicker ? '3. ' : '2. '}
            Add services <span className="font-normal normal-case text-gray-500">(optional)</span>
          </h3>
          {loadingProviderScopedCatalog ? (
            <div className="text-sm text-gray-500 py-4">{BOOKING_LOADING_MESSAGES.services}</div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {providerScopedCatalogServices.map((s) => {
                const selected = selectedOptionalServiceIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onToggleOptionalService(s.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-sm font-semibold ${
                      selected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    <span className="truncate max-w-[220px]">{s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {canContinue && (
        <div className="flex justify-end pt-4">
          <button
            type="button"
            onClick={onContinue}
            className="px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-semibold"
          >
            {BOOKING_BUTTON_LABELS.continueToServices}
          </button>
        </div>
      )}
    </div>
  );
}
