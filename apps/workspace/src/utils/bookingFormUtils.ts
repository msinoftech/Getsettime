import type { Department, EventType } from '@/src/types/bookingForm';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';

/** Minimal team row for bookable-department resolution. */
export type booking_team_member_for_departments = {
  deactivated?: boolean;
  role?: string | null;
  is_workspace_owner?: boolean;
  additional_roles?: string[];
  departments?: number[];
};

/** Department ids that have at least one active service provider assigned. */
export function departmentIdsWithActiveServiceProviders(
  members: booking_team_member_for_departments[]
): Set<number> {
  const ids = new Set<number>();
  for (const m of members) {
    if (m.deactivated) continue;
    if (
      !userActsAsServiceProviderFromMetadata({
        role: m.role ?? null,
        is_workspace_owner: m.is_workspace_owner === true,
        additional_roles: m.additional_roles,
      })
    ) {
      continue;
    }
    for (const raw of m.departments ?? []) {
      const n = Number(raw);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
  }
  return ids;
}

/** Departments bookable in public/multi-step flows: active status + active provider. */
export function filterBookableDepartments(
  departments: Department[],
  members: booking_team_member_for_departments[]
): Department[] {
  const withProvider = departmentIdsWithActiveServiceProviders(members);
  return departments.filter(
    (d) => d.status !== 'inactive' && withProvider.has(Number(d.id))
  );
}

/** Match team member department ids to a department row (coerces string/number). */
export function memberActsInDepartment(
  memberDepartmentIds: number[] | undefined,
  departmentId: number
): boolean {
  if (!Array.isArray(memberDepartmentIds)) return false;
  const did = Number(departmentId);
  return memberDepartmentIds.some((id) => Number(id) === did);
}

export function sortEventTypesByDuration(eventTypes: EventType[]): EventType[] {
  return [...eventTypes].sort(
    (a, b) => (a.duration_minutes ?? Infinity) - (b.duration_minutes ?? Infinity)
  );
}

export function filterEventTypesBySlug(eventTypes: EventType[], slug: string): EventType[] {
  if (!slug) return eventTypes;
  return eventTypes.filter((t) => t.slug === slug);
}

export function filterEventTypesByDuration(eventTypes: EventType[], duration: number): EventType[] {
  return eventTypes.filter((t) => t.duration_minutes === duration);
}

/**
 * Parse event type duration from URL param (e.g. "15mins" -> 15, "30min" -> 30).
 * Returns null if not a valid duration string.
 */
export function parseEventTypeDurationParam(eventType: string | undefined): number | null {
  if (!eventType) return null;
  const match = eventType.match(/^(\d+)(?:min|mins|minute|minutes)?$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Filter by slug or duration, then sort. For embed eventType/eventTypeSlug URL params.
 */
export function getSortedFilteredEventTypes(
  eventTypes: EventType[],
  opts: { slug?: string; duration?: number | null }
): EventType[] {
  let filtered = eventTypes;
  if (opts.slug) filtered = filterEventTypesBySlug(filtered, opts.slug);
  else if (opts.duration != null) filtered = filterEventTypesByDuration(filtered, opts.duration);
  return sortEventTypesByDuration(filtered);
}

/** Event types the provider can host: assigned providers when set, else the owner. */
export function filterEventTypesForServiceProvider<
  T extends event_type_assignment_fields,
>(eventTypes: T[], serviceProviderId: string | null | undefined): T[] {
  if (!serviceProviderId) return eventTypes;
  return eventTypes.filter((et) =>
    isProviderAssignedToEventType(serviceProviderId, et)
  );
}

export function filterBookableEventTypes<T extends { status?: unknown }>(
  eventTypes: T[]
): T[] {
  return eventTypes.filter(
    (et) => et.status == null || et.status === 'active'
  );
}

/** Event type fields that constrain booking department and provider. */
export type event_type_assignment_fields = {
  department_id?: string | number | null;
  service_id?: string | number | null;
  service_provider_ids?: unknown;
  owner_id?: string | null;
};

export function eventTypeAssignedDepartmentId(
  eventType: event_type_assignment_fields | null | undefined
): string | null {
  if (eventType?.department_id == null || eventType.department_id === '') {
    return null;
  }
  return String(eventType.department_id);
}

export function parseEventTypeProviderIds(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value).trim()).filter(Boolean);
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map((value) => String(value).trim()).filter(Boolean);
      }
    } catch {
      return raw.split(',').map((part) => part.trim()).filter(Boolean);
    }
  }
  return [];
}

/** Assigned hosts: `service_provider_ids` when set, otherwise `owner_id`. Empty means no restriction. */
export function eventTypeAssignedProviderIds(
  eventType: event_type_assignment_fields | null | undefined
): string[] {
  if (!eventType) return [];
  const from_list = parseEventTypeProviderIds(eventType.service_provider_ids);
  if (from_list.length > 0) return from_list;
  const owner = eventType.owner_id?.trim();
  return owner ? [owner] : [];
}

export function isDepartmentAssignedToEventType(
  departmentId: string,
  eventType: event_type_assignment_fields | null | undefined
): boolean {
  if (!departmentId) return true;
  const assigned = eventTypeAssignedDepartmentId(eventType);
  if (!assigned) return true;
  return assigned === String(departmentId);
}

export function isProviderAssignedToEventType(
  providerId: string,
  eventType: event_type_assignment_fields | null | undefined
): boolean {
  if (!providerId) return true;
  const assigned = eventTypeAssignedProviderIds(eventType);
  if (assigned.length === 0) return true;
  return assigned.includes(providerId);
}

/** Departments bookable for the selected event type; an unassigned type allows all. */
export function filterDepartmentsForEventType(
  departments: Department[],
  eventType: event_type_assignment_fields | null | undefined
): Department[] {
  const assigned = eventTypeAssignedDepartmentId(eventType);
  if (!assigned) return departments;
  return departments.filter((d) => String(d.id) === assigned);
}

/** Providers bookable for the selected event type; an unassigned type allows all. */
export function filterProvidersForEventType<T extends { id: string }>(
  providers: T[],
  eventType: event_type_assignment_fields | null | undefined
): T[] {
  const assigned = eventTypeAssignedProviderIds(eventType);
  if (assigned.length === 0) return providers;
  const allowed = new Set(assigned);
  return providers.filter((p) => allowed.has(p.id));
}

/** Workspace owners with no department list act in every department (booking edit). */
export function providerAssignedToDepartment(
  provider: {
    departments?: number[];
    is_workspace_owner?: boolean;
  },
  departmentId: string
): boolean {
  if (!departmentId) return true;
  const ids = provider.departments ?? [];
  if (provider.is_workspace_owner === true && ids.length === 0) return true;
  const department_number = Number(departmentId);
  if (!Number.isFinite(department_number)) return false;
  return memberActsInDepartment(ids, department_number);
}
