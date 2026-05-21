import type {
  provider_meeting_options_entry,
  provider_notifications_entry,
} from '@/src/utils/providerSettingsResolution';

type notifications_blob = {
  providers?: Record<string, provider_notifications_entry>;
  [key: string]: unknown;
};

type meeting_options_blob = {
  providers?: Record<string, provider_meeting_options_entry>;
  [key: string]: unknown;
};

export function mergeNotificationsSettings(
  existing: notifications_blob | null | undefined,
  incoming: notifications_blob | null | undefined
): notifications_blob {
  const ex = existing ?? {};
  const inc = incoming ?? {};

  const mergedProviders = inc.providers
    ? {
        ...(typeof ex.providers === 'object' && ex.providers !== null ? ex.providers : {}),
        ...inc.providers,
      }
    : ex.providers;

  const { providers: _ip, ...incRest } = inc;
  const { providers: _ep, ...exRest } = ex;

  return {
    ...exRest,
    ...incRest,
    ...(mergedProviders !== undefined ? { providers: mergedProviders } : {}),
  };
}

export function mergeMeetingOptionsSettings(
  existing: meeting_options_blob | null | undefined,
  incoming: meeting_options_blob | null | undefined
): meeting_options_blob {
  const ex = existing ?? {};
  const inc = incoming ?? {};

  const mergedProviders = inc.providers
    ? {
        ...(typeof ex.providers === 'object' && ex.providers !== null ? ex.providers : {}),
        ...inc.providers,
      }
    : ex.providers;

  const { providers: _ip, ...incRest } = inc;
  const { providers: _ep, ...exRest } = ex;

  return {
    ...exRest,
    ...incRest,
    ...(mergedProviders !== undefined ? { providers: mergedProviders } : {}),
  };
}

export function sanitizeServiceProviderNotificationsPatch(
  incoming: notifications_blob | null | undefined,
  providerUserId: string
): notifications_blob | null {
  if (!incoming || typeof incoming !== 'object') return null;
  const entry = incoming.providers?.[providerUserId];
  if (!entry || typeof entry !== 'object') return null;
  return { providers: { [providerUserId]: entry } };
}

export function sanitizeServiceProviderMeetingOptionsPatch(
  incoming: meeting_options_blob | null | undefined,
  providerUserId: string
): meeting_options_blob | null {
  if (!incoming || typeof incoming !== 'object') return null;
  const entry = incoming.providers?.[providerUserId];
  if (!entry || typeof entry !== 'object') return null;
  return { providers: { [providerUserId]: entry } };
}

/** SP sent top-level keys only — wrap as a single provider patch. */
export function wrapServiceProviderTopLevelNotifications(
  incoming: Record<string, unknown>,
  providerUserId: string
): notifications_blob | null {
  const { providers: _p, ...rest } = incoming;
  if (Object.keys(rest).length === 0) return null;
  return {
    providers: {
      [providerUserId]: rest as provider_notifications_entry,
    },
  };
}

export function wrapServiceProviderTopLevelMeetingOptions(
  incoming: Record<string, unknown>,
  providerUserId: string
): meeting_options_blob | null {
  const { providers: _p, ...rest } = incoming;
  if (Object.keys(rest).length === 0) return null;
  return {
    providers: {
      [providerUserId]: rest as provider_meeting_options_entry,
    },
  };
}
