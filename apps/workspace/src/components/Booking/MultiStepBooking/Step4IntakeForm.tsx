'use client';

import React, { useState } from 'react';
import type { IntakeFormSettings } from '@/src/types/workspace';
import type { Service } from '@/src/types/bookingForm';
import {
  BOOKING_BUTTON_LABELS,
  BOOKING_EMPTY_MESSAGES,
  BOOKING_LOADING_MESSAGES,
  BOOKING_PLACEHOLDERS,
  BOOKING_STEP_TITLES,
} from '@/src/constants/booking';
import { getCustomFieldType, isServicesEnabled } from '@/src/utils/intakeForm';

interface Step4IntakeFormProps {
  intakeForm: IntakeFormSettings | undefined;
  name: string;
  email: string;
  phone: string;
  notes: string;
  customFieldValues: Record<string, string>;
  selectedServiceIds: string[];
  services: Service[];
  loadingServices: boolean;
  touched: { name: boolean; email: boolean; phone: boolean };
  touchedCustomFields: Record<string, boolean>;
  intakeValidation: Record<string, string>;
  loading: boolean;
  isStep4Valid: boolean;
  onNameChange: (v: string) => void;
  onEmailChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onCustomFieldChange: (id: string, v: string) => void;
  onServiceToggle: (id: string) => void;
  onTouchedName: () => void;
  onTouchedEmail: () => void;
  onTouchedPhone: () => void;
  onTouchedCustomField: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}

