import type { ServiceProvider } from '@/src/types/booking-entities';
import { capitalize_booking_display_label } from '@/src/utils/booking';

/** Minimal user shape for resolving a display name (provider or workspace owner). */
export type service_provider_display_source = Pick<ServiceProvider, 'email' | 'raw_user_meta_data'>;

function name_from_source(source: service_provider_display_source): string {
  const meta = source.raw_user_meta_data;
  const fromMeta = meta?.full_name?.trim() || meta?.name?.trim();
  if (fromMeta) return fromMeta;
  const email = source.email?.trim();
  if (email) return email;
  return '';
}

function phone_from_source(source: service_provider_display_source): string {
  const raw = source.raw_user_meta_data?.phone;
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : '';
}

/**
 * Display name for the assigned service provider, falling back to the workspace owner (admin)
 * when no provider is set.
 */
export function get_service_provider_display_name(
  service_provider: ServiceProvider | null | undefined,
  workspace_owner: service_provider_display_source | null | undefined,
  empty_label = 'N/A'
): string {
  let resolved: string;
  if (service_provider != null) {
    const n = name_from_source(service_provider);
    resolved = n || empty_label;
  } else if (workspace_owner) {
    const n = name_from_source(workspace_owner);
    resolved = n || empty_label;
  } else {
    resolved = empty_label;
  }
  return capitalize_booking_display_label(resolved);
}

/**
 * Phone for the assigned service provider, falling back to the workspace owner (admin)
 * when no provider is set. Does not title-case (unlike display name).
 */
export function get_service_provider_display_phone(
  service_provider: ServiceProvider | null | undefined,
  workspace_owner: service_provider_display_source | null | undefined,
  empty_label = ''
): string {
  let resolved: string;
  if (service_provider != null) {
    const p = phone_from_source(service_provider);
    resolved = p || empty_label;
  } else if (workspace_owner) {
    const p = phone_from_source(workspace_owner);
    resolved = p || empty_label;
  } else {
    resolved = empty_label;
  }
  return resolved;
}

/**
 * Display name for a booking's provider, preferring the stored snapshot
 * (`service_provider_name`) so historical bookings keep their original name even
 * if the provider is renamed or removed. Falls back to a live lookup, then 'N/A'.
 */
export function booking_service_provider_display_name(
  booking: {
    service_provider_id: string | null;
    service_provider_name?: string | null;
  },
  live_provider?: ServiceProvider | null,
  workspace_owner?: service_provider_display_source | null
): string {
  const snapshot = booking.service_provider_name?.trim();
  if (snapshot) return capitalize_booking_display_label(snapshot);

  const has_provider =
    booking.service_provider_id != null && booking.service_provider_id !== '';
  return get_service_provider_display_name(
    has_provider ? live_provider ?? null : null,
    has_provider ? undefined : workspace_owner
  );
}
