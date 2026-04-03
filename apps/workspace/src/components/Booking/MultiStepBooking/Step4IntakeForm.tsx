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
  sendWhatsapp: boolean;
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
  onSendWhatsappChange: (v: boolean) => void;
  onCustomFieldChange: (id: string, v: string) => void;
  onServiceToggle: (id: string) => void;
  onTouchedName: () => void;
  onTouchedEmail: () => void;
  onTouchedPhone: () => void;
  onTouchedCustomField: (id: string) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
  fileError: string;
  onBack: () => void;
  onConfirm: () => void;
}

export function Step4IntakeForm({
  intakeForm,
  name,
  email,
  phone,
  notes,
   sendWhatsapp,
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
   onSendWhatsappChange,
  onCustomFieldChange,
  onServiceToggle,
  onTouchedName,
  onTouchedEmail,
  onTouchedPhone,
  onTouchedCustomField,
  file,
  onFileChange,
  fileError,
  onBack,
  onConfirm,
}: Step4IntakeFormProps) {
  const [attemptedConfirm, setAttemptedConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const showFieldError = (key: string) => attemptedConfirm && Boolean(intakeValidation[key]);
  const baseInputClass =
    'w-full px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-indigo-500 transition-all bg-white hover:border-gray-300';

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
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
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
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
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
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
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
                        selected ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50'
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

        {intakeForm?.file_upload === true && (
          <div className="group">
            <div className="text-sm font-semibold text-gray-700 mb-2">
              Upload File <span className="text-gray-400 font-normal">(optional)</span>
            </div>
            {file ? (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-indigo-200 bg-indigo-50">
                <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-800 truncate flex-1">{file.name}</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
                <button
                  type="button"
                  onClick={() => onFileChange(null)}
                  className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50/50 cursor-pointer transition-all"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = e.dataTransfer.files[0];
                  if (dropped) onFileChange(dropped);
                }}
              >
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <span className="text-sm font-medium text-gray-600">Choose file or drag &amp; drop</span>
                <span className="text-xs text-gray-400">PDF, PNG, JPG, HEIC &mdash; Max 2 MB</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.heic,.heif"
                  onChange={(e) => {
                    const selected = e.target.files?.[0] ?? null;
                    onFileChange(selected);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            {fileError && (
              <p className="mt-2 text-xs font-medium text-red-600">{fileError}</p>
            )}
          </div>
        )}

        {intakeForm?.additional_description === true && (
          <div className="group">
            <div className="relative">
              <div className="absolute left-4 top-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <textarea
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                placeholder={BOOKING_PLACEHOLDERS.notes}
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 h-36 resize-none focus:outline-none focus:border-indigo-500 transition-all bg-white hover:border-gray-300"
              />
            </div>
          </div>
        )}

        <div className="group">
          <label className="inline-flex items-center gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendWhatsapp}
              onChange={(e) => {
                onSendWhatsappChange(e.target.checked);
                if (e.target.checked) setShowTermsModal(true);
              }}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-gray-700">I agree to receive appointment and reminder via WhatsApp.</span>
          </label>
        </div>
        
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
            loading ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-xl hover:shadow-2xl hover:scale-105'
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

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Terms &amp; Conditions</h3>
            <div className="text-sm text-gray-700 mb-6 max-h-60 overflow-y-auto">
              <p>
                Please review the terms and conditions for this booking. By clicking OK, you confirm that you have read
                and agree to them.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
                onClick={() => {
                  setAcceptTerms(true);
                  setShowTermsModal(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
