import type { meeting_options_settings } from '@/src/types/workspace';
import type { workspace_notifications_settings } from '@/lib/workspace-notification-flags';

export type provider_notifications_entry = workspace_notifications_settings & {
  lastUpdated?: string;
};

export type provider_meeting_options_entry = meeting_options_settings & {
  lastUpdated?: string;
};

export type notifications_with_providers = workspace_notifications_settings & {
  providers?: Record<string, provider_notifications_entry>;
};

export type meeting_options_with_providers = meeting_options_settings & {
  providers?: Record<string, provider_meeting_options_entry>;
};

const PROVIDERS_KEY = 'providers';

function stripProviders<T extends Record<string, unknown>>(
  blob: T | null | undefined
): Omit<T, typeof PROVIDERS_KEY> {
  if (!blob || typeof blob !== 'object') return {} as Omit<T, typeof PROVIDERS_KEY>;
  const { [PROVIDERS_KEY]: _p, ...rest } = blob as T & { providers?: unknown };
  return rest as Omit<T, typeof PROVIDERS_KEY>;
}

function hasProviderEntry(entry: provider_notifications_entry | undefined): boolean {
  return !!entry && typeof entry === 'object' && Object.keys(stripProviders(entry)).length > 0;
}

const MEETING_OPTION_KEYS = ['google_meet', 'in_person', 'phone_call', 'whatsapp'] as const;

function providerMeetingOptionsEntryExists(
  meeting_options: meeting_options_with_providers | null | undefined,
  serviceProviderId: string
): boolean {
  const entry = meeting_options?.providers?.[serviceProviderId];
  if (!entry || typeof entry !== 'object') return false;
  const flat = stripProviders(entry as Record<string, unknown>);
  const hasOptionKey = MEETING_OPTION_KEYS.some((k) => k in flat);
  const hasLastUpdated = typeof flat.lastUpdated === 'string';
  return hasOptionKey || hasLastUpdated;
}

export function resolveNotificationsForServiceProvider(
  notifications: notifications_with_providers | null | undefined,
  serviceProviderId: string | null | undefined
): workspace_notifications_settings {
  const general = stripProviders(notifications ?? {}) as workspace_notifications_settings;
  if (!serviceProviderId) return general;

  const providerEntry = notifications?.providers?.[serviceProviderId];
  if (!hasProviderEntry(providerEntry)) return general;

  return {
    ...general,
    ...stripProviders(providerEntry as Record<string, unknown>),
  };
}

export function resolveMeetingOptionsForServiceProvider(
  meeting_options: meeting_options_with_providers | null | undefined,
  serviceProviderId: string | null | undefined
): meeting_options_settings {
  const general = stripProviders(meeting_options ?? {}) as meeting_options_settings;
  if (!serviceProviderId) return general;

  if (!providerMeetingOptionsEntryExists(meeting_options, serviceProviderId)) {
    return general;
  }

  const providerEntry = meeting_options!.providers![serviceProviderId];
  return stripProviders(providerEntry as Record<string, unknown>) as meeting_options_settings;
}
