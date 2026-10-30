'use client';

import React, { useLayoutEffect, useState } from 'react';
import type { Department, EventType, Service, ServiceProvider } from '@/src/types/bookingForm';
import type { IntakeFormSettings } from '@/src/types/workspace';
import {
  BOOKING_EMPTY_MESSAGES,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from '@/src/constants/booking';
import { formatDateWithTimezone } from '@/src/utils/bookingTime';
import {
  formatDateOnlyInTimezone,
  formatTimeOnlyInTimezone,
  getTimezoneAbbreviation,
} from '@/lib/date-timezone';
import {
  step3PerfSidebarDateRendered,
  step3PerfSidebarTimeRendered,
} from '@/src/utils/bookingStep3Perf';
import { needsTimezoneConversion } from '@/src/utils/timezone';
import {
  resolve_workspace_logo_src,
  workspace_logo_is_remote,
} from '@/src/utils/workspace_logo';
import type { booking_step_id } from '@/src/features/booking-flow';
import {
  intakeCustomFieldHasDisplayValue,
  formatIntakeFieldValueForDisplay,
  displayLabelForIntakeField,
} from '@/src/utils/intakeForm';
import type { BookingHostProfileHighlights } from '@/src/utils/booking_host_profile';
import type { WorkspacePublicAddress } from '@/src/utils/workspace_public_address';
import { WorkspaceUserAvatar } from '@/src/components/User/WorkspaceUserAvatar';

type ProfileDetailIconName = 'address' | 'qualifications' | 'experience' | 'specialty';

type ProfileDetailRow = {
  key: string;
  label: string;
  value: string;
  icon: ProfileDetailIconName;
};

function workspace_address_value(address: WorkspacePublicAddress): string {
  if (!address.line2) return address.line1;

  const [lead] = address.line2
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean);
  const lead_is_street = Boolean(lead) && !/^\d/.test(lead);
  if (lead_is_street && lead && !address.line1.toLowerCase().includes(lead.toLowerCase())) {
    return `${lead}, ${address.line1}`;
  }
  return address.line1;
}

function profile_detail_rows(
  highlights: BookingHostProfileHighlights | null,
  address?: WorkspacePublicAddress | null
): ProfileDetailRow[] {
  const rows: ProfileDetailRow[] = [];
  if (address?.line1) {
    rows.push({
      key: 'address',
      label: 'Address',
      value: workspace_address_value(address),
      icon: 'address',
    });
  }
  if (highlights?.education) {
    rows.push({
      key: 'qualifications',
      label: 'Qualifications',
      value: highlights.education,
      icon: 'qualifications',
    });
  }
  if (highlights?.experience) {
    rows.push({
      key: 'experience',
      label: 'Experience',
      value: highlights.experience,
      icon: 'experience',
    });
  }
  if (highlights?.specialty) {
    rows.push({
      key: 'specialty',
      label: 'Specialty',
      value: highlights.specialty,
      icon: 'specialty',
    });
  }
  return rows;
}

function ProfileDetailIcon({ name }: { name: ProfileDetailIconName }) {
  if (name === 'address') {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.25" strokeWidth={1.8} />
      </svg>
    );
  }
  if (name === 'qualifications') {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M22 10L12 5 2 10l10 5 10-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 12v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5" />
      </svg>
    );
  }
  if (name === 'experience') {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <circle cx="12" cy="12" r="8" strokeWidth={1.8} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 2" />
      </svg>
    );
  }
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 3.5l2.05 4.16 4.59.67-3.32 3.24.78 4.57L12 14l-4.1 2.14.78-4.57L5.36 8.33l4.59-.67L12 3.5z"
      />
    </svg>
  );
}

