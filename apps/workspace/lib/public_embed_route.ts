/** Reserved first path segments for in-app routes (not public embed booking). */
const EMBED_ROUTE_RESERVED_FIRST_SEGMENTS = new Set([
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'auth',
  'invite-accept',
  'event-type',
  'intakeform',
  'notifications',
  'routingform',
  'workflows',
  'availability',
  'team-members',
  'departments',
  'services',
  'profile',
  'integrations',
  'contacts',
  'billings',
  'bookings',
  'calendar',
  'emergency-booking',
  'settings',
  'change-password',
  'roles-permissions',
  'booking-preview',
  'api',
  '_next',
]);

/**
 * Public embed booking paths:
 * - /{workspaceSlug}
 * - /{workspaceSlug}/{slug} (event type or provider)
 * - /{workspaceSlug}/{slug}/{eventTypeSlug} (provider-scoped event type)
 */
export function is_public_embed_booking_path(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length < 1 || segments.length > 3) return false;
  return !EMBED_ROUTE_RESERVED_FIRST_SEGMENTS.has(segments[0]);
}
