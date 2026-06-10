export const TIMEZONE_OPTIONS = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
] as const;

/** Expanded list for customer timezone selector in booking flow. */
export const CUSTOMER_TIMEZONE_OPTIONS: string[] = [
  ...TIMEZONE_OPTIONS,
  'America/Denver',
  'America/Phoenix',
  'America/Toronto',
  'America/Vancouver',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Bangkok',
  'Pacific/Auckland',
  'Africa/Johannesburg',
  'Africa/Cairo',
];

export function getCustomerTimezoneOptions(current?: string | null): string[] {
  const set = new Set(CUSTOMER_TIMEZONE_OPTIONS);
  const cur = current?.trim();
  if (cur) set.add(cur);
  return Array.from(set).sort();
}