function ProfileDetailRows({ rows }: { rows: ProfileDetailRow[] }) {
  return (
    <>
      {rows.map((row, index) => (
        <div
          key={row.key}
          className={`flex items-center gap-3 px-4 py-3.5 ${index > 0 ? 'border-t border-slate-100' : ''}`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
            <ProfileDetailIcon name={row.icon} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">{row.label}</p>
            <p className="break-words text-sm leading-snug text-slate-500">{row.value}</p>
          </div>
        </div>
      ))}
    </>
  );
}

function ProfileHighlightList({ rows }: { rows: ProfileDetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <ul className="min-w-0 space-y-2 sm:max-w-[45%] sm:border-l sm:border-slate-200 sm:pl-4">
      {rows.map((row) => (
        <li key={row.key} className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 [&_svg]:h-4 [&_svg]:w-4">
            <ProfileDetailIcon name={row.icon} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{row.label}</p>
            <p className="break-words text-sm leading-snug text-gray-800">{row.value}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ProviderProfileSection({ profile }: { profile: BookingHostProfileHighlights | null }) {
  if (!profile) return null;

  const name = profile.name?.trim() || '';
  const chips: { key: string; title: string; caption: string; icon: ProfileDetailIconName }[] = [];
  if (profile.experience) {
    chips.push({ key: 'experience', title: profile.experience, caption: 'Experience', icon: 'experience' });
  }
  if (profile.specialty) {
    chips.push({ key: 'specialty', title: profile.specialty, caption: 'Specialty', icon: 'specialty' });
  }

  return (
    <div className="mt-6 rounded-2xl border-2 border-indigo-200 bg-white p-4 shadow-sm ring-4 ring-indigo-50/60">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Service provider</p>
          <div className="mt-3 flex min-w-0 items-center gap-4">
            <WorkspaceUserAvatar
              name={name || undefined}
              email={profile.email}
              avatarUrl={profile.avatar_url}
              size="xl"
              className="border-4 border-white shadow-md"
            />
            <div className="min-w-0">
              {name ? <div className="text-lg font-semibold capitalize text-gray-900">{name}</div> : null}
              {profile.specialty ? (
                <p className="text-sm font-semibold text-indigo-600">{profile.specialty}</p>
              ) : null}
              {profile.education ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-gray-600">
                  <span className="shrink-0 text-gray-500 [&_svg]:h-4 [&_svg]:w-4">
                    <ProfileDetailIcon name="qualifications" />
                  </span>
                  <span className="min-w-0 break-words">{profile.education}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {chips.length > 0 ? (
          <div className="flex w-full flex-col gap-2 sm:w-[42%] sm:shrink-0">
            {chips.map((chip) => (
              <div
                key={chip.key}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5"
              >
                <span className="shrink-0 text-indigo-500">
                  <ProfileDetailIcon name={chip.icon} />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-tight text-gray-900">{chip.title}</p>
                  <p className="text-xs text-gray-500">{chip.caption}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {profile.bio ? (
        <p className="mt-3 text-sm leading-relaxed text-gray-600 whitespace-pre-line line-clamp-4">{profile.bio}</p>
      ) : null}
    </div>
  );
}

function ProfileDetailCard({ rows }: { rows: ProfileDetailRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-4 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm">
      <ProfileDetailRows rows={rows} />
    </div>
  );
}

interface BookingPreviewSidebarProps {
  workspaceName: string;
  workspaceTagline?: string | null;
  workspaceLogoUrl: string | null;
  /** Optional clinic/facility photo for public booking header (falls back to logo) */
  workspaceClinicImageUrl?: string | null;
  workspaceHostProfileHighlights?: BookingHostProfileHighlights | null;
  providerHostProfileHighlights?: BookingHostProfileHighlights | null;
  workspaceAddress?: WorkspacePublicAddress | null;
  workspacePrimaryColor: string;
  workspaceAccentColor: string | null;
  loadingSettings: boolean;
  departments: Department[];
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  selectedType: EventType | null;
  selectedDate: Date | null;
  selectedTime: string;
  step: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  /** IANA timezone for customer time display */
  displayTimezone?: string | null;
  providerTimezone?: string | null;
  selectedStartUtc?: string | null;
  /** Step 1 optional catalog selections (user_services–scoped), shown after department name */
  selectedStep1ServiceIds?: string[];
  step1CatalogServices?: Service[];
  /** Intake form config (custom field labels); same source as step 4 */
  intakeForm?: IntakeFormSettings | null;
  /** Values keyed by custom field id */
  customFieldValues?: Record<string, string>;
  /** Resolved meeting preference label (step 4 / 5) */
  meetingChoiceLabel?: string | null;
  current_step_id?: booking_step_id;
}

export function BookingPreviewSidebar({
  workspaceName,
  workspaceTagline,
  workspaceLogoUrl,
  workspaceClinicImageUrl,
  workspaceHostProfileHighlights = null,
  providerHostProfileHighlights = null,
  workspaceAddress = null,
  workspacePrimaryColor,
  workspaceAccentColor,
  loadingSettings,
  departments,
  selectedDepartment,
  selectedProvider,
  selectedType,
  selectedDate,
  selectedTime,
  step,
  name,
  email,
  phone,
  notes,
  displayTimezone,
  providerTimezone,
  selectedStartUtc,
  selectedStep1ServiceIds = [],
  step1CatalogServices = [],
  intakeForm,
  customFieldValues = {},
  meetingChoiceLabel,
  current_step_id,
}: BookingPreviewSidebarProps) {
  const departmentWithStep1Services = (deptName: string) => {
    if (!selectedStep1ServiceIds.length || !step1CatalogServices.length) return deptName;
    const byId = new Map(step1CatalogServices.map((s) => [s.id, s.name] as const));
    const names = selectedStep1ServiceIds
      .map((id) => byId.get(id))
      .filter((n): n is string => Boolean(n?.trim()));
    if (!names.length) return deptName;
    return `${deptName} (${names.join(', ')})`;
  };

  const primary = workspacePrimaryColor || DEFAULT_PRIMARY_COLOR;
  const accent = workspaceAccentColor || workspacePrimaryColor || DEFAULT_ACCENT_COLOR;
  const resolvedLogoSrc = resolve_workspace_logo_src(workspaceLogoUrl);
  const clinicImageSrc =
    typeof workspaceClinicImageUrl === 'string' && workspaceClinicImageUrl.trim() !== ''
      ? workspaceClinicImageUrl.trim()
      : null;
  const headerBrandSrc = clinicImageSrc ?? resolvedLogoSrc;
  const headerBrandTreatAsRemote = workspace_logo_is_remote(headerBrandSrc);
  const displayTagline = workspaceTagline?.trim() || '';
  const workspaceBio = workspaceHostProfileHighlights?.bio?.trim() || '';
  const workspaceHighlightRows = profile_detail_rows(workspaceHostProfileHighlights);
  const workspaceAddressRows = profile_detail_rows(null, workspaceAddress);
  const hasSelection = selectedDepartment || selectedProvider || selectedType;
  const showIntakeInPreview = current_step_id
    ? current_step_id === 'intake' || current_step_id === 'success'
    : step === 4 || step === 5;
  const customFieldRows =
    (intakeForm?.custom_fields ?? []).filter((field) =>
      intakeCustomFieldHasDisplayValue(customFieldValues[field.id])
    );
  const hasAdditionalInfo =
    showIntakeInPreview &&
    (customFieldRows.length > 0 || notes.trim().length > 0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [belowLg, setBelowLg] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const sync = () => setBelowLg(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useLayoutEffect(() => {
    if (selectedDate) step3PerfSidebarDateRendered(selectedDate);
  }, [selectedDate]);

  useLayoutEffect(() => {
    if (selectedTime) step3PerfSidebarTimeRendered(selectedTime);
  }, [selectedTime, selectedStartUtc]);

  return (
    <div
      className="w-full lg:sticky lg:top-0 lg:overflow-y-auto bg-gradient-to-br p-4 sm:p-6 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${primary}08 0%, ${accent}08 100%)` }}
    >
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, ${primary} 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      <div className="relative z-10">
        <div className="mb-4 sm:mb-4 lg:mb-6">
        {workspaceLogoUrl ? (
          <div className="flex justify-end w-full mb-3 sm:mb-4 px-2 min-h-[1rem]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Powered by GetSetTime
              </span>
          </div>
          ) : null}

          <button
            type="button"
            className="inline-flex items-center gap-2 mb-2 sm:mb-3 border-0 bg-transparent p-0 text-left font-inherit text-inherit cursor-pointer lg:cursor-default"
            aria-expanded={belowLg ? detailsOpen : true}
            aria-controls="booking-live-preview-details"
            onClick={() => {
              if (!belowLg) return;
              setDetailsOpen((open) => !open);
            }}
          >
            <div className="w-2 h-2 rounded-full animate-pulse bg-indigo-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Live Preview</span>
            <svg
              className={`h-3.5 w-3.5 text-gray-500 transition-transform lg:hidden ${detailsOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className="py-2 z-10 relative">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
              {!loadingSettings ? (
                <img
                  src={headerBrandSrc}
                  alt={workspaceName}
                  className={`shrink-0 rounded-xl ${
                    clinicImageSrc
                      ? 'h-20 w-20 sm:h-24 sm:w-24 object-cover'
                      : `h-12 w-12 ${
                          headerBrandTreatAsRemote
                            ? 'object-contain bg-white/80 p-0.5'
                            : 'object-contain'
                        }`
                  }`}
                />
              ) : (
                <div
                  className={`rounded-xl bg-white/40 animate-pulse ${
                    clinicImageSrc ? 'h-20 w-20 sm:h-24 sm:w-24' : 'h-12 w-12'
                  }`}
                  aria-hidden
                />
              )}
              <div className="min-w-0">
                <div className="text-sm text-gray-600">Schedule with</div>
                <div className="text-lg font-semibold capitalize">{workspaceName}</div>
                {displayTagline ? (
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{displayTagline}</p>
                ) : null}
              </div>
            </div>
            <ProfileHighlightList rows={workspaceHighlightRows} />
            </div>
            {workspaceBio ? (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">About the clinic</p>
                <p className="mt-1 text-sm leading-relaxed text-gray-600 whitespace-pre-line line-clamp-4">
                  {workspaceBio}
                </p>
              </div>
            ) : null}
            <ProviderProfileSection profile={providerHostProfileHighlights} />
            <ProfileDetailCard rows={workspaceAddressRows} />
          </div>
        </div>

        <div
          id="booking-live-preview-details"
          className={`relative bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-white/50 hover:shadow-xl transition-all duration-300 group space-y-6 ${hasSelection ? 'mt-3' : ''} ${detailsOpen ? '' : 'hidden lg:block'}`}
        >
          {!hasSelection ? (
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
              <div className="relative bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 border-2 border-dashed border-gray-200 text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <p className="text-sm sm:text-base text-gray-400 font-medium">{BOOKING_EMPTY_MESSAGES.noSelection}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {departments.length === 0 ? BOOKING_EMPTY_MESSAGES.noSelectionHintService : BOOKING_EMPTY_MESSAGES.noSelectionHintDept}
                </p>
              </div>
            </div>
          ) : (
            <>
              {selectedDepartment && !selectedProvider && (
                <div className="details-box">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 break-words">
                        {departmentWithStep1Services(selectedDepartment.name)}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600">Selected department</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedDepartment && selectedProvider && (
                <div className="details-box">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
                      <svg className="w-6 h-6 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-gray-900 text-base sm:text-lg mb-1 break-words">
                        {departmentWithStep1Services(selectedDepartment.name)}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-1.5 lowercase">
                        <svg className="w-3.5 h-3.5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="capitalize">{selectedProvider.name}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedType && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Event Duration</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {selectedType.title}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 pl-9 sm:pl-11 flex items-center gap-1.5 mt-1">
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{selectedType.duration_minutes || 30} minutes</span>
                  </div>
                </div>
              )}

              {selectedDate && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {formatDateWithTimezone(selectedDate)}
                  </div>
                </div>
              )}

              {selectedTime && selectedDate && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</div>
                  </div>
                  <div className="font-bold text-gray-900 text-base sm:text-lg pl-9 sm:pl-11">
                    {selectedStartUtc && displayTimezone
                      ? formatTimeOnlyInTimezone(selectedStartUtc, displayTimezone)
                      : displayTimezone?.trim()
                        ? `${selectedTime} (${getTimezoneAbbreviation(displayTimezone.trim(), selectedDate ?? undefined)})`
                        : selectedTime}
                  </div>
                  {selectedStartUtc &&
                  displayTimezone &&
                  providerTimezone &&
                  needsTimezoneConversion(providerTimezone, displayTimezone) ? (
                    <div className="text-xs text-gray-500 pl-9 sm:pl-11 mt-1">
                      Host:{' '}
                      {formatDateOnlyInTimezone(selectedStartUtc, providerTimezone)},{' '}
                      {formatTimeOnlyInTimezone(selectedStartUtc, providerTimezone)}
                    </div>
                  ) : null}
                </div>
              )}

              {showIntakeInPreview && meetingChoiceLabel && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Meeting</div>
                  </div>
                  <div className="font-bold text-gray-900 text-sm sm:text-base pl-9 sm:pl-11 break-words">
                    {meetingChoiceLabel}
                  </div>
                </div>
              )}

              {showIntakeInPreview && name && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</div>
                  </div>
                  <div className="space-y-1.5 sm:space-y-2 pl-9 sm:pl-11">
                    <div className="font-bold text-gray-900 text-sm sm:text-base truncate">{name}</div>
                    {email && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="truncate">{email}</span>
                      </div>
                    )}
                    {phone && (
                      <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-2 truncate">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span className="truncate">{phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {hasAdditionalInfo && (
                <div className="details-box">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Additional information
                    </div>
                  </div>
                  <div className="space-y-3 pl-9 sm:pl-11">
                    {notes.trim().length > 0 && (
                      <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
                        {notes}
                      </div>
                    )}
                    {customFieldRows.map((field) => (
                      <div key={field.id} className="text-sm text-gray-800 break-words">
                        <span className="font-semibold text-gray-800">
                          {displayLabelForIntakeField(field.id, field.label)}:
                        </span>{' '}
                        {formatIntakeFieldValueForDisplay(customFieldValues[field.id])}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {hasSelection ? (
            <span className="absolute -top-3 left-4 mt-0! inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 shadow-sm">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
              Selected
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}
