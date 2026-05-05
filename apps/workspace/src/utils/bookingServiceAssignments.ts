/**
 * Provider↔service assignments: prefer `user_services` (API) as source of truth.
 * Legacy: `service.meta_data.service_providers` (still readable for older payloads).
 */

export type ServiceProvidersMetaEntry = { id: string; name?: string };

export function normalizeServiceProvidersMeta(value: unknown): ServiceProvidersMetaEntry[] {
  if (!Array.isArray(value)) return [];
  const out: ServiceProvidersMetaEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const id = typeof e.id === 'string' ? e.id : null;
    if (!id) continue;
    const name = typeof e.name === 'string' ? e.name : undefined;
    out.push(name !== undefined ? { id, name } : { id });
  }
  return out;
}

/** Rows from GET `/api/user-services?user_id=…` → service ids assigned to that provider. */
export function serviceIdsFromUserServiceAssignments(
  rows: ReadonlyArray<{ user_id: string; service_id: string }>,
  providerUserId: string
): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    if (r.user_id === providerUserId) out.add(r.service_id);
  }
  return out;
}

export function isProviderAssignedToService(
  metaData: Record<string, unknown> | null | undefined,
  providerUserId: string
): boolean {
  const raw = metaData?.service_providers;
  return normalizeServiceProvidersMeta(raw).some((p) => p.id === providerUserId);
}
