import type { SupabaseClient } from '@supabase/supabase-js';
import {
  intakeServiceIdsFromMetadata,
  resolveEffectiveBookingDurationMinutes,
  type ServiceDurationCatalogItem,
} from '@/src/utils/bookingDuration';

export async function loadServiceDurationsForWorkspace(
  supabase: SupabaseClient,
  workspaceId: number | string,
  serviceIds: string[]
): Promise<ServiceDurationCatalogItem[]> {
  const unique = [...new Set(serviceIds.filter((id) => typeof id === 'string' && id.trim()))];
  if (unique.length === 0) return [];

  const { data, error } = await supabase
    .from('services')
    .select('id, duration')
    .eq('workspace_id', workspaceId)
    .in('id', unique);

  if (error) {
    console.error('loadServiceDurationsForWorkspace:', error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    duration: row.duration as number | null,
  }));
}

export async function resolveEffectiveDurationForBookingRequest(
  supabase: SupabaseClient,
  workspaceId: number | string,
  eventTypeId: string | null | undefined,
  metadata: unknown,
  serviceIdsOverride?: string[]
): Promise<number> {
  const serviceIds =
    serviceIdsOverride ?? intakeServiceIdsFromMetadata(metadata);

  let eventTypeRow: { duration_minutes: number | null } = { duration_minutes: null };
  if (eventTypeId) {
    const { data: et } = await supabase
      .from('event_types')
      .select('duration_minutes')
      .eq('id', eventTypeId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (et) {
      eventTypeRow = { duration_minutes: et.duration_minutes ?? null };
    }
  }

  const catalog = await loadServiceDurationsForWorkspace(
    supabase,
    workspaceId,
    serviceIds
  );

  return resolveEffectiveBookingDurationMinutes(
    eventTypeRow,
    serviceIds,
    catalog
  );
}

/** Minutes between start and end ISO strings (absolute). */
export function bookingSpanMinutes(startAt: string, endAt: string): number {
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60_000);
}

const DURATION_TOLERANCE_MINUTES = 1;

export type BookingDurationValidation =
  | { ok: true; resolvedEndAt: string }
  | { ok: false; message: string };

/** Ensures client end_at matches effective duration; supplies end when omitted. */
export function validateBookingEndAt(
  startAt: string,
  endAt: string | null | undefined,
  effectiveMinutes: number
): BookingDurationValidation {
  if (!endAt) {
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) {
      return { ok: false, message: 'Invalid start time.' };
    }
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + effectiveMinutes);
    return { ok: true, resolvedEndAt: end.toISOString() };
  }

  const span = bookingSpanMinutes(startAt, endAt);
  if (Math.abs(span - effectiveMinutes) > DURATION_TOLERANCE_MINUTES) {
    return {
      ok: false,
      message: `Booking duration must be ${effectiveMinutes} minutes for the selected event type and services.`,
    };
  }
  return { ok: true, resolvedEndAt: endAt };
}
