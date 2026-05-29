import { get_provider_link_slug_for_user } from '@/lib/provider_booking_link';

/** Origin for workspace public booking pages (`/{workspaceSlug}`). */
export function get_public_booking_origin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      const stripped = raw.replace(/^https?:\/\//, '').split('/')[0];
      if (stripped) return `https://${stripped}`;
    }
  }
  return 'https://getsettime.com';
}

/** Full public booking URL from Settings → My Link (workspace slug). */
export function build_workspace_public_booking_url(
  slug: string | null | undefined
): string | null {
  const trimmed = typeof slug === 'string' ? slug.trim() : '';
  if (!trimmed) return null;
  return `${get_public_booking_origin()}/${trimmed}`;
}

/** Service-provider public booking URL: `/{workspaceSlug}/{providerSlug}`. */
export function build_service_provider_public_booking_url(
  workspaceSlug: string | null | undefined,
  providerSlug: string | null | undefined
): string | null {
  const workspace = typeof workspaceSlug === 'string' ? workspaceSlug.trim() : '';
  const provider = typeof providerSlug === 'string' ? providerSlug.trim() : '';
  if (!workspace || !provider) return null;
  return `${get_public_booking_origin()}/${workspace}/${provider}`;
}

/** Provider-scoped event type URL: `/{workspaceSlug}/{providerSlug}/{eventTypeSlug}`. */
export function build_provider_event_type_public_booking_url(
  workspaceSlug: string | null | undefined,
  providerSlug: string | null | undefined,
  eventTypeSlug: string | null | undefined
): string | null {
  const workspace = typeof workspaceSlug === 'string' ? workspaceSlug.trim() : '';
  const provider = typeof providerSlug === 'string' ? providerSlug.trim() : '';
  const eventType = typeof eventTypeSlug === 'string' ? eventTypeSlug.trim() : '';
  if (!workspace || !provider || !eventType) return null;
  return `${get_public_booking_origin()}/${workspace}/${provider}/${eventType}`;
}

export type event_type_public_booking_url_result =
  | { ok: true; url: string }
  | { ok: false; error: string };

/** Resolve public URL for an event type based on its owner (SP → provider-scoped link). */
export function resolve_event_type_public_booking_url(
  workspaceSlug: string | null | undefined,
  eventTypeSlug: string | null | undefined,
  ownerId: string | null | undefined,
  providerLinks: unknown,
  ownerActsAsServiceProvider: boolean
): event_type_public_booking_url_result {
  const workspace = typeof workspaceSlug === 'string' ? workspaceSlug.trim() : '';
  const eventType = typeof eventTypeSlug === 'string' ? eventTypeSlug.trim() : '';

  if (!workspace) {
    return {
      ok: false,
      error:
        'Unable to copy link. Workspace slug is not loaded yet. Please try again.',
    };
  }

  if (!eventType) {
    return {
      ok: false,
      error:
        'Unable to copy link. This event type does not have a slug. Please edit and save it to generate a slug.',
    };
  }

  if (ownerId && ownerActsAsServiceProvider) {
    const providerSlug = get_provider_link_slug_for_user(providerLinks, ownerId);
    if (providerSlug) {
      const url = build_provider_event_type_public_booking_url(
        workspace,
        providerSlug,
        eventType
      );
      if (url) return { ok: true, url };
    }
    return {
      ok: false,
      error:
        'This service provider has not configured a booking link in Settings yet.',
    };
  }

  return { ok: true, url: `${get_public_booking_origin()}/${workspace}/${eventType}` };
}

export function build_public_booking_qr_url(booking_url: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(
    booking_url
  )}`;
}

export type public_booking_share_result = 'shared' | 'fallback' | 'cancelled';

/** Native share when available; otherwise caller should open the share fallback modal. */
export async function share_public_booking_with_customer(
  booking_url: string,
  workspace_title: string
): Promise<public_booking_share_result> {
  const shareText = `You can book your appointment with ${workspace_title} using this link:`;
  const shareData: ShareData = {
    title: 'Book an appointment',
    text: shareText,
    url: booking_url,
  };

  try {
    const can_use_native_share =
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      (typeof navigator.canShare !== 'function' || navigator.canShare(shareData)) &&
      window.isSecureContext;

    if (can_use_native_share) {
      await navigator.share(shareData);
      return 'shared';
    }
    return 'fallback';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'fallback';
  }
}

export function open_public_booking_whatsapp(
  booking_url: string,
  workspace_title: string
): void {
  window.open(
    `https://wa.me/?text=${encodeURIComponent(
      `Book your appointment with ${workspace_title}: ${booking_url}`
    )}`,
    '_blank',
    'noopener,noreferrer'
  );
}

export function open_public_booking_email(
  booking_url: string,
  workspace_title: string
): void {
  window.location.href = `mailto:?subject=${encodeURIComponent(
    `Book an appointment — ${workspace_title}`
  )}&body=${encodeURIComponent(
    `Hi,\n\nYou can book your appointment using this link:\n${booking_url}\n\nThank you.`
  )}`;
}

export async function download_public_booking_qr(booking_url: string): Promise<boolean> {
  const qr_url = build_public_booking_qr_url(booking_url);
  try {
    const response = await fetch(qr_url);
    const blob = await response.blob();
    const object_url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = object_url;
    link.download = 'public-booking-qr.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(object_url);
    return true;
  } catch {
    return false;
  }
}

export async function copy_text_to_clipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fallback below */
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
