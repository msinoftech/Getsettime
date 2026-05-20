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
