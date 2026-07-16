import type { SupabaseClient } from '@supabase/supabase-js';
import type { date_exception } from '@/src/types/date_exceptions';
import {
  applyExceptionScheduleBounds,
  isSlotBlockedByException,
  resolveExceptionEffectForDate,
} from '@/src/utils/dateExceptionRules';

/** Load active exceptions that could affect a booking on providerDateStr. */
export async function fetchActiveDateExceptionsForSlot(
  supabase: SupabaseClient,
  workspaceId: number | string,
  providerDateStr: string,
  providerId: string | null | undefined
): Promise<date_exception[]> {
  const monthDay = providerDateStr.slice(5); // MM-DD
  let query = supabase
    .from('date_exceptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if (providerId) {
    query = query.or(`provider_id.is.null,provider_id.eq.${providerId}`);
  } else {
    query = query.is('provider_id', null);
  }

  // Exact date OR yearly repeats (filter month-day in memory)
  query = query.or(`exception_date.eq.${providerDateStr},repeat_yearly.eq.true`);

  const { data, error } = await query;
  if (error) {
    console.error('Error loading date_exceptions for booking validation:', error);
    return [];
  }

  const rows = (data || []) as date_exception[];
  return rows.filter((row) => {
    if (row.exception_date === providerDateStr) return true;
    if (!row.repeat_yearly) return false;
    return row.exception_date.slice(5) === monthDay;
  });
}

export type slot_exception_validation = {
  blocked: boolean;
  error?: string;
  /** Adjusted schedule bounds when special hours apply */
  startMinutes?: number;
  endMinutes?: number;
  allowDisabledDay?: boolean;
};

/**
 * Validate a slot against date exceptions and optionally supply special-hours bounds.
 */
export function validateSlotDateExceptions(
  exceptions: date_exception[],
  providerDateStr: string,
  providerId: string | null | undefined,
  slotStartMinutes: number,
  slotEndMinutes: number,
  timesheetStartMinutes: number,
  timesheetEndMinutes: number
): slot_exception_validation {
  const effect = resolveExceptionEffectForDate(
    exceptions,
    providerDateStr,
    providerId
  );

  if (effect.kind === 'closed') {
    return {
      blocked: true,
      error: 'This date is closed due to an availability exception.',
    };
  }

  const bounds = applyExceptionScheduleBounds(
    exceptions,
    providerDateStr,
    providerId,
    timesheetStartMinutes,
    timesheetEndMinutes
  );

  if (bounds.closed) {
    return {
      blocked: true,
      error: 'This date is closed due to an availability exception.',
    };
  }

  if (
    slotStartMinutes < bounds.startMinutes ||
    slotEndMinutes > bounds.endMinutes
  ) {
    // Only enforce when special hours remapped the window
    if (effect.kind === 'open' && effect.specialHours) {
      return {
        blocked: true,
        error: 'This time slot is outside available hours.',
        startMinutes: bounds.startMinutes,
        endMinutes: bounds.endMinutes,
        allowDisabledDay: true,
      };
    }
  }

  if (
    isSlotBlockedByException(
      exceptions,
      providerDateStr,
      providerId,
      slotStartMinutes,
      slotEndMinutes
    )
  ) {
    return {
      blocked: true,
      error: 'This time slot is blocked by an availability exception.',
      startMinutes: bounds.startMinutes,
      endMinutes: bounds.endMinutes,
      allowDisabledDay: Boolean(effect.kind === 'open' && effect.specialHours),
    };
  }

  return {
    blocked: false,
    startMinutes: bounds.startMinutes,
    endMinutes: bounds.endMinutes,
    allowDisabledDay: Boolean(effect.kind === 'open' && effect.specialHours),
  };
}
