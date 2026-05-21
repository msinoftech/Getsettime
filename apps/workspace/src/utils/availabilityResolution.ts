import type { AvailabilitySettings } from '@/src/types/workspace';
import type { DaySchedule } from '@/src/types/workspace';

export type provider_availability_entry = {
  timesheet?: Record<string, DaySchedule> | null;
  individual?: Record<string, boolean>;
  lastUpdated?: string;
};

export type availability_with_providers = AvailabilitySettings & {
  providers?: Record<string, provider_availability_entry>;
};

function hasTimesheetData(
  timesheet: Record<string, DaySchedule> | null | undefined
): boolean {
  return !!timesheet && Object.keys(timesheet).length > 0;
}

/**
 * Resolves bookable availability for a service provider.
 * Uses provider-specific schedule when configured; otherwise falls back to workspace general.
 */
export function resolveAvailabilityForServiceProvider(
  availability: availability_with_providers | null | undefined,
  serviceProviderId: string | null | undefined
): AvailabilitySettings {
  const general = availability ?? {};
  const generalTimesheet = general.timesheet;
  const generalIndividual = general.individual ?? {};

  if (!serviceProviderId) {
    return { timesheet: generalTimesheet, individual: generalIndividual };
  }

  const providerEntry = general.providers?.[serviceProviderId];
  const providerTimesheet = providerEntry?.timesheet;
  const providerIndividual = providerEntry?.individual;

  if (hasTimesheetData(providerTimesheet)) {
    return {
      timesheet: providerTimesheet ?? undefined,
      individual: providerIndividual ?? {},
    };
  }

  return { timesheet: generalTimesheet, individual: generalIndividual };
}
