import { resolveProviderTimezone } from '@/src/utils/timezone';
import { formatFullDateTimeInTimezone } from '@/lib/date-timezone';

export type booking_timezone_fields = {
  customer_timezone: string | null;
  provider_timezone: string | null;
};

export function parseBookingTimezoneBody(body: Record<string, unknown>): {
  customer_timezone: string | null;
  provider_timezone: string | null;
  legacy_timezone: string | null;
} {
  const customer =
    typeof body.customer_timezone === 'string' && body.customer_timezone.trim()
      ? body.customer_timezone.trim()
      : typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : null;
  const provider =
    typeof body.provider_timezone === 'string' && body.provider_timezone.trim()
      ? body.provider_timezone.trim()
      : null;
  const legacy =
    typeof body.timezone === 'string' && body.timezone.trim() ? body.timezone.trim() : null;
  return { customer_timezone: customer, provider_timezone: provider, legacy_timezone: legacy };
}

export function resolveBookingTimezonesForInsert(
  body: Record<string, unknown>,
  workspaceTimezone?: string | null
): booking_timezone_fields {
  const parsed = parseBookingTimezoneBody(body);
  const customer = parsed.customer_timezone;
  const provider =
    parsed.provider_timezone ??
    (customer && workspaceTimezone?.trim()
      ? resolveProviderTimezone(workspaceTimezone, customer)
      : customer
        ? resolveProviderTimezone('', customer)
        : workspaceTimezone?.trim() || null);
  return {
    customer_timezone: customer,
    provider_timezone: provider,
  };
}

/** Timezone used for server availability validation. */
export function resolveValidationTimezone(
  workspaceTimezone: string | null | undefined,
  customerTimezone: string | null | undefined,
  providerTimezone: string | null | undefined
): string | null {
  if (workspaceTimezone?.trim()) return workspaceTimezone.trim();
  if (providerTimezone?.trim()) return providerTimezone.trim();
  if (customerTimezone?.trim()) return customerTimezone.trim();
  return null;
}

export function formatDualTimeBlock(
  startIso: string,
  customerTimezone: string | null | undefined,
  providerTimezone: string | null | undefined
): string {
  const customerTz = customerTimezone?.trim();
  const providerTz = providerTimezone?.trim();
  if (!customerTz && !providerTz) return '';
  if (customerTz && providerTz && customerTz !== providerTz) {
    return `Your time: ${formatFullDateTimeInTimezone(startIso, customerTz)}\nHost time: ${formatFullDateTimeInTimezone(startIso, providerTz)}`;
  }
  const tz = customerTz || providerTz!;
  return formatFullDateTimeInTimezone(startIso, tz);
}

export function readBookingTimezonesFromRow(booking: {
  customer_timezone?: string | null;
  provider_timezone?: string | null;
}): booking_timezone_fields {
  return {
    customer_timezone: booking.customer_timezone?.trim() || null,
    provider_timezone: booking.provider_timezone?.trim() || null,
  };
}

/** Email template fields from stored booking timezones. */
export function emailTimezoneFields(
  customer_timezone: string | null | undefined,
  provider_timezone: string | null | undefined,
  startIso: string
): {
  customerTimezone?: string;
  providerTimezone?: string;
  timezone?: string;
  dualTimeBlock?: string;
} {
  const customer = customer_timezone?.trim() || undefined;
  const provider = provider_timezone?.trim() || undefined;
  const dual = formatDualTimeBlock(startIso, customer ?? null, provider ?? null);
  const showDual = Boolean(customer && provider && customer !== provider);
  return {
    customerTimezone: customer,
    providerTimezone: provider,
    timezone: customer ?? provider,
    ...(showDual ? { dualTimeBlock: dual } : {}),
  };
}
