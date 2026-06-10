import { resolveProviderTimezone } from '@/src/utils/timezone';
import {
  formatFullDateTimeInTimezone,
  formatNotificationDateTimeInTimezone,
} from '@/lib/date-timezone';

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

export type dual_time_email_audience = 'customer' | 'provider';

export function formatDualTimeBlock(
  startIso: string,
  customerTimezone: string | null | undefined,
  providerTimezone: string | null | undefined,
  audience: dual_time_email_audience = 'customer'
): string {
  const customerTz = customerTimezone?.trim();
  const providerTz = providerTimezone?.trim();
  if (!customerTz && !providerTz) return '';
  if (customerTz && providerTz && customerTz !== providerTz) {
    const customerTime = formatFullDateTimeInTimezone(startIso, customerTz);
    const providerTime = formatFullDateTimeInTimezone(startIso, providerTz);
    if (audience === 'provider') {
      return `Customer time: ${customerTime}\nYour time: ${providerTime}`;
    }
    return `Your time: ${customerTime}\nHost time: ${providerTime}`;
  }
  const tz = customerTz || providerTz!;
  return formatFullDateTimeInTimezone(startIso, tz);
}

export function notification_timezone_for_role(
  role: 'customer' | 'provider',
  fields: {
    customer_timezone?: string | null;
    provider_timezone?: string | null;
    timezone?: string | null;
  }
): string | undefined {
  const customer = fields.customer_timezone?.trim();
  const provider = fields.provider_timezone?.trim();
  const legacy = fields.timezone?.trim();
  if (role === 'provider') {
    return provider || legacy || customer || undefined;
  }
  return customer || legacy || provider || undefined;
}

export function formatBookingNotificationDateTime(
  iso: string,
  timezone?: string | null
): string {
  return formatNotificationDateTimeInTimezone(iso, timezone);
}

export function whatsapp_timezone_payload(
  customer_timezone: string | null | undefined,
  provider_timezone: string | null | undefined
): { customer_timezone?: string; provider_timezone?: string } {
  const customer = customer_timezone?.trim();
  const provider = provider_timezone?.trim();
  return {
    ...(customer ? { customer_timezone: customer } : {}),
    ...(provider ? { provider_timezone: provider } : {}),
  };
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
