import type { ServiceProvider } from '@/src/types/booking-entities';

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

/**
 * Display name for the assigned service provider, falling back to the workspace owner (admin)
 * when no provider is set.
 */
export function get_service_provider_display_name(
  service_provider: ServiceProvider | null | undefined,
  workspace_owner: service_provider_display_source | null | undefined,
  empty_label = 'N/A'
): string {
  if (service_provider != null) {
    const n = name_from_source(service_provider);
    return n || empty_label;
  }
  if (workspace_owner) {
    const n = name_from_source(workspace_owner);
    if (n) return n;
  }
  return empty_label;
}
