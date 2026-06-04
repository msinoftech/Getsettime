/** Sentinel value: no monthly booking cap enforced. */
export const UNLIMITED_BOOKING_LIMIT = -1;

export function isUnlimitedBookingLimit(limit: number): boolean {
  return limit === UNLIMITED_BOOKING_LIMIT;
}

export function formatBookingLimitLabel(limit: number): string {
  return isUnlimitedBookingLimit(limit) ? 'Unlimited' : String(limit);
}

export function formatBookingLimitFeature(limit: number): string {
  return isUnlimitedBookingLimit(limit)
    ? 'Unlimited bookings per month'
    : `${limit} bookings per month`;
}
