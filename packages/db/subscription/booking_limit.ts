import type { booking_limit_period } from './types';

/** Sentinel value: no booking cap enforced. */
export const UNLIMITED_BOOKING_LIMIT = -1;

export function isUnlimitedBookingLimit(limit: number): boolean {
  return limit === UNLIMITED_BOOKING_LIMIT;
}

export function normalizeBookingLimitPeriod(
  value: unknown
): booking_limit_period {
  return value === 'lifetime' ? 'lifetime' : 'monthly';
}

export function formatBookingLimitLabel(limit: number): string {
  return isUnlimitedBookingLimit(limit) ? 'Unlimited' : String(limit);
}

export function formatBookingLimitFeature(
  limit: number,
  period: booking_limit_period = 'monthly'
): string {
  if (isUnlimitedBookingLimit(limit)) {
    return period === 'lifetime'
      ? 'Unlimited bookings'
      : 'Unlimited bookings per month';
  }
  return period === 'lifetime'
    ? `${limit} bookings total`
    : `${limit} bookings per month`;
}

export function formatBookingLimitShort(
  limit: number,
  period: booking_limit_period = 'monthly'
): string {
  if (isUnlimitedBookingLimit(limit)) return 'Unlimited';
  return period === 'lifetime' ? `${limit} total` : `${limit}/mo`;
}

export function formatBookingUsageLabel(period: booking_limit_period): string {
  return period === 'lifetime' ? 'Bookings used' : 'Bookings this month';
}

export function formatBookingRemainingLabel(period: booking_limit_period): string {
  return period === 'lifetime' ? 'remaining total' : 'remaining this month';
}
