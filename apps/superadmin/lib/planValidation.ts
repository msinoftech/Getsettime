import type { plan_content_input, plan_input } from '@app/db/subscription';
import { UNLIMITED_BOOKING_LIMIT } from '@app/db/subscription';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseSlug(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const slug = value.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) return null;
  return slug;
}

function parseNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || !Number.isInteger(value)) return null;
  return value;
}

/** Allows -1 (unlimited) or any non-negative integer. */
function parseBookingLimit(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return null;
  }
  if (value === UNLIMITED_BOOKING_LIMIT) return value;
  if (value < 0) return null;
  return value;
}

function parsePrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
}

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') return undefined;
  return value;
}

function parseContentInput(body: Record<string, unknown>): plan_content_input | null {
  if (body.content === undefined || body.content === null) return null;
  if (typeof body.content !== 'object' || Array.isArray(body.content)) {
    throw new Error('content must be an object');
  }
  const c = body.content as Record<string, unknown>;
  const features = Array.isArray(c.features)
    ? c.features
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : undefined;

  const ctaVariant =
    c.cta_variant === 'dark' || c.cta_variant === 'primary' ? c.cta_variant : undefined;

  const context =
    c.context === 'upgrade_modal' || c.context === 'billing_page' ? c.context : undefined;

  return {
    context,
    subtitle:
      typeof c.subtitle === 'string'
        ? c.subtitle.trim() || null
        : c.subtitle === null
          ? null
          : undefined,
    features,
    cta_label:
      typeof c.cta_label === 'string'
        ? c.cta_label.trim() || null
        : c.cta_label === null
          ? null
          : undefined,
    cta_variant: ctaVariant,
    badge_label:
      typeof c.badge_label === 'string'
        ? c.badge_label.trim() || null
        : c.badge_label === null
          ? null
          : undefined,
    is_highlighted: typeof c.is_highlighted === 'boolean' ? c.is_highlighted : undefined,
    display_order:
      typeof c.display_order === 'number' && Number.isFinite(c.display_order)
        ? Math.max(0, Math.floor(c.display_order))
        : undefined,
  };
}

export function parsePlanInput(body: Record<string, unknown>): plan_input {
  const errors: string[] = [];

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length < 2) errors.push('Name is required (min 2 characters)');

  const slug = parseSlug(body.slug);
  if (!slug) errors.push('Slug must be lowercase kebab-case');

  const price = parsePrice(body.price);
  if (price === null) errors.push('Price must be a non-negative number');

  const bookingLimit = parseBookingLimit(body.booking_limit);
  if (bookingLimit === null) {
    errors.push('booking_limit must be -1 (unlimited) or a non-negative integer');
  }

  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  const content =
    body.content !== undefined ? parseContentInput(body) : undefined;

  return {
    name,
    slug: slug as string,
    price: price as number,
    booking_limit: bookingLimit as number,
    workspace_limit:
      body.workspace_limit !== undefined ? parseNonNegativeInt(body.workspace_limit) ?? undefined : undefined,
    admin_limit:
      body.admin_limit !== undefined ? parseNonNegativeInt(body.admin_limit) ?? undefined : undefined,
    service_provider_limit:
      body.service_provider_limit !== undefined
        ? parseNonNegativeInt(body.service_provider_limit) ?? undefined
        : undefined,
    extra_service_provider_seat_price:
      body.extra_service_provider_seat_price !== undefined
        ? parsePrice(body.extra_service_provider_seat_price) ?? undefined
        : undefined,
    google_calendar_sync: parseOptionalBool(body.google_calendar_sync),
    email_notifications: parseOptionalBool(body.email_notifications),
    public_booking_page: parseOptionalBool(body.public_booking_page),
    whatsapp_automation: parseOptionalBool(body.whatsapp_automation),
    online_payments: parseOptionalBool(body.online_payments),
    additional_locations: parseOptionalBool(body.additional_locations),
    is_active: parseOptionalBool(body.is_active),
    billing_interval:
      body.billing_interval === null
        ? null
        : typeof body.billing_interval === 'string'
          ? body.billing_interval.trim() || null
          : undefined,
    display_order:
      body.display_order !== undefined && typeof body.display_order === 'number'
        ? Math.max(0, Math.floor(body.display_order))
        : undefined,
    content: content ?? undefined,
  };
}

export function parsePartialPlanInput(body: Record<string, unknown>): Partial<plan_input> {
  const patch: Partial<plan_input> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }
    patch.name = body.name.trim();
  }

  if (body.slug !== undefined) {
    const slug = parseSlug(body.slug);
    if (!slug) throw new Error('Slug must be lowercase kebab-case');
    patch.slug = slug;
  }

  if (body.price !== undefined) {
    const price = parsePrice(body.price);
    if (price === null) throw new Error('Price must be a non-negative number');
    patch.price = price;
  }

  if (body.booking_limit !== undefined) {
    const limit = parseBookingLimit(body.booking_limit);
    if (limit === null) {
      throw new Error('booking_limit must be -1 (unlimited) or a non-negative integer');
    }
    patch.booking_limit = limit;
  }

  const intFields = ['workspace_limit', 'admin_limit', 'service_provider_limit'] as const;
  for (const field of intFields) {
    if (body[field] !== undefined) {
      const val = parseNonNegativeInt(body[field]);
      if (val === null) throw new Error(`${field} must be a non-negative integer`);
      patch[field] = val;
    }
  }

  if (body.extra_service_provider_seat_price !== undefined) {
    const seatPrice = parsePrice(body.extra_service_provider_seat_price);
    if (seatPrice === null) {
      throw new Error('extra_service_provider_seat_price must be a non-negative number');
    }
    patch.extra_service_provider_seat_price = seatPrice;
  }

  const boolFields = [
    'google_calendar_sync',
    'email_notifications',
    'public_booking_page',
    'whatsapp_automation',
    'online_payments',
    'additional_locations',
    'is_active',
  ] as const;

  for (const field of boolFields) {
    const val = parseOptionalBool(body[field]);
    if (body[field] !== undefined && val === undefined) {
      throw new Error(`${field} must be a boolean`);
    }
    if (val !== undefined) patch[field] = val;
  }

  if (body.billing_interval !== undefined) {
    patch.billing_interval =
      body.billing_interval === null
        ? null
        : typeof body.billing_interval === 'string'
          ? body.billing_interval.trim() || null
          : null;
  }

  if (body.display_order !== undefined) {
    if (typeof body.display_order !== 'number' || !Number.isFinite(body.display_order)) {
      throw new Error('display_order must be a number');
    }
    patch.display_order = Math.max(0, Math.floor(body.display_order));
  }

  if (body.content !== undefined) {
    patch.content = parseContentInput(body);
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('Provide at least one field to update');
  }

  return patch;
}