export function Step4IntakeForm({
  intakeForm,
  name,
  email,
  phone,
  notes,
  customFieldValues,
  selectedServiceIds,
  services,
  loadingServices,
  touched,
  touchedCustomFields,
  intakeValidation,
  loading,
  isStep4Valid,
  onNameChange,
  onEmailChange,
  onPhoneChange,
  onNotesChange,
  onCustomFieldChange,
  onServiceToggle,
  onTouchedName,
  onTouchedEmail,
  onTouchedPhone,
  onTouchedCustomField,
  onBack,
  onConfirm,
}: Step4IntakeFormProps) {
  const [attemptedConfirm, setAttemptedConfirm] = useState(false);
  const showFieldError = (key: string) => attemptedConfirm && Boolean(intakeValidation[key]);
  const baseInputClass =
    'w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300';

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fadeIn">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-gray-900">{BOOKING_STEP_TITLES.step4}</h2>
        <p className="text-xs sm:text-sm text-gray-500">{BOOKING_STEP_TITLES.step4Subtitle}</p>
      </div>

      {attemptedConfirm && intakeValidation._config && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {intakeValidation._config}
        </div>
      )}
      <div className="grid gap-6">
        {intakeForm?.name !== false && (
          <div className="group">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={onTouchedName}
                placeholder={BOOKING_PLACEHOLDERS.name}
                className={`${baseInputClass} pl-12 pr-4`}
                required
              />
            </div>
            {showFieldError('name') && (
              <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation.name}</p>
            )}
          </div>
        )}

        {intakeForm?.email !== false && (
          <div className="group">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <input
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                onBlur={onTouchedEmail}
                type="email"
                placeholder={BOOKING_PLACEHOLDERS.email}
                className={`${baseInputClass} pl-12 pr-4`}
                required
              />
            </div>
            {showFieldError('email') && (
              <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation.email}</p>
            )}
          </div>
        )}

        {intakeForm?.phone === true && (
          <div className="group">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <input
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                onBlur={onTouchedPhone}
                type="tel"
                placeholder={BOOKING_PLACEHOLDERS.phone}
                className={`${baseInputClass} pl-12 pr-4`}
                required
              />
            </div>
            {showFieldError('phone') && (
              <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation.phone}</p>
            )}
          </div>
        )}

        {isServicesEnabled(intakeForm) && (
          <div className="group">
            <div className="text-sm font-semibold text-gray-700">
              Services{showFieldError('services') ? <span className="text-red-500"> *</span> : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {loadingServices ? (
                <div className="text-sm text-gray-500">{BOOKING_LOADING_MESSAGES.services}</div>
              ) : services.length === 0 ? (
                <div className="text-sm text-gray-500">{BOOKING_EMPTY_MESSAGES.noServices}</div>
              ) : (
                services.map((s) => {
                  const selected = selectedServiceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onServiceToggle(s.id)}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all text-sm font-semibold ${
                        selected ? 'bg-purple-600 text-white border-purple-600 shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400 hover:bg-purple-50'
                      } ${showFieldError('services') ? 'border-red-300' : ''}`}
                    >
                      <span className="truncate max-w-[220px]">{s.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            {showFieldError('services') && (
              <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation.services}</p>
            )}
          </div>
        )}

        {(intakeForm?.custom_fields || []).map((field) => {
          const type = getCustomFieldType(field);
          const value = customFieldValues[field.id] || '';
          const required = field.required === true;
          const placeholder = field.placeholder || '';
          const showError = showFieldError(field.id);

          if (type === 'textarea') {
            return (
              <div key={field.id} className="group">
                <div className="text-sm font-semibold text-gray-700">
                  {field.label}{required ? <span className="text-red-500"> *</span> : null}
                </div>
                <textarea
                  value={value}
                  onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                  onBlur={() => onTouchedCustomField(field.id)}
                  placeholder={placeholder}
                  className={`${baseInputClass} h-36 resize-none mt-2`}
                  required={required}
                />
                {showError && <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation[field.id]}</p>}
              </div>
            );
          }

          if (type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
            return (
              <div key={field.id} className="group">
                <div className="text-sm font-semibold text-gray-700">
                  {field.label}{required ? <span className="text-red-500"> *</span> : null}
                </div>
                <select
                  value={value}
                  onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                  onBlur={() => onTouchedCustomField(field.id)}
                  className={`${baseInputClass} mt-2`}
                  required={required}
                >
                  <option value="">{placeholder || BOOKING_PLACEHOLDERS.selectOption}</option>
                  {field.options.map((opt) => {
                    const o = typeof opt === 'string' ? { label: opt, value: opt } : opt;
                    return (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    );
                  })}
                </select>
                {showError && <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation[field.id]}</p>}
              </div>
            );
          }

          const inputType: React.HTMLInputTypeAttribute =
            type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'tel' ? 'tel' : type === 'url' ? 'url' : type === 'date' ? 'date' : 'text';

          return (
            <div key={field.id} className="group">
              <div className="text-sm font-semibold text-gray-700">
                {field.label}{required ? <span className="text-red-500"> *</span> : null}
              </div>
              <input
                value={value}
                onChange={(e) => onCustomFieldChange(field.id, e.target.value)}
                onBlur={() => onTouchedCustomField(field.id)}
                type={inputType}
                placeholder={placeholder}
                className={`${baseInputClass} mt-2`}
                required={required}
              />
              {showError && <p className="mt-2 text-xs font-medium text-red-600">{intakeValidation[field.id]}</p>}
            </div>
          );
        })}

        {intakeForm?.additional_description === true && (
          <div className="group">
            <div className="relative">
              <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-purple-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={BOOKING_PLACEHOLDERS.notes}
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 h-36 resize-none focus:outline-none focus:border-purple-500 transition-all bg-white hover:border-gray-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 lg:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
        >
          {BOOKING_BUTTON_LABELS.back}
        </button>
        <button
          onClick={() => {
            if (loading) return;
            if (!isStep4Valid) {
              setAttemptedConfirm(true);
              return;
            }
            onConfirm();
          }}
          disabled={loading}
          className={`w-full sm:w-auto sm:ml-auto px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white transition-all font-semibold flex items-center justify-center gap-2 ${
            loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-xl hover:shadow-2xl hover:scale-105'
          }`}
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>{BOOKING_BUTTON_LABELS.creating}</span>
            </>
          ) : (
            <>
              <span>{BOOKING_BUTTON_LABELS.confirmBooking}</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
