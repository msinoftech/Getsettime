const DEFAULT_EVENT_TYPE_DURATION_MINUTES = 30;
const DEFAULT_SERVICE_DURATION_MINUTES = 30;

export type ServiceDurationCatalogItem = {
  id: string;
  duration?: number | null;
};

export function resolveEventTypeDurationMinutes(eventType: {
  duration_minutes: number | null;
}): number {
  const raw = eventType.duration_minutes;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.trunc(raw);
  }
  return DEFAULT_EVENT_TYPE_DURATION_MINUTES;
}

export function serviceDurationMinutes(
  service: ServiceDurationCatalogItem
): number {
  const raw = service.duration;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1) {
    return Math.trunc(raw);
  }
  return DEFAULT_SERVICE_DURATION_MINUTES;
}

export function sumSelectedServiceDurationMinutes(
  selectedServiceIds: string[],
  catalog: ServiceDurationCatalogItem[]
): number {
  if (selectedServiceIds.length === 0) return 0;
  const byId = new Map(catalog.map((s) => [s.id, s]));
  let total = 0;
  for (const id of selectedServiceIds) {
    const row = byId.get(id);
    if (row) total += serviceDurationMinutes(row);
  }
  return total;
}

export function resolveEffectiveBookingDurationMinutes(
  eventType: { duration_minutes: number | null },
  selectedServiceIds: string[],
  catalog: ServiceDurationCatalogItem[]
): number {
  const eventMinutes = resolveEventTypeDurationMinutes(eventType);
  const serviceTotal = sumSelectedServiceDurationMinutes(
    selectedServiceIds,
    catalog
  );
  return Math.max(eventMinutes, serviceTotal);
}

/** Dedupe catalogs for duration lookup (Step 1 scoped + intake list). */
export function mergeServiceCatalogForDuration(
  ...catalogs: ServiceDurationCatalogItem[][]
): ServiceDurationCatalogItem[] {
  const byId = new Map<string, ServiceDurationCatalogItem>();
  for (const list of catalogs) {
    for (const s of list) {
      if (!byId.has(s.id)) byId.set(s.id, s);
    }
  }
  return [...byId.values()];
}

/** Extract catalog service ids from booking metadata.intake_form.services */
export function intakeServiceIdsFromMetadata(
  metadata: unknown
): string[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const intake = (metadata as { intake_form?: unknown }).intake_form;
  if (!intake || typeof intake !== 'object') return [];
  const services = (intake as { services?: unknown }).services;
  if (!Array.isArray(services)) return [];
  return services.filter((x): x is string => typeof x === 'string');
}
