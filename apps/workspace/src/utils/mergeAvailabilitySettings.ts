import type { provider_availability_entry } from '@/src/types/workspace';

type availability_blob = {
  timesheet?: unknown;
  individual?: unknown;
  providers?: Record<string, provider_availability_entry>;
  [key: string]: unknown;
};

/**
 * Deep-merge availability: provider entries merge per-id; workspace timesheet/individual
 * are only replaced when explicitly present on the incoming payload.
 */
export function mergeAvailabilitySettings(
  existing: availability_blob | null | undefined,
  incoming: availability_blob | null | undefined
): availability_blob {
  const ex = existing ?? {};
  const inc = incoming ?? {};

  const mergedProviders = inc.providers
    ? {
        ...(typeof ex.providers === 'object' && ex.providers !== null ? ex.providers : {}),
        ...inc.providers,
      }
    : ex.providers;

  return {
    ...ex,
    ...inc,
    ...(inc.timesheet !== undefined ? { timesheet: inc.timesheet } : {}),
    ...(inc.individual !== undefined ? { individual: inc.individual } : {}),
    ...(mergedProviders !== undefined ? { providers: mergedProviders } : {}),
  };
}

/** Service providers may only write their own entry under availability.providers. */
export function sanitizeServiceProviderAvailabilityPatch(
  incoming: availability_blob | null | undefined,
  providerUserId: string
): availability_blob | null {
  if (!incoming || typeof incoming !== 'object') return null;
  const entry = incoming.providers?.[providerUserId];
  if (!entry || typeof entry !== 'object') return null;
  return {
    providers: {
      [providerUserId]: entry,
    },
  };
}
